import {
  messageObjectiveLabels,
  messageToneLabels,
  type MessageObjective,
  type MessageTone,
} from "@/config/whatsapp";
import type { Lead } from "@/schemas/lead";

type GenerateLeadMessageParams = {
  lead: Lead;
  userCompany: string;
  tone: MessageTone;
  objective: MessageObjective;
};

const defaultCompany = "nossa equipe";

function leadSummary(lead: Lead) {
  return [
    lead.name,
    lead.company,
    lead.category,
    lead.city,
    lead.state,
  ]
    .filter(Boolean)
    .join(" - ");
}

function mockLeadMessage({ lead, userCompany, tone, objective }: GenerateLeadMessageParams) {
  const company = userCompany.trim() || defaultCompany;
  const category = lead.category ? ` do segmento de ${lead.category}` : "";
  const city = lead.city ? ` em ${lead.city}` : "";
  const objectiveLabel = messageObjectiveLabels[objective];
  const toneLabel = messageToneLabels[tone];

  return `Olá, ${lead.name}! Tudo bem? Aqui é da ${company}. Vi que vocês atuam${category}${city} e preparei uma ideia em tom ${toneLabel} para ${objectiveLabel}. Posso te enviar um resumo rápido por aqui?`;
}

async function callOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: prompt,
      max_output_tokens: 220,
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      temperature: 0.7,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel gerar mensagem com IA.");
  }

  const payload = (await response.json()) as { output_text?: string };

  return payload.output_text?.trim() || null;
}

export async function generateLeadMessage(
  lead: Lead,
  userCompany: string,
  tone: MessageTone,
  objective: MessageObjective,
) {
  const prompt = `Crie uma mensagem curta de WhatsApp em portugues do Brasil.
Regras:
- Nao invente dados.
- Nao use promessas exageradas.
- Nao use markdown.
- Use tom ${messageToneLabels[tone]}.
- Objetivo: ${messageObjectiveLabels[objective]}.
- Empresa/remetente: ${userCompany || defaultCompany}.
- Lead: ${leadSummary(lead)}.
- Termine com uma pergunta simples para continuar a conversa.`;

  return (await callOpenAI(prompt)) ?? mockLeadMessage({ lead, userCompany, tone, objective });
}

export async function generateFollowUp(lead: Lead, previousMessage: string) {
  const prompt = `Crie um follow-up curto de WhatsApp em portugues do Brasil.
Lead: ${leadSummary(lead)}.
Mensagem anterior: ${previousMessage}.
Nao use markdown. Nao pressione demais. Termine com pergunta simples.`;

  return (
    (await callOpenAI(prompt)) ??
    `Olá, ${lead.name}! Passando só para retomar minha mensagem anterior. Faz sentido conversarmos rapidamente para eu te mostrar a ideia?`
  );
}

export async function classifyLead(lead: Lead) {
  const prompt = `Classifique este lead em portugues do Brasil como frio, morno ou quente e explique em uma frase.
Lead: ${leadSummary(lead)}.
Dados disponiveis: telefone=${lead.phone ?? "nao informado"}, site=${lead.website ?? "nao informado"}, cidade=${lead.city ?? "nao informada"}.`;

  return (
    (await callOpenAI(prompt)) ??
    `morno: ${lead.name} tem dados suficientes para abordagem inicial, mas ainda precisa de validacao comercial.`
  );
}
