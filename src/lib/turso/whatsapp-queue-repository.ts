import type { InValue } from "@libsql/client";
import { getTursoClient } from "@/src/lib/turso/client";

export type WhatsappQueueStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export type WhatsappQueueItem = {
  id: string;
  user_id: string;
  lead_id: string;
  instance_id: string;
  funnel_id: string;
  step_id: string;
  message_content: string;
  status: WhatsappQueueStatus;
  scheduled_at: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

let ensureSchemaPromise: Promise<void> | null = null;

export async function ensureWhatsappQueueSchema() {
  if (!ensureSchemaPromise) {
    ensureSchemaPromise = (async () => {
      await getTursoClient().executeMultiple(`
        create table if not exists whatsapp_campaign_queue (
          id text primary key,
          user_id text not null,
          lead_id text not null,
          instance_id text not null,
          funnel_id text not null,
          step_id text not null,
          message_content text not null,
          status text not null default 'pending',
          scheduled_at text not null,
          sent_at text,
          created_at text not null default current_timestamp,
          updated_at text not null default current_timestamp
        );

        create index if not exists whatsapp_queue_status_idx on whatsapp_campaign_queue(status, scheduled_at);
        create index if not exists whatsapp_queue_lead_idx on whatsapp_campaign_queue(lead_id);
      `);
    })();
  }
  await ensureSchemaPromise;
}

export async function enqueueWhatsappMessage(
  data: Omit<WhatsappQueueItem, "id" | "status" | "sent_at" | "created_at" | "updated_at">
): Promise<void> {
  await ensureWhatsappQueueSchema();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await getTursoClient().execute({
    args: [
      id,
      data.user_id,
      data.lead_id,
      data.instance_id,
      data.funnel_id,
      data.step_id,
      data.message_content,
      "pending",
      data.scheduled_at,
      now,
      now,
    ] as InValue[],
    sql: `insert into whatsapp_campaign_queue 
          (id, user_id, lead_id, instance_id, funnel_id, step_id, message_content, status, scheduled_at, created_at, updated_at)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  });
}

export async function getPendingQueueItems(limit = 20): Promise<WhatsappQueueItem[]> {
  await ensureWhatsappQueueSchema();
  const now = new Date().toISOString();

  const result = await getTursoClient().execute({
    args: [now, limit],
    sql: "select * from whatsapp_campaign_queue where status = 'pending' and scheduled_at <= ? order by scheduled_at asc limit ?",
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    lead_id: String(row.lead_id),
    instance_id: String(row.instance_id),
    funnel_id: String(row.funnel_id),
    step_id: String(row.step_id),
    message_content: String(row.message_content),
    status: row.status as WhatsappQueueStatus,
    scheduled_at: String(row.scheduled_at),
    sent_at: row.sent_at ? String(row.sent_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }));
}

export async function updateQueueItemStatus(
  id: string,
  status: WhatsappQueueStatus,
  sentAt?: Date
): Promise<void> {
  await ensureWhatsappQueueSchema();
  const sets: string[] = ["updated_at = current_timestamp", "status = ?"];
  const args: InValue[] = [status];

  if (sentAt) {
    sets.push("sent_at = ?");
    args.push(sentAt.toISOString());
  }

  args.push(id);
  await getTursoClient().execute({
    args,
    sql: `update whatsapp_campaign_queue set ${sets.join(", ")} where id = ?`,
  });
}

export async function cancelPendingQueueForLead(leadId: string): Promise<void> {
  await ensureWhatsappQueueSchema();
  await getTursoClient().execute({
    args: ["cancelled", leadId],
    sql: `update whatsapp_campaign_queue set status = ?, updated_at = current_timestamp where lead_id = ? and status = 'pending'`,
  });
}
