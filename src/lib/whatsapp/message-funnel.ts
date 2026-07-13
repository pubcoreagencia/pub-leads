import type { User } from "@supabase/supabase-js";

import type { Lead } from "@/schemas/lead";
import type { MessageFunnelStep } from "@/src/lib/turso/message-funnels-repository";

export type RenderFunnelMessageInput = {
  context?: {
    city?: string | null;
    funnelName?: string | null;
    niche?: string | null;
    operatorName?: string | null;
    plan?: string | null;
    project?: string | null;
  };
  lead: Lead;
  template: string;
  user?: Pick<User, "email" | "user_metadata"> | null;
};

export type DiversifyFunnelStepMessageInput = {
  lead: Lead;
  renderedMessage: string;
  step: MessageFunnelStep;
  variantSeed?: number;
};

function cleanText(value: string) {
  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function leadCompany(lead: Lead) {
  return lead.company || lead.business_name || lead.fantasy_name || lead.name || "sua empresa";
}

function operatorName(user?: Pick<User, "email" | "user_metadata"> | null, fallback?: string | null) {
  const metadataName = user?.user_metadata?.full_name || user?.user_metadata?.name;

  if (typeof fallback === "string" && fallback.trim()) {
    return fallback.trim();
  }

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  return user?.email?.split("@")[0] || "representante da Agência PUB";
}

function instagramValue(lead: Lead) {
  const metadata = lead.metadata ?? {};
  const handle = typeof metadata.instagram_handle === "string" ? metadata.instagram_handle : "";
  const url = typeof metadata.instagram_url === "string" ? metadata.instagram_url : "";

  return handle ? `@${handle.replace(/^@/, "")}` : url;
}

function replaceToken(text: string, tokens: string[], value: string) {
  return tokens.reduce((current, token) => current.replaceAll(token, value), text);
}

function replaceRegexTokens(text: string, patterns: RegExp[], value: string) {
  return patterns.reduce((current, pattern) => current.replace(pattern, value), text);
}

export function renderFunnelMessage({ context, lead, template, user }: RenderFunnelMessageInput) {
  const company = leadCompany(lead);
  const city = context?.city || lead.city || "sua cidade";
  const niche = context?.niche || lead.category || "seu nicho";
  const operator = operatorName(user, context?.operatorName);
  const project = context?.project || (city ? `Projeto ${city}` : "Projeto PUB Start");

  let message = template;

  message = replaceToken(message, ["{empresa}", "{lead}"], company);
  message = replaceRegexTokens(message, [/\bEMPRESA\b/g, /\bLEAD\b/g], company);
  message = replaceToken(message, ["{cidade}"], city);
  message = replaceRegexTokens(message, [/\bCIDADE\b/g], city);
  message = replaceToken(message, ["{nicho}", "{copy}"], niche);
  message = replaceRegexTokens(message, [/\bNICHO\b/g, /\bCOPY\b/g], niche);
  message = replaceToken(message, ["{operador}"], operator);
  message = replaceToken(message, ["{telefone}"], lead.whatsapp || lead.phone || lead.phone_2 || "");
  message = replaceToken(message, ["{site}"], lead.website || "");
  message = replaceToken(message, ["{instagram}"], instagramValue(lead));
  message = replaceToken(message, ["{plano}"], context?.plan || "");
  message = replaceToken(message, ["{projeto}"], project);

  message = message.replace(/\{[a-zA-Z_]+\}/g, "");

  return cleanText(message);
}

const stepVariations: Record<number, string[]> = {
  1: ["Oi, bom dia!", "Olá, tudo bem?", "Bom dia, tudo certo?", "Oi, tudo bem?"],
  2: [
    "Tudo bem? Aqui é a {operador}, da Agência PUB. A {empresa} entrou na lista das 5 empresas de {nicho} selecionadas para o {projeto}. Posso te explicar rapidinho?",
    "Oi! Sou a {operador}, representante da Agência PUB. Estamos falando com a {empresa} porque vocês foram selecionados entre as 5 empresas de {nicho} para o {projeto}. Posso explicar em poucas palavras?",
    "Tudo certo? Eu sou a {operador}, da Agência PUB. A {empresa} foi selecionada entre 5 empresas de {nicho} para o {projeto}. Posso te contar como funciona?",
  ],
  3: [
    "O projeto é para empresas já consolidadas que ainda podem ter uma presença digital mais profissional. A entrega inclui site, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business, tudo pronto em 3 a 7 dias.",
    "A ideia é estruturar a presença digital de empresas com boa base no mercado. Entram site profissional, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business, com entrega em 3 a 7 dias.",
    "Na prática, o projeto organiza site profissional, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business para deixar a empresa mais bem posicionada em 3 a 7 dias.",
  ],
  4: [
    "A estrutura é feita pela Agência PUB, que já atuou com nomes como L'Oréal Paris, Globosat, Circo Voador, Gabriel Pensador, Diogo Defante e Paulinho Serra.",
    "Quem conduz é a Agência PUB, com histórico junto a marcas e nomes como L'Oréal Paris, Globosat, Circo Voador, Gabriel Pensador, Diogo Defante e Paulinho Serra.",
    "O projeto é conduzido pela Agência PUB, que já trabalhou com marcas, empresas e artistas como L'Oréal Paris, Globosat, Circo Voador, Gabriel Pensador, Diogo Defante e Paulinho Serra.",
  ],
  5: [
    "São poucas vagas nesta etapa. Se não fizer sentido para vocês, seguimos para a próxima empresa da lista, possivelmente um concorrente direto.",
    "Como são só 5 empresas selecionadas, se vocês não quiserem avançar, a vaga vai para outra empresa do mesmo mercado.",
    "A lista é limitada. Caso não seja uma prioridade agora, liberamos a vaga para a próxima empresa selecionada, talvez um concorrente direto.",
  ],
  6: [
    "Gostaríamos muito que fossem vocês. Posso te passar os detalhes da entrega e valores?",
    "Faz sentido eu te mostrar a entrega e os valores para vocês avaliarem?",
    "Posso te enviar os detalhes de como funcionaria para a {empresa}?",
  ],
  7: [
    "Passando só para confirmar se fez sentido eu te explicar melhor o {projeto}. Ainda estamos organizando as empresas selecionadas dessa etapa.",
    "Só retomando por aqui: ainda estamos fechando a lista do {projeto}. Faz sentido eu te explicar melhor?",
    "Voltei rapidinho para saber se vocês querem entender melhor o {projeto} antes de seguirmos com a lista.",
  ],
  8: [
    "Como são poucas vagas, vou precisar seguir com a próxima empresa da lista caso não seja uma prioridade para vocês agora. Mas gostaríamos bastante que a {empresa} participasse.",
    "Vou encerrar essa tentativa por aqui se não for prioridade agora, porque a lista é curta. Ainda assim, seria ótimo contar com a {empresa}.",
    "Último toque por aqui: se não fizer sentido agora, seguimos para outra empresa selecionada. Mas a nossa preferência seria avançar com a {empresa}.",
  ],
};

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function diversifyFunnelStepMessage({
  lead,
  renderedMessage,
  step,
  variantSeed = 1,
}: DiversifyFunnelStepMessageInput) {
  const variations = stepVariations[step.step_order];

  if (!variations || variations.length === 0) {
    return renderedMessage;
  }

  const index = (hashText(`${lead.id}|${step.id}|${variantSeed}`) + variantSeed) % variations.length;

  return variations[index];
}
