import { getTursoClient } from "@/src/lib/turso/client";
import { getLeadById } from "@/src/lib/turso/leads-repository";
import { rowToLeadNote, rowToTursoLeadNote } from "@/src/lib/turso/mappers";

const selectNoteSql = "select id, lead_id, user_id, note, created_at from lead_notes";

export async function createNote(userId: string, leadId: string, note: string) {
  const lead = await getLeadById(userId, leadId);

  if (!lead) {
    throw new Error("Lead nao encontrado.");
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await getTursoClient().execute({
    args: [id, leadId, userId, note.trim(), createdAt],
    sql: "insert into lead_notes (id, lead_id, user_id, note, created_at) values (?, ?, ?, ?, ?)",
  });

  const result = await getTursoClient().execute({
    args: [userId, id],
    sql: `${selectNoteSql} where user_id = ? and id = ? limit 1`,
  });

  if (!result.rows[0]) {
    throw new Error("Nota criada, mas nao encontrada no Turso.");
  }

  return rowToLeadNote(result.rows[0]);
}

export async function listNotesByLead(userId: string, leadId: string) {
  const lead = await getLeadById(userId, leadId);

  if (!lead) {
    return [];
  }

  const result = await getTursoClient().execute({
    args: [userId, leadId],
    sql: `${selectNoteSql} where user_id = ? and lead_id = ? order by datetime(created_at) desc`,
  });

  return result.rows.map(rowToLeadNote);
}

export async function deleteNote(userId: string, noteId: string) {
  const result = await getTursoClient().execute({
    args: [userId, noteId],
    sql: "delete from lead_notes where user_id = ? and id = ?",
  });

  return result.rowsAffected > 0;
}

export async function countNotes(userId: string) {
  const result = await getTursoClient().execute({
    args: [userId],
    sql: "select count(*) as total from lead_notes where user_id = ?",
  });

  return Number(result.rows[0]?.total ?? 0);
}

export async function listRawNotesByLead(userId: string, leadId: string) {
  const result = await getTursoClient().execute({
    args: [userId, leadId],
    sql: `${selectNoteSql} where user_id = ? and lead_id = ? order by datetime(created_at) desc`,
  });

  return result.rows.map(rowToTursoLeadNote);
}
