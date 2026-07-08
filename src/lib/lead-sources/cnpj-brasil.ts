import type { Lead } from "@/schemas/lead";
import type {
  CnpjLeadSearchParams,
  LeadEnrichmentResult,
  LeadSourceProvider,
  NormalizedLead,
} from "@/src/lib/lead-sources/types";
import { getTursoClient } from "@/src/lib/turso/client";
import { parseJsonRecord } from "@/src/lib/turso/mappers";

type CnpjEstablishmentRow = {
  cnpj: string;
  cnpj_basico: string | null;
  cnpj_ordem: string | null;
  cnpj_dv: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  situacao_cadastral: string | null;
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
  raw_data: string | null;
};

function formatTursoError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("cnpj_establishments")) {
    return "Base CNPJ nao instalada no Turso. Rode npm run turso:setup e importe os CSVs da Receita.";
  }

  return message || "Erro ao consultar a base CNPJ no Turso.";
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

function escapeIlike(value: string) {
  return value.replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim();
}

function formatCnpj(value: string | null | undefined) {
  const digits = onlyDigits(value);

  if (digits.length !== 14) {
    return digits || null;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatPhone(ddd: string | null, phone: string | null) {
  const dddDigits = onlyDigits(ddd);
  const phoneDigits = onlyDigits(phone);

  if (!phoneDigits) {
    return null;
  }

  const digits = dddDigits && !phoneDigits.startsWith(dddDigits) ? `${dddDigits}${phoneDigits}` : phoneDigits;

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  return digits;
}

function buildAddress(row: CnpjEstablishmentRow) {
  const street = [row.tipo_logradouro, row.logradouro].filter(Boolean).join(" ");
  const parts = [
    street && row.numero ? `${street}, ${row.numero}` : street,
    row.complemento,
    row.bairro,
    row.cep ? `CEP ${row.cep}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" - ") : null;
}

function toNormalizedLead(row: CnpjEstablishmentRow): NormalizedLead {
  const cnpj = formatCnpj(row.cnpj);

  return {
    address: buildAddress(row),
    businessName: row.razao_social,
    category: row.cnae_fiscal_descricao ?? row.cnae_fiscal ?? "CNPJ Brasil",
    city: row.municipio,
    cnae: row.cnae_fiscal,
    cnaeDescription: row.cnae_fiscal_descricao,
    cnpj,
    country: "Brasil",
    email: row.email,
    fantasyName: row.nome_fantasia,
    latitude: null,
    longitude: null,
    name: row.nome_fantasia || row.razao_social || cnpj || "Empresa sem nome",
    phone: formatPhone(row.ddd_1, row.telefone_1),
    phone2: formatPhone(row.ddd_2, row.telefone_2),
    rating: null,
    rawData: {
      ...parseJsonRecord(row.raw_data),
      cnpj: row.cnpj,
      situacaoCadastral: row.situacao_cadastral,
      dataInicioAtividade: row.data_inicio_atividade,
    },
    reviewsCount: null,
    source: "cnpj_brasil",
    sourcePlaceId: row.cnpj,
    sourceUrl: "https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/",
    state: row.uf,
    website: null,
  };
}

function tokens(value: string | null | undefined) {
  return new Set(normalizeText(value).split(" ").filter((token) => token.length > 2));
}

function tokenOverlap(left: string | null | undefined, right: string | null | undefined) {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let matches = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      matches += 1;
    }
  });

  return matches / Math.max(leftTokens.size, rightTokens.size);
}

function scoreCandidate(lead: Lead, candidate: NormalizedLead): LeadEnrichmentResult {
  const reasons: string[] = [];
  const leadCnpj = onlyDigits(lead.cnpj);
  const candidateCnpj = onlyDigits(candidate.cnpj);
  let confidence = 0;

  if (leadCnpj && candidateCnpj && leadCnpj === candidateCnpj) {
    return {
      confidence: 1,
      lead: candidate,
      reasons: ["CNPJ identico"],
    };
  }

  const nameOverlap = Math.max(
    tokenOverlap(lead.name, candidate.name),
    tokenOverlap(lead.company, candidate.businessName),
    tokenOverlap(lead.name, candidate.fantasyName),
  );

  if (nameOverlap >= 0.7) {
    confidence += 0.4;
    reasons.push("nome muito semelhante");
  } else if (nameOverlap >= 0.4) {
    confidence += 0.25;
    reasons.push("nome parcialmente semelhante");
  }

  if (normalizeText(lead.city) && normalizeText(lead.city) === normalizeText(candidate.city)) {
    confidence += 0.2;
    reasons.push("mesma cidade");
  }

  if (normalizeText(lead.state) && normalizeText(lead.state) === normalizeText(candidate.state)) {
    confidence += 0.1;
    reasons.push("mesmo estado");
  }

  if (tokenOverlap(lead.address, candidate.address) >= 0.35) {
    confidence += 0.15;
    reasons.push("endereco semelhante");
  }

  if (tokenOverlap(lead.category, candidate.cnaeDescription) >= 0.35) {
    confidence += 0.1;
    reasons.push("categoria compativel com CNAE");
  }

  if (candidate.phone || candidate.phone2 || candidate.email) {
    confidence += 0.05;
    reasons.push("possui contato publico");
  }

  return {
    confidence: Math.min(Number(confidence.toFixed(2)), 1),
    lead: candidate,
    reasons,
  };
}

async function searchByCnpj(cnpj: string) {
  const digits = onlyDigits(cnpj);

  if (!digits) {
    return null;
  }

  try {
    const result = await getTursoClient().execute({
      args: [digits],
      sql: "select * from cnpj_establishments where cnpj = ? limit 1",
    });

    return result.rows[0] ? toNormalizedLead(result.rows[0] as unknown as CnpjEstablishmentRow) : null;
  } catch (error) {
    throw new Error(formatTursoError(error));
  }
}

export async function cnpjBaseHasData() {
  try {
    const result = await getTursoClient().execute(
      "select cnpj from cnpj_establishments limit 1",
    );

    return result.rows.length > 0;
  } catch (error) {
    throw new Error(formatTursoError(error));
  }
}

export const cnpjBrasilProvider: LeadSourceProvider<CnpjLeadSearchParams> = {
  id: "cnpj_brasil",
  name: "Dados Abertos CNPJ Brasil",
  async search(params) {
    const limit = Math.min(Math.max(params.limit, 1), 100);
    const queryText = normalizeText(escapeIlike(params.query ?? ""));
    const clauses = ["lower(municipio) like ?", "uf = ?"];
    const args: Array<string | number> = [
      `%${normalizeText(params.city)}%`,
      params.state.trim().toUpperCase(),
    ];

    if (params.cnae) {
      clauses.push("cnae_fiscal = ?");
      args.push(onlyDigits(params.cnae));
    }

    if (params.onlyWithPhone) {
      clauses.push("(telefone_1 is not null or telefone_2 is not null)");
    }

    if (queryText) {
      clauses.push(
        "(lower(coalesce(nome_fantasia, '')) like ? or lower(coalesce(razao_social, '')) like ? or cnae_fiscal like ? or lower(coalesce(cnae_fiscal_descricao, '')) like ?)",
      );
      args.push(`%${queryText}%`, `%${queryText}%`, `%${onlyDigits(queryText) || queryText}%`, `%${queryText}%`);
    }

    args.push(Math.min(limit * 3, 200));

    try {
      const result = await getTursoClient().execute({
        args,
        sql: `select * from cnpj_establishments
          where ${clauses.join(" and ")}
          order by case when telefone_1 is not null or telefone_2 is not null then 1 else 0 end desc
          limit ?`,
      });

      return result.rows
        .map((row) => toNormalizedLead(row as unknown as CnpjEstablishmentRow))
        .slice(0, limit);
    } catch (error) {
      throw new Error(formatTursoError(error));
    }
  },
  async enrichLead(lead) {
    if (lead.cnpj) {
      const matched = await searchByCnpj(lead.cnpj);

      return matched
        ? {
            confidence: 1,
            lead: matched,
            reasons: ["CNPJ identico"],
          }
        : null;
    }

    if (!lead.city || !lead.state) {
      return null;
    }

    const candidates = await this.search({
      city: lead.city,
      limit: 10,
      onlyWithPhone: false,
      query: lead.name,
      state: lead.state,
    });

    return candidates
      .map((candidate) => scoreCandidate(lead, candidate))
      .sort((left, right) => right.confidence - left.confidence)[0] ?? null;
  },
};
