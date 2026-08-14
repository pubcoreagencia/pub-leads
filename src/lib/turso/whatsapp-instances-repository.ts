import type { InValue } from "@libsql/client";
import { getTursoClient } from "@/src/lib/turso/client";

export type WhatsappInstanceStatus = "connecting" | "open" | "close" | "qrcode" | "refused";

export type WhatsappInstance = {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  server_url: string;
  api_key: string;
  instance_name: string;
  status: WhatsappInstanceStatus;
  is_active: boolean;
  qr_code: string | null;
  created_at: string;
  updated_at: string;
};

let ensureSchemaPromise: Promise<void> | null = null;

export async function ensureWhatsappInstancesSchema() {
  ensureSchemaPromise ??= getTursoClient().executeMultiple(`
    create table if not exists whatsapp_instances (
      id text primary key,
      user_id text not null,
      name text not null,
      phone text,
      server_url text not null,
      api_key text not null,
      instance_name text not null,
      status text not null default 'close',
      is_active integer not null default 1,
      qr_code text,
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp
    );

    create index if not exists whatsapp_instances_user_idx on whatsapp_instances(user_id);
    create unique index if not exists whatsapp_instances_user_name_unique_idx on whatsapp_instances(user_id, instance_name);
  `);
  await ensureSchemaPromise;
}

export async function listWhatsappInstances(userId: string): Promise<WhatsappInstance[]> {
  await ensureWhatsappInstancesSchema();
  const result = await getTursoClient().execute({
    args: [userId],
    sql: "select * from whatsapp_instances where user_id = ? order by created_at desc",
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    phone: row.phone ? String(row.phone) : null,
    server_url: String(row.server_url),
    api_key: String(row.api_key),
    instance_name: String(row.instance_name),
    status: (row.status as WhatsappInstanceStatus) || "close",
    is_active: Boolean(row.is_active),
    qr_code: row.qr_code ? String(row.qr_code) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }));
}

export async function createWhatsappInstance(
  userId: string,
  data: { name: string; server_url: string; api_key: string; instance_name: string },
): Promise<WhatsappInstance> {
  await ensureWhatsappInstancesSchema();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await getTursoClient().execute({
    args: [id, userId, data.name, data.server_url, data.api_key, data.instance_name, "close", 1, now, now] as InValue[],
    sql: `insert into whatsapp_instances (id, user_id, name, server_url, api_key, instance_name, status, is_active, created_at, updated_at)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  });

  const instances = await listWhatsappInstances(userId);
  const found = instances.find((i) => i.id === id);
  if (!found) throw new Error("Instância criada, mas não encontrada.");
  return found;
}

export async function updateWhatsappInstance(
  userId: string,
  id: string,
  data: Partial<Pick<WhatsappInstance, "status" | "phone" | "qr_code" | "is_active" | "name">>,
): Promise<void> {
  await ensureWhatsappInstancesSchema();
  const sets: string[] = ["updated_at = current_timestamp"];
  const args: InValue[] = [];

  if (data.status !== undefined) {
    sets.push("status = ?");
    args.push(data.status);
  }
  if (data.phone !== undefined) {
    sets.push("phone = ?");
    args.push(data.phone);
  }
  if (data.qr_code !== undefined) {
    sets.push("qr_code = ?");
    args.push(data.qr_code);
  }
  if (data.is_active !== undefined) {
    sets.push("is_active = ?");
    args.push(data.is_active ? 1 : 0);
  }
  if (data.name !== undefined) {
    sets.push("name = ?");
    args.push(data.name);
  }

  args.push(userId, id);
  await getTursoClient().execute({
    args,
    sql: `update whatsapp_instances set ${sets.join(", ")} where user_id = ? and id = ?`,
  });
}

export async function deleteWhatsappInstance(userId: string, id: string): Promise<void> {
  await ensureWhatsappInstancesSchema();
  await getTursoClient().execute({
    args: [userId, id],
    sql: "delete from whatsapp_instances where user_id = ? and id = ?",
  });
}
