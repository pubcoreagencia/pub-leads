import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { createClient, type Client, type InValue } from "@libsql/client";

type ImportOptions = {
  batchSize: number;
  cnaesPath: string | null;
  cityFilter: string | null;
  compact: boolean;
  establishmentsPaths: string[];
  limitRows: number | null;
  municipiosPath: string | null;
  onlyActive: boolean;
  ufFilter: string | null;
  withPhone: boolean;
};

type LookupMaps = {
  cnaes: Map<string, string>;
  municipios: Map<string, string>;
};

type CnpjEstablishmentInsert = {
  cnpj: string;
  cnpj_basico: string;
  cnpj_ordem: string;
  cnpj_dv: string;
  is_headquarters: boolean | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  situacao_cadastral: string | null;
  data_situacao_cadastral: string | null;
  data_inicio_atividade: string | null;
  cnae_fiscal: string | null;
  cnae_fiscal_descricao: string | null;
  tipo_logradouro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  uf: string;
  municipio: string;
  ddd_1: string | null;
  telefone_1: string | null;
  ddd_2: string | null;
  telefone_2: string | null;
  email: string | null;
  raw_data: Record<string, string | null>;
};

const officialColumns = [
  "cnpj_basico",
  "cnpj_ordem",
  "cnpj_dv",
  "identificador_matriz_filial",
  "nome_fantasia",
  "situacao_cadastral",
  "data_situacao_cadastral",
  "motivo_situacao_cadastral",
  "nome_cidade_exterior",
  "pais",
  "data_inicio_atividade",
  "cnae_fiscal_principal",
  "cnae_fiscal_secundaria",
  "tipo_logradouro",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cep",
  "uf",
  "municipio_codigo",
  "ddd_1",
  "telefone_1",
  "ddd_2",
  "telefone_2",
  "ddd_fax",
  "fax",
  "correio_eletronico",
  "situacao_especial",
  "data_situacao_especial",
];

const cnpjInsertColumns = [
  "cnpj",
  "cnpj_basico",
  "cnpj_ordem",
  "cnpj_dv",
  "is_headquarters",
  "razao_social",
  "nome_fantasia",
  "situacao_cadastral",
  "data_situacao_cadastral",
  "data_inicio_atividade",
  "cnae_fiscal",
  "cnae_fiscal_descricao",
  "tipo_logradouro",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cep",
  "uf",
  "municipio",
  "ddd_1",
  "telefone_1",
  "ddd_2",
  "telefone_2",
  "email",
  "raw_data",
] as const satisfies Array<keyof CnpjEstablishmentInsert>;

function getFlagValue(flags: string[], name: string) {
  const prefix = `${name}=`;
  const flag = flags.find((item) => item.startsWith(prefix));

  return flag ? flag.slice(prefix.length) : null;
}

function loadEnvFile(path: string) {
  if (!existsSync(path)) {
    return;
  }

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function splitPaths(value: string | null) {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => resolve(item))
    : [];
}

function isLocalUrl(url: string) {
  return url.startsWith("file:") || url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1");
}

function findFiles(rootPath: string) {
  const resolved = resolve(rootPath);

  if (!existsSync(resolved)) {
    throw new Error(`Caminho nao encontrado: ${rootPath}`);
  }

  if (!statSync(resolved).isDirectory()) {
    return [resolved];
  }

  const files: string[] = [];
  const stack = [resolved];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current) {
      continue;
    }

    for (const entry of readdirSync(current)) {
      const entryPath = join(current, entry);
      const stats = statSync(entryPath);

      if (stats.isDirectory()) {
        stack.push(entryPath);
      } else if (!entry.toLowerCase().endsWith(".zip")) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

function detectReferenceFile(files: string[], patterns: string[]) {
  return (
    files.find((file) => {
      const name = basename(file).toLowerCase();

      return patterns.some((pattern) => name.includes(pattern));
    }) ?? null
  );
}

function detectEstablishmentFiles(files: string[]) {
  return files.filter((file) => {
    const name = basename(file).toLowerCase();

    return name.includes("estabele") || name.includes("estab");
  });
}

function parseArgs(): ImportOptions {
  const args = process.argv.slice(2);
  const positionalPath = args.find((arg) => !arg.startsWith("--"));
  const sourcePath = getFlagValue(args, "--dir") ?? positionalPath;

  if (!sourcePath && !getFlagValue(args, "--estabelecimentos")) {
    throw new Error(
      "Informe uma pasta extraida ou CSV: npx tsx scripts/import-cnpj-csv.ts ./cnpj-extraido/extracted --municipios=Municipios.csv --cnaes=Cnaes.csv",
    );
  }

  const detectedFiles = sourcePath ? findFiles(sourcePath) : [];
  const explicitEstablishments = splitPaths(getFlagValue(args, "--estabelecimentos"));
  const establishmentsPaths =
    explicitEstablishments.length > 0 ? explicitEstablishments : detectEstablishmentFiles(detectedFiles);
  const batchSize = Number(getFlagValue(args, "--batch-size") ?? 1000);
  const limitRows = Number(getFlagValue(args, "--limit") ?? 0);

  if (establishmentsPaths.length === 0) {
    throw new Error("Nenhum arquivo de Estabelecimentos encontrado. Extraia os ZIPs da Receita antes de importar.");
  }

  return {
    batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 1000,
    cnaesPath:
      getFlagValue(args, "--cnaes") ??
      detectReferenceFile(detectedFiles, ["cnae"]),
    cityFilter: getFlagValue(args, "--city") ?? getFlagValue(args, "--cidade"),
    compact: args.includes("--compact") || args.includes("--no-raw-data"),
    establishmentsPaths,
    limitRows: Number.isFinite(limitRows) && limitRows > 0 ? limitRows : null,
    municipiosPath:
      getFlagValue(args, "--municipios") ??
      detectReferenceFile(detectedFiles, ["municip", "munic"]),
    onlyActive: args.includes("--only-active"),
    ufFilter: getFlagValue(args, "--uf")?.toUpperCase() ?? null,
    withPhone: args.includes("--with-phone"),
  };
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ";" && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values.map((value) => value || "");
}

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function onlyDigits(value: string | null | undefined) {
  return value?.replace(/\D/g, "") ?? "";
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string | undefined) {
  const digits = onlyDigits(value);
  return digits || null;
}

function normalizeDate(value: string | undefined) {
  const digits = onlyDigits(value);

  if (digits.length !== 8) {
    return null;
  }

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function rawDataFromColumns(columns: string[], municipioCodigo: string | null) {
  return officialColumns.reduce<Record<string, string | null>>((rawData, column, index) => {
    rawData[column] = clean(columns[index]);
    return rawData;
  }, { municipio_codigo_normalizado: municipioCodigo });
}

async function readDelimitedFile(filePath: string, onRow: (columns: string[]) => void | Promise<void>) {
  const reader = createInterface({
    crlfDelay: Infinity,
    input: createReadStream(filePath, { encoding: "latin1" }),
  });

  for await (const line of reader) {
    if (!line.trim()) {
      continue;
    }

    await onRow(parseCsvLine(line));
  }
}

async function loadLookup(filePath: string | null, label: string) {
  const lookup = new Map<string, string>();

  if (!filePath) {
    console.warn(`Arquivo de ${label} nao informado. A importacao continuara sem esse cruzamento.`);
    return lookup;
  }

  await readDelimitedFile(filePath, (columns) => {
    const code = onlyDigits(columns[0]);
    const description = clean(columns[1]);

    if (code && description) {
      lookup.set(code, description);
    }
  });

  console.log(`${label}: ${lookup.size} registros carregados de ${filePath}`);
  return lookup;
}

function mapEstablishment(
  columns: string[],
  options: ImportOptions,
  lookups: LookupMaps,
): CnpjEstablishmentInsert | null {
  const cnpjBasico = onlyDigits(columns[0]);
  const cnpjOrdem = onlyDigits(columns[1]);
  const cnpjDv = onlyDigits(columns[2]);
  const cnpj = `${cnpjBasico}${cnpjOrdem}${cnpjDv}`;
  const situacaoCadastral = clean(columns[5]);
  const uf = clean(columns[19])?.toUpperCase();
  const municipioCode = onlyDigits(columns[20]) || clean(columns[20]);
  const municipio = (municipioCode ? lookups.municipios.get(municipioCode) : null) ?? clean(columns[20]);
  const cnaeFiscal = onlyDigits(columns[11]) || null;
  const ddd1 = onlyDigits(columns[21]) || null;
  const ddd2 = onlyDigits(columns[23]) || null;
  const telefone1 = normalizePhone(columns[22]);
  const telefone2 = normalizePhone(columns[24]);

  if (cnpj.length !== 14 || !uf || !municipio) {
    return null;
  }

  if (options.onlyActive && situacaoCadastral !== "02") {
    return null;
  }

  if (options.ufFilter && uf !== options.ufFilter) {
    return null;
  }

  if (options.cityFilter && normalizeText(municipio) !== normalizeText(options.cityFilter)) {
    return null;
  }

  if (options.withPhone && !(ddd1 && telefone1) && !(ddd2 && telefone2)) {
    return null;
  }

  return {
    bairro: clean(columns[17]),
    cep: onlyDigits(columns[18]) || null,
    cnae_fiscal: cnaeFiscal,
    cnae_fiscal_descricao: cnaeFiscal ? lookups.cnaes.get(cnaeFiscal) ?? null : null,
    cnpj,
    cnpj_basico: cnpjBasico,
    cnpj_dv: cnpjDv,
    cnpj_ordem: cnpjOrdem,
    complemento: clean(columns[16]),
    data_inicio_atividade: normalizeDate(columns[10]),
    data_situacao_cadastral: normalizeDate(columns[6]),
    ddd_1: ddd1,
    ddd_2: ddd2,
    email: clean(columns[27])?.toLowerCase() ?? null,
    is_headquarters: columns[3] === "1" ? true : columns[3] === "2" ? false : null,
    logradouro: clean(columns[14]),
    municipio,
    nome_fantasia: clean(columns[4]),
    numero: clean(columns[15]),
    raw_data: options.compact ? {} : rawDataFromColumns(columns, municipioCode),
    razao_social: null,
    situacao_cadastral: situacaoCadastral,
    telefone_1: telefone1,
    telefone_2: telefone2,
    tipo_logradouro: clean(columns[13]),
    uf,
  };
}

function toDbValue(row: CnpjEstablishmentInsert, column: (typeof cnpjInsertColumns)[number]): InValue {
  if (column === "raw_data") {
    return JSON.stringify(row.raw_data ?? {});
  }

  return row[column] ?? null;
}

async function flushBatch(client: Client, batch: CnpjEstablishmentInsert[]) {
  if (batch.length === 0) {
    return 0;
  }

  const placeholders = cnpjInsertColumns.map(() => "?").join(", ");
  const sql = `insert or replace into cnpj_establishments (${cnpjInsertColumns.join(", ")}) values (${placeholders})`;

  await client.batch(
    batch.map((row) => ({
      args: cnpjInsertColumns.map((column) => toDbValue(row, column)),
      sql,
    })),
    "write",
  );

  return batch.length;
}

async function importEstablishments(
  client: Client,
  options: ImportOptions,
  lookups: LookupMaps,
) {
  const batch: CnpjEstablishmentInsert[] = [];
  let processed = 0;
  let imported = 0;
  let skipped = 0;

  for (const filePath of options.establishmentsPaths) {
    console.log(`Importando estabelecimentos: ${filePath}`);

    await readDelimitedFile(filePath, async (columns) => {
      if (options.limitRows !== null && processed >= options.limitRows) {
        return;
      }

      processed += 1;
      const establishment = mapEstablishment(columns, options, lookups);

      if (!establishment) {
        skipped += 1;
        return;
      }

      batch.push(establishment);

      if (batch.length >= options.batchSize) {
        imported += await flushBatch(client, batch.splice(0, batch.length));
        console.log(`Processados ${processed}; importados ${imported}; ignorados ${skipped}`);
      }
    });

    if (options.limitRows !== null && processed >= options.limitRows) {
      break;
    }
  }

  imported += await flushBatch(client, batch);

  return {
    imported,
    processed,
    skipped,
  };
}

async function main() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");

  const options = parseArgs();
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl) {
    throw new Error("Defina TURSO_DATABASE_URL antes de importar.");
  }

  if (!tursoToken && !isLocalUrl(tursoUrl)) {
    throw new Error("Defina TURSO_AUTH_TOKEN para importar em banco Turso remoto.");
  }

  console.log(`Arquivos de estabelecimentos: ${options.establishmentsPaths.length}`);
  console.log(`Filtro UF: ${options.ufFilter ?? "todos"}`);
  console.log(`Filtro cidade: ${options.cityFilter ?? "todas"}`);
  console.log(`Somente ativos: ${options.onlyActive ? "sim" : "nao"}`);
  console.log(`Somente com telefone: ${options.withPhone ? "sim" : "nao"}`);
  console.log(`Modo compacto: ${options.compact ? "sim" : "nao"}`);

  const lookups: LookupMaps = {
    cnaes: await loadLookup(options.cnaesPath, "CNAEs"),
    municipios: await loadLookup(options.municipiosPath, "municipios"),
  };
  const turso = createClient({ authToken: tursoToken, url: tursoUrl });
  await turso.executeMultiple(readFileSync("src/lib/turso/schema.sql", "utf8"));

  const stats = await importEstablishments(turso, options, lookups);
  turso.close();

  console.log(
    `Importacao finalizada. Processados ${stats.processed}; importados ${stats.imported}; ignorados ${stats.skipped}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
