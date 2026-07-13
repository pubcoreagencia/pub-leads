import type { InValue, Row } from "@libsql/client";

import type { Lead, LeadStatus } from "@/schemas/lead";
import { getTursoClient } from "@/src/lib/turso/client";
import { getLeadById, updateLeadStatus } from "@/src/lib/turso/leads-repository";

export type FunnelStateStatus =
  | "not_started"
  | "contacted"
  | "replied"
  | "explaining"
  | "follow_up"
  | "converted"
  | "lost"
  | "paused";

export type MessageEventType =
  | "copied"
  | "opened_whatsapp"
  | "marked_sent"
  | "marked_replied"
  | "skipped"
  | "advanced_step"
  | "note";

export type MessageFunnel = {
  created_at: string;
  description: string | null;
  id: string;
  is_active: boolean;
  is_default: boolean;
  metadata: Record<string, unknown>;
  name: string;
  steps: MessageFunnelStep[];
  updated_at: string;
  user_id: string | null;
};

export type MessageFunnelStep = {
  channel: string;
  created_at: string;
  fallback_template: string | null;
  funnel_id: string;
  id: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  name: string;
  objective: string | null;
  step_order: number;
  template: string;
  trigger_condition: string | null;
  updated_at: string;
  user_id: string | null;
  wait_hint: string | null;
};

export type LeadFunnelState = {
  created_at: string;
  current_step_id: string | null;
  current_step_order: number;
  funnel_id: string;
  id: string;
  last_message_at: string | null;
  last_reply_at: string | null;
  lead_id: string;
  metadata: Record<string, unknown>;
  next_follow_up_at: string | null;
  status: FunnelStateStatus;
  updated_at: string;
  user_id: string;
};

export type LeadMessageEvent = {
  channel: string;
  created_at: string;
  event_type: MessageEventType;
  funnel_id: string | null;
  id: string;
  lead_id: string;
  message_content: string | null;
  metadata: Record<string, unknown>;
  step_id: string | null;
  step_order: number | null;
  user_id: string;
};

export const DEFAULT_FUNNEL_ID = "pub-start-default";

const defaultSteps = [
  {
    name: "Primeiro contato",
    objective: "Abrir conversa sem assustar o lead.",
    template: "Olá, bom dia!",
    wait_hint: "Enviar apenas quando for iniciar o contato.",
  },
  {
    name: "Introdução",
    objective: "Se apresentar e pedir permissão para explicar.",
    template:
      "Eu sou {operador}, representante comercial da Agência PUB. Estou entrando em contato porque a {empresa} foi uma das 5 empresas de {nicho} selecionadas para o nosso {projeto}. Posso te explicar rapidamente como funciona?",
    wait_hint: "Usar depois que o lead responder ao primeiro contato.",
  },
  {
    name: "Explicação curta",
    objective: "Explicar entrega e proposta.",
    template:
      "O projeto é voltado para empresas já consolidadas, mas que ainda não têm uma presença digital no nível que merecem. A entrega inclui site profissional, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business — tudo pronto em 3 a 7 dias.",
    wait_hint: "Enviar se o lead aceitar entender o projeto.",
  },
  {
    name: "Autoridade",
    objective: "Reforçar confiança.",
    template:
      "A estrutura é feita pela Agência PUB, que já atuou com marcas e nomes como L'Oréal Paris, Globosat, Circo Voador, Gabriel Pensador, Diogo Defante, Paulinho Serra e Vamos Dubai. O site do serviço é https://pub-start.pages.dev/",
    wait_hint: "Usar quando o lead pedir segurança, referências ou contexto.",
  },
  {
    name: "Escassez",
    objective: "Reforçar limite de vagas.",
    template:
      "Nessa etapa são apenas 5 empresas selecionadas. Caso não faça sentido para vocês, a vaga segue para a próxima empresa da lista — possivelmente um concorrente direto.",
    wait_hint: "Usar quando houver demora ou indecisão.",
  },
  {
    name: "CTA",
    objective: "Chamar para o próximo passo.",
    template: "Gostaríamos muito que fossem vocês. Posso te passar os detalhes da entrega e valores?",
    wait_hint: "Usar para puxar a conversa para decisão.",
  },
  {
    name: "Follow-up 1",
    objective: "Retomar sem pressionar.",
    template:
      "Passando só para confirmar se fez sentido eu te explicar melhor o {projeto}. Ainda estamos organizando as empresas selecionadas dessa etapa.",
    wait_hint: "Usar após algumas horas ou no próximo dia útil.",
  },
  {
    name: "Follow-up 2",
    objective: "Última tentativa antes de seguir a lista.",
    template:
      "Como são poucas vagas, vou precisar seguir com a próxima empresa da lista caso não seja uma prioridade para vocês agora. Mas, sinceramente, gostaríamos bastante que a {empresa} participasse.",
    wait_hint: "Usar como encerramento respeitoso.",
  },
];

let ensured = false;

function parseJson(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function bool(value: unknown) {
  return Number(value ?? 0) === 1;
}

function rowValue(row: Row, key: string) {
  return row[key] as unknown;
}

function rowToStep(row: Row): MessageFunnelStep {
  return {
    channel: String(rowValue(row, "channel") ?? "whatsapp"),
    created_at: String(rowValue(row, "created_at")),
    fallback_template: rowValue(row, "fallback_template") ? String(rowValue(row, "fallback_template")) : null,
    funnel_id: String(rowValue(row, "funnel_id")),
    id: String(rowValue(row, "id")),
    is_active: bool(rowValue(row, "is_active")),
    metadata: parseJson(rowValue(row, "metadata")),
    name: String(rowValue(row, "name")),
    objective: rowValue(row, "objective") ? String(rowValue(row, "objective")) : null,
    step_order: Number(rowValue(row, "step_order")),
    template: String(rowValue(row, "template")),
    trigger_condition: rowValue(row, "trigger_condition") ? String(rowValue(row, "trigger_condition")) : null,
    updated_at: String(rowValue(row, "updated_at")),
    user_id: rowValue(row, "user_id") ? String(rowValue(row, "user_id")) : null,
    wait_hint: rowValue(row, "wait_hint") ? String(rowValue(row, "wait_hint")) : null,
  };
}

function rowToFunnel(row: Row, steps: MessageFunnelStep[]): MessageFunnel {
  return {
    created_at: String(rowValue(row, "created_at")),
    description: rowValue(row, "description") ? String(rowValue(row, "description")) : null,
    id: String(rowValue(row, "id")),
    is_active: bool(rowValue(row, "is_active")),
    is_default: bool(rowValue(row, "is_default")),
    metadata: parseJson(rowValue(row, "metadata")),
    name: String(rowValue(row, "name")),
    steps,
    updated_at: String(rowValue(row, "updated_at")),
    user_id: rowValue(row, "user_id") ? String(rowValue(row, "user_id")) : null,
  };
}

function rowToState(row: Row): LeadFunnelState {
  return {
    created_at: String(rowValue(row, "created_at")),
    current_step_id: rowValue(row, "current_step_id") ? String(rowValue(row, "current_step_id")) : null,
    current_step_order: Number(rowValue(row, "current_step_order") ?? 1),
    funnel_id: String(rowValue(row, "funnel_id")),
    id: String(rowValue(row, "id")),
    last_message_at: rowValue(row, "last_message_at") ? String(rowValue(row, "last_message_at")) : null,
    last_reply_at: rowValue(row, "last_reply_at") ? String(rowValue(row, "last_reply_at")) : null,
    lead_id: String(rowValue(row, "lead_id")),
    metadata: parseJson(rowValue(row, "metadata")),
    next_follow_up_at: rowValue(row, "next_follow_up_at") ? String(rowValue(row, "next_follow_up_at")) : null,
    status: String(rowValue(row, "status") ?? "not_started") as FunnelStateStatus,
    updated_at: String(rowValue(row, "updated_at")),
    user_id: String(rowValue(row, "user_id")),
  };
}

function rowToEvent(row: Row): LeadMessageEvent {
  return {
    channel: String(rowValue(row, "channel") ?? "whatsapp"),
    created_at: String(rowValue(row, "created_at")),
    event_type: String(rowValue(row, "event_type")) as MessageEventType,
    funnel_id: rowValue(row, "funnel_id") ? String(rowValue(row, "funnel_id")) : null,
    id: String(rowValue(row, "id")),
    lead_id: String(rowValue(row, "lead_id")),
    message_content: rowValue(row, "message_content") ? String(rowValue(row, "message_content")) : null,
    metadata: parseJson(rowValue(row, "metadata")),
    step_id: rowValue(row, "step_id") ? String(rowValue(row, "step_id")) : null,
    step_order: rowValue(row, "step_order") === null ? null : Number(rowValue(row, "step_order")),
    user_id: String(rowValue(row, "user_id")),
  };
}

async function executeSchema(sql: string) {
  await getTursoClient().execute(sql);
}

export async function ensureMessageFunnelSchema() {
  if (ensured) {
    return;
  }

  await executeSchema(`
    create table if not exists message_funnels (
      id text primary key,
      user_id text,
      name text not null,
      description text,
      is_default integer not null default 0,
      is_active integer not null default 1,
      metadata text not null default '{}',
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp
    )
  `);
  await executeSchema(`
    create table if not exists message_funnel_steps (
      id text primary key,
      funnel_id text not null,
      user_id text,
      step_order integer not null,
      name text not null,
      objective text,
      trigger_condition text,
      template text not null,
      fallback_template text,
      channel text not null default 'whatsapp',
      wait_hint text,
      metadata text not null default '{}',
      is_active integer not null default 1,
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp
    )
  `);
  await executeSchema(`
    create table if not exists lead_funnel_states (
      id text primary key,
      user_id text not null,
      lead_id text not null,
      funnel_id text not null,
      current_step_id text,
      current_step_order integer not null default 1,
      status text not null default 'not_started',
      last_message_at text,
      last_reply_at text,
      next_follow_up_at text,
      metadata text not null default '{}',
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp
    )
  `);
  await executeSchema(`
    create table if not exists lead_message_events (
      id text primary key,
      user_id text not null,
      lead_id text not null,
      funnel_id text,
      step_id text,
      step_order integer,
      event_type text not null,
      message_content text,
      channel text not null default 'whatsapp',
      metadata text not null default '{}',
      created_at text not null default current_timestamp
    )
  `);
  await executeSchema("create index if not exists message_funnel_steps_funnel_idx on message_funnel_steps(funnel_id, step_order)");
  await executeSchema("create unique index if not exists lead_funnel_states_user_lead_unique_idx on lead_funnel_states(user_id, lead_id)");
  await executeSchema("create index if not exists lead_message_events_user_lead_idx on lead_message_events(user_id, lead_id, created_at)");
  await seedDefaultFunnel();
  ensured = true;
}

async function seedDefaultFunnel() {
  const now = new Date().toISOString();

  await getTursoClient().execute({
    args: [
      DEFAULT_FUNNEL_ID,
      "Funil PUB Start",
      "Roteiro padrão de abordagem comercial manual da Agência PUB.",
      JSON.stringify({ source: "system_default", version: 1 }),
      now,
      now,
    ],
    sql: `
      insert into message_funnels (id, user_id, name, description, is_default, is_active, metadata, created_at, updated_at)
      values (?, null, ?, ?, 1, 1, ?, ?, ?)
      on conflict(id) do update set
        name = excluded.name,
        description = excluded.description,
        is_default = 1,
        is_active = 1,
        updated_at = excluded.updated_at
    `,
  });

  for (const [index, step] of defaultSteps.entries()) {
    const order = index + 1;

    await getTursoClient().execute({
      args: [
        `${DEFAULT_FUNNEL_ID}-step-${order}`,
        DEFAULT_FUNNEL_ID,
        order,
        step.name,
        step.objective,
        step.template,
        step.wait_hint,
        JSON.stringify({ source: "system_default", version: 1 }),
        now,
        now,
      ],
      sql: `
        insert into message_funnel_steps (
          id, funnel_id, user_id, step_order, name, objective, template, wait_hint, metadata, created_at, updated_at
        )
        values (?, ?, null, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(id) do update set
          name = excluded.name,
          objective = excluded.objective,
          template = excluded.template,
          wait_hint = excluded.wait_hint,
          is_active = 1,
          updated_at = excluded.updated_at
      `,
    });
  }
}

export async function listMessageFunnels(userId: string) {
  await ensureMessageFunnelSchema();

  const funnelsResult = await getTursoClient().execute({
    args: [userId],
    sql: "select * from message_funnels where is_active = 1 and (user_id is null or user_id = ?) order by is_default desc, datetime(created_at) asc",
  });
  const stepsResult = await getTursoClient().execute({
    args: [userId],
    sql: "select * from message_funnel_steps where is_active = 1 and (user_id is null or user_id = ?) order by step_order asc",
  });
  const steps = stepsResult.rows.map(rowToStep);

  return funnelsResult.rows.map((row) =>
    rowToFunnel(row, steps.filter((step) => step.funnel_id === String(rowValue(row, "id")))),
  );
}

export async function getMessageFunnel(userId: string, funnelId = DEFAULT_FUNNEL_ID) {
  const funnels = await listMessageFunnels(userId);

  return funnels.find((funnel) => funnel.id === funnelId) ?? funnels[0] ?? null;
}

export async function getOrCreateLeadFunnelState(userId: string, leadId: string, funnelId = DEFAULT_FUNNEL_ID) {
  await ensureMessageFunnelSchema();

  const lead = await getLeadById(userId, leadId);

  if (!lead) {
    return null;
  }

  const funnel = await getMessageFunnel(userId, funnelId);
  const firstStep = funnel?.steps[0] ?? null;
  const existing = await getTursoClient().execute({
    args: [userId, leadId],
    sql: "select * from lead_funnel_states where user_id = ? and lead_id = ? limit 1",
  });

  if (existing.rows[0]) {
    return rowToState(existing.rows[0]);
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await getTursoClient().execute({
    args: [
      id,
      userId,
      leadId,
      funnelId,
      firstStep?.id ?? null,
      firstStep?.step_order ?? 1,
      "not_started",
      "{}",
      now,
      now,
    ],
    sql: `
      insert into lead_funnel_states (
        id, user_id, lead_id, funnel_id, current_step_id, current_step_order, status, metadata, created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  });

  const created = await getTursoClient().execute({
    args: [userId, leadId],
    sql: "select * from lead_funnel_states where user_id = ? and lead_id = ? limit 1",
  });

  return created.rows[0] ? rowToState(created.rows[0]) : null;
}

export async function updateLeadFunnelState(
  userId: string,
  leadId: string,
  data: Partial<Pick<LeadFunnelState, "current_step_id" | "current_step_order" | "last_message_at" | "last_reply_at" | "metadata" | "next_follow_up_at" | "status">>,
) {
  const current = await getOrCreateLeadFunnelState(userId, leadId);

  if (!current) {
    return null;
  }

  const sets: string[] = [];
  const args: InValue[] = [];

  for (const [key, value] of Object.entries(data)) {
    sets.push(`${key} = ?`);
    args.push(key === "metadata" ? JSON.stringify(value ?? {}) : (value as InValue));
  }

  if (sets.length === 0) {
    return current;
  }

  sets.push("updated_at = ?");
  args.push(new Date().toISOString(), userId, leadId);

  await getTursoClient().execute({
    args,
    sql: `update lead_funnel_states set ${sets.join(", ")} where user_id = ? and lead_id = ?`,
  });

  const updated = await getTursoClient().execute({
    args: [userId, leadId],
    sql: "select * from lead_funnel_states where user_id = ? and lead_id = ? limit 1",
  });

  return updated.rows[0] ? rowToState(updated.rows[0]) : null;
}

export async function listLeadMessageEvents(userId: string, leadId: string) {
  await ensureMessageFunnelSchema();

  const result = await getTursoClient().execute({
    args: [userId, leadId],
    sql: "select * from lead_message_events where user_id = ? and lead_id = ? order by datetime(created_at) desc limit 50",
  });

  return result.rows.map(rowToEvent);
}

export async function createLeadMessageEvent(
  userId: string,
  lead: Lead,
  data: {
    event_type: MessageEventType;
    funnel_id?: string | null;
    message_content?: string | null;
    metadata?: Record<string, unknown>;
    step_id?: string | null;
    step_order?: number | null;
  },
) {
  await ensureMessageFunnelSchema();

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await getTursoClient().execute({
    args: [
      id,
      userId,
      lead.id,
      data.funnel_id ?? null,
      data.step_id ?? null,
      data.step_order ?? null,
      data.event_type,
      data.message_content ?? null,
      "whatsapp",
      JSON.stringify(data.metadata ?? {}),
      now,
    ],
    sql: `
      insert into lead_message_events (
        id, user_id, lead_id, funnel_id, step_id, step_order, event_type, message_content, channel, metadata, created_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  });

  if (data.event_type === "marked_sent") {
    const status: FunnelStateStatus = data.step_order && data.step_order >= 7 ? "follow_up" : "contacted";
    await updateLeadFunnelState(userId, lead.id, {
      last_message_at: now,
      status,
    });
    if (lead.status === "new" || lead.status === "qualified") {
      await updateLeadStatus(userId, lead.id, "contacted" as LeadStatus);
    }
  }

  if (data.event_type === "marked_replied") {
    await updateLeadFunnelState(userId, lead.id, {
      last_reply_at: now,
      status: "replied",
    });
    await updateLeadStatus(userId, lead.id, "responded" as LeadStatus);
  }

  if (data.event_type === "advanced_step") {
    await updateLeadFunnelState(userId, lead.id, {
      current_step_id: data.step_id ?? null,
      current_step_order: data.step_order ?? 1,
      status: data.step_order && data.step_order >= 7 ? "follow_up" : "explaining",
    });
  }

  if (data.event_type === "skipped") {
    await updateLeadFunnelState(userId, lead.id, {
      status: "paused",
    });
  }

  const result = await getTursoClient().execute({
    args: [userId, id],
    sql: "select * from lead_message_events where user_id = ? and id = ? limit 1",
  });

  return result.rows[0] ? rowToEvent(result.rows[0]) : null;
}
