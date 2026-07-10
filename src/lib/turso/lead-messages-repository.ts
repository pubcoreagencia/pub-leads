import { getTursoClient } from "@/src/lib/turso/client";
import { getLeadById } from "@/src/lib/turso/leads-repository";
import { rowToTursoLeadMessage } from "@/src/lib/turso/mappers";

const selectMessageSql =
  "select id, lead_id, user_id, message, tone, objective, created_at from lead_messages";

export type LeadMessageInput = {
  id?: string;
  message: string;
  tone?: string | null;
  objective?: string | null;
  created_at?: string;
};

function parseObjective(value: string | null) {
  if (!value) {
    return {} as Record<string, unknown>;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {} as Record<string, unknown>;
  }
}

export async function createMessage(userId: string, leadId: string, data: LeadMessageInput) {
  const lead = await getLeadById(userId, leadId);

  if (!lead) {
    throw new Error("Lead nao encontrado.");
  }

  const id = data.id ?? crypto.randomUUID();
  const createdAt = data.created_at ?? new Date().toISOString();

  await getTursoClient().execute({
    args: [id, leadId, userId, data.message.trim(), data.tone ?? null, data.objective ?? null, createdAt],
    sql: "insert into lead_messages (id, lead_id, user_id, message, tone, objective, created_at) values (?, ?, ?, ?, ?, ?, ?)",
  });

  const result = await getTursoClient().execute({
    args: [userId, id],
    sql: `${selectMessageSql} where user_id = ? and id = ? limit 1`,
  });

  if (!result.rows[0]) {
    throw new Error("Mensagem criada, mas nao encontrada no Turso.");
  }

  return rowToTursoLeadMessage(result.rows[0]);
}

export async function listMessagesByLead(userId: string, leadId: string) {
  const lead = await getLeadById(userId, leadId);

  if (!lead) {
    return [];
  }

  const result = await getTursoClient().execute({
    args: [userId, leadId],
    sql: `${selectMessageSql} where user_id = ? and lead_id = ? order by datetime(created_at) desc`,
  });

  return result.rows.map(rowToTursoLeadMessage);
}

export async function updateMessageWorkspaceMetadata(
  userId: string,
  leadId: string,
  messageId: string,
  metadata: Record<string, unknown>,
) {
  const result = await getTursoClient().execute({
    args: [userId, leadId, messageId],
    sql: `${selectMessageSql} where user_id = ? and lead_id = ? and id = ? limit 1`,
  });
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const existing = parseObjective(typeof row.objective === "string" ? row.objective : null);
  const objective = JSON.stringify({
    ...existing,
    ...metadata,
    source: "manual_whatsapp_workspace",
  });

  await getTursoClient().execute({
    args: [objective, userId, leadId, messageId],
    sql: "update lead_messages set objective = ? where user_id = ? and lead_id = ? and id = ?",
  });

  const updated = await getTursoClient().execute({
    args: [userId, leadId, messageId],
    sql: `${selectMessageSql} where user_id = ? and lead_id = ? and id = ? limit 1`,
  });

  return updated.rows[0] ? rowToTursoLeadMessage(updated.rows[0]) : null;
}

export async function countMessages(userId: string) {
  const result = await getTursoClient().execute({
    args: [userId],
    sql: "select count(*) as total from lead_messages where user_id = ?",
  });

  return Number(result.rows[0]?.total ?? 0);
}
