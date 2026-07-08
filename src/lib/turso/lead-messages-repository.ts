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

export async function countMessages(userId: string) {
  const result = await getTursoClient().execute({
    args: [userId],
    sql: "select count(*) as total from lead_messages where user_id = ?",
  });

  return Number(result.rows[0]?.total ?? 0);
}
