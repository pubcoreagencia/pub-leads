import { createClient } from "@libsql/client";
import { loadEnvConfig } from "@next/env";

import { qualifyLeadAfterScraping } from "../src/lib/lead-qualification/qualifier";

const batchSize = 500;

function parseMetadata(value: unknown) {
  if (typeof value !== "string") {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("Defina TURSO_DATABASE_URL antes de rodar este script.");
  }

  const client = createClient({ authToken, url });
  let offset = 0;
  let processed = 0;
  let corrected = 0;

  while (true) {
    const batch = await client.execute({
      args: [batchSize, offset],
      sql: "select id, phone, phone_2, whatsapp, website, raw_data, whatsapp_status, phone_type from leads order by id limit ? offset ?",
    });

    if (batch.rows.length === 0) {
      break;
    }

    for (const row of batch.rows) {
      const metadata = parseMetadata(row.raw_data);
      const classified = qualifyLeadAfterScraping({
        phone: typeof row.phone === "string" ? row.phone : null,
        phone2: typeof row.phone_2 === "string" ? row.phone_2 : null,
        rawData: metadata,
        website: typeof row.website === "string" ? row.website : null,
        whatsapp: typeof row.whatsapp === "string" ? row.whatsapp : null,
      });
      const qualification = classified.qualification;
      const whatsapp = ["confirmed", "possible"].includes(qualification.whatsapp_status)
        ? qualification.normalized_whatsapp
        : null;

      const changed =
        row.whatsapp !== whatsapp ||
        row.phone_type !== qualification.phone_type ||
        row.whatsapp_status !== qualification.whatsapp_status;

      if (changed) {
        await client.execute({
          args: [
            whatsapp,
            qualification.phone_type,
            qualification.normalized_phone,
            qualification.normalized_whatsapp,
            qualification.whatsapp_status,
            qualification.whatsapp_confidence,
            qualification.whatsapp_validation_source,
            qualification.whatsapp_checked_at,
            JSON.stringify(qualification.qualification_tags),
            JSON.stringify(classified.rawData),
            new Date().toISOString(),
            String(row.id),
          ],
          sql: "update leads set whatsapp = ?, phone_type = ?, normalized_phone = ?, normalized_whatsapp = ?, whatsapp_status = ?, whatsapp_confidence = ?, whatsapp_validation_source = ?, whatsapp_checked_at = ?, qualification_tags = ?, raw_data = ?, updated_at = ? where id = ?",
        });
        corrected += 1;
      }

      processed += 1;
    }

    offset += batch.rows.length;
    console.log(`Processados: ${processed} | Corrigidos: ${corrected}`);
  }

  client.close();
  console.log(`Qualificação concluída. Leads processados: ${processed}. Leads corrigidos: ${corrected}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
