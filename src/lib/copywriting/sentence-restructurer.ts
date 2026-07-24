import type { SemanticBlocks } from "./semantic-blocks";
import { hasPattern } from "./semantic-blocks";
import type { CopyDiversificationMode } from "./types";

function pick<T>(items: T[], seed: number, offset = 0) {
  return items[Math.abs(seed + offset) % items.length];
}

function listToText(items: string[]) {
  if (items.length === 0) return "";
  return items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

function sentenceList(text: string) {
  return text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((item) => item.trim()).filter(Boolean) ?? [];
}

function projectFromText(text: string, fallback: string) {
  const match = text.match(/\bProjeto\s+[^,.!?]+/i)?.[0].trim() ?? "";
  const cleaned = match.replace(/\s+(?:porque|pois|que|já|ja)\b.*$/i, "").trim();

  return cleaned || fallback;
}

function urlFromText(text: string) {
  return text.match(/https?:\/\/\S+/i)?.[0].replace(/[).,;]+$/, "") ?? "";
}

function deliveryItemsFromText(text: string, blocks: SemanticBlocks) {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const items = [...blocks.deliveryItems];

  if (/\bsite profissional\b/i.test(text) && !items.includes("site profissional")) items.push("site profissional");
  if (/\binstagram\b/i.test(text) && !items.includes("Instagram")) items.push("Instagram");
  if (/google meu neg/.test(normalized) && !items.includes("Google Meu Negócio")) items.push("Google Meu Negócio");
  if (/e-?mail corporativo|email corporativo/i.test(text) && !items.includes("e-mail corporativo")) items.push("e-mail corporativo");
  if (/whatsapp business/i.test(text) && !items.includes("WhatsApp Business")) items.push("WhatsApp Business");

  return items;
}

function externalAuthorityNames(text: string, blocks: SemanticBlocks) {
  const fromBlocks = blocks.authorityNames.filter((name) => !/ag[eê]ncia pub/i.test(name));
  const comoMatches = Array.from(text.matchAll(/\bcomo\s+(.+?)(?:\.\s|$)/gi));
  const afterComo = comoMatches.at(-1)?.[1] ?? text.match(/\bcom\s+(.+?)(?:\.\s|$)/i)?.[1] ?? "";
  const fromText = afterComo
    .replace(/^marcas\s+e\s+nomes\s+como\s+/i, "")
    .split(/,\s*|\s+e\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 2 && !/ag[eê]ncia pub|site do servi[cç]o|marcas|nomes|https?:/i.test(item))
    .slice(0, 8);

  return Array.from(new Set([...fromBlocks, ...fromText]));
}

function scarcityCount(text: string, blocks: SemanticBlocks) {
  return text.match(/\b(?:apenas|somente|s[oó])\s+\d+\b/i)?.[0] ?? blocks.numbers[0] ?? "poucas";
}

function firstIntroSentence(text: string) {
  return sentenceList(text).find((sentence) => /representante|me chamo|eu sou|aqui [eé]/i.test(sentence)) ?? "";
}

function rewriteIntroduction(input: RewriteInput) {
  const company = input.blocks.leadName || "A empresa";
  const project = projectFromText(input.original, input.blocks.project);
  const intro = firstIntroSentence(input.original);
  const selection = [
    `${company} entrou na seleção do ${project} porque vimos uma oportunidade clara no posicionamento digital de vocês.`,
    `O motivo do contato é que ${company} foi selecionada para o ${project} por uma oportunidade clara no posicionamento digital.`,
    `Chamamos vocês porque ${company} foi escolhida para o ${project}, já que existe uma oportunidade real de melhorar a presença digital.`,
  ];
  const value = [
    "Vocês já entregam valor no mercado, mas a forma como aparecem no digital pode estar reduzindo procura, contatos e vendas.",
    "A empresa já tem valor no mercado; o ponto é que a presença digital atual pode estar travando procura, contatos e vendas.",
    "O negócio já entrega valor, mas o posicionamento digital pode estar fazendo vocês perderem oportunidades de contato e venda.",
  ];
  const cta = [
    "Posso te explicar melhor?",
    "Posso te mostrar rapidamente como funciona?",
    "Faz sentido eu te explicar em poucas palavras?",
  ];
  const applied = ["funnel_step_introduction", "selection_preserved", "permission_cta_preserved"];
  const paragraphs = [intro, pick(selection, input.seed, 1)];

  if (/procura|contatos|vendas|valor no mercado|posicionamento digital/i.test(input.original)) {
    paragraphs.push(pick(value, input.seed, 2));
    applied.push("value_context_preserved");
  }

  paragraphs.push(pick(cta, input.seed, 3));
  return { applied, text: paragraphs.filter(Boolean).join("\n\n") };
}

function rewriteExplanation(input: RewriteInput) {
  const deliveryItems = deliveryItemsFromText(input.original, input.blocks);
  const items = deliveryItems.length > 0 ? listToText(deliveryItems) : "";
  const deadline = input.blocks.deadline ? `, com entrega em ${input.blocks.deadline}` : "";
  const opening = [
    "A proposta é fortalecer a presença digital de empresas que já têm valor no mercado.",
    "O projeto atende negócios com boa base, mas que ainda podem evoluir muito no digital.",
    "A ideia é deixar a presença digital mais compatível com o valor que a empresa já entrega.",
  ];
  const delivery = items
    ? [
        `Na prática, a estrutura contempla ${items}${deadline}.`,
        `Vocês recebem ${items}${deadline}.`,
        `O pacote monta a base digital com ${items}${deadline}.`,
      ]
    : [];
  const paragraphs = [pick(opening, input.seed, 1), delivery.length ? pick(delivery, input.seed, 2) : ""].filter(Boolean);

  return { applied: ["funnel_step_explanation", "delivery_preserved", "deadline_preserved"], text: paragraphs.join("\n\n") };
}

function rewriteAuthority(input: RewriteInput) {
  const names = externalAuthorityNames(input.original, input.blocks);
  const namesText = names.length > 0 ? listToText(names) : "marcas e nomes relevantes";
  const url = urlFromText(input.original);
  const authority = [
    `A estrutura é conduzida pela Agência PUB, que já atuou com nomes como ${namesText}.`,
    `Quem assina o projeto é a Agência PUB, com histórico de trabalhos ligados a ${namesText}.`,
    `A entrega fica com a Agência PUB, que já participou de projetos com ${namesText}.`,
  ];
  const site = url ? [`O site do serviço é ${url}`, `Referência do serviço: ${url}`, `Você pode ver o serviço aqui: ${url}`] : [];
  const paragraphs = [pick(authority, input.seed, 1), site.length ? pick(site, input.seed, 2) : ""].filter(Boolean);

  return { applied: ["funnel_step_authority", "authority_names_preserved", "service_url_preserved"], text: paragraphs.join("\n\n") };
}

function rewriteScarcity(input: RewriteInput) {
  const count = scarcityCount(input.original, input.blocks);
  const competitor = /concorrente|mesmo segmento|mesmo mercado/i.test(input.original);
  const endings = competitor
    ? ["possivelmente um concorrente direto.", "talvez uma empresa do mesmo segmento.", "possivelmente outro negócio da mesma categoria."]
    : ["outra empresa da lista.", "a próxima empresa selecionada.", "outro negócio selecionado."];
  const variants = [
    `Nesta etapa, são ${count} empresas selecionadas. Se não fizer sentido para vocês, a vaga segue para ${pick(endings, input.seed, 1)}`,
    `Como são ${count} empresas nessa seleção, se não for prioridade agora seguimos para ${pick(endings, input.seed, 2)}`,
    `A lista desta etapa é limitada a ${count} empresas. Caso vocês não queiram avançar, chamamos ${pick(endings, input.seed, 3)}`,
  ];

  return { applied: ["funnel_step_scarcity", "scarcity_preserved", competitor ? "competitor_preserved" : "list_preserved"], text: pick(variants, input.seed, 4) };
}

function rewriteCta(input: RewriteInput) {
  const hasValues = /valores|pre[cç]os?|investimento/i.test(input.original);
  const detail = hasValues ? "os detalhes da entrega e valores" : "os detalhes";
  const variants = [
    `Posso te passar ${detail}?`,
    `Faz sentido eu te enviar ${detail}?`,
    `Quer que eu te mande ${detail} agora?`,
    `Posso te explicar o próximo passo e mandar ${detail}?`,
  ];

  return { applied: ["funnel_step_cta", hasValues ? "values_preserved" : "details_preserved"], text: pick(variants, input.seed, 1) };
}

function rewriteFollowUp(input: RewriteInput) {
  const project = projectFromText(input.original, input.blocks.project);
  const variants = [
    `Passando só para confirmar se ainda faz sentido falar sobre o ${project}.`,
    `Só retomando por aqui: ainda faz sentido eu te explicar melhor o ${project}?`,
    `Último toque sobre o ${project}. Se quiserem avançar, me responde por aqui.`,
  ];

  return { applied: ["funnel_step_follow_up"], text: pick(variants, input.seed, 1) };
}

type RewriteInput = {
  blocks: SemanticBlocks;
  mode: CopyDiversificationMode;
  original: string;
  seed: number;
  stepName?: string | null;
};

const greetings = ["Oi, tudo bem?", "Olá, tudo certo?", "Bom dia, tudo certo?", "Oi! Como vai?"];

function rewriteFunnelStep(input: RewriteInput) {
  const step = (input.stepName ?? "").toLowerCase();

  if (/primeiro|contato/.test(step) && input.original.length <= 120) {
    return { applied: ["funnel_step_greeting"], text: pick(greetings, input.seed) };
  }

  if (/introdu/.test(step)) return rewriteIntroduction(input);
  if (/explica/.test(step)) return rewriteExplanation(input);
  if (/autoridade/.test(step)) return rewriteAuthority(input);
  if (/escassez/.test(step)) return rewriteScarcity(input);
  if (/\bcta\b|pr[oó]ximo passo|decis/.test(step)) return rewriteCta(input);
  if (/follow/.test(step)) return rewriteFollowUp(input);

  return null;
}

export function rewriteByCommercialStructure(input: RewriteInput) {
  if (input.mode === "funnel_step") {
    const stepRewrite = rewriteFunnelStep(input);
    if (stepRewrite) return stepRewrite;
  }

  const applied: string[] = ["semantic_blocks"];
  const paragraphs: string[] = [];

  if (hasPattern(input.blocks, "greeting") && input.mode !== "balanced") {
    paragraphs.push(pick(greetings, input.seed));
    applied.push("greeting");
  }

  if (hasPattern(input.blocks, "selection")) {
    const subject = input.blocks.leadName || "A empresa";
    paragraphs.push(pick([
      `${subject} entrou na lista de empresas selecionadas para o ${input.blocks.project}.`,
      `Te procurei porque ${subject} foi selecionada para o ${input.blocks.project}.`,
      `${subject} foi escolhida para esta etapa do ${input.blocks.project}.`,
    ], input.seed, 1));
    applied.push("selection_restructure");
  }

  if (hasPattern(input.blocks, "opportunity")) {
    paragraphs.push(pick([
      "A ideia é ajudar negócios que já têm valor no mercado, mas ainda podem evoluir na estrutura digital.",
      "Identificamos uma oportunidade clara de melhorar o posicionamento digital sem mudar a essência do negócio.",
      "O ponto é transformar o que vocês já construíram em uma presença digital mais forte e fácil de encontrar.",
    ], input.seed, 2));
    applied.push("opportunity_restructure");
  }

  if (input.blocks.deliveryItems.length > 0) {
    const items = listToText(input.blocks.deliveryItems);
    const deadline = input.blocks.deadline ? `, com entrega em ${input.blocks.deadline}` : "";
    paragraphs.push(pick([
      `Na prática, a estrutura contempla ${items}${deadline}.`,
      `Vocês recebem ${items}${deadline}.`,
      `O pacote monta a base digital com ${items}${deadline}.`,
    ], input.seed, 3));
    applied.push("delivery_restructure");
  }

  if (hasPattern(input.blocks, "authority")) {
    const names = externalAuthorityNames(input.original, input.blocks);
    const namesText = names.length > 0 ? listToText(names) : "nomes relevantes";
    paragraphs.push(`A entrega é conduzida pela Agência PUB, que já atuou com ${namesText}.`);
    applied.push("authority_preserved");
  }

  if (hasPattern(input.blocks, "scarcity")) {
    paragraphs.push(pick([
      "Como a lista é limitada, se não fizer sentido seguimos para a próxima empresa.",
      "Se não for prioridade agora, a vaga pode seguir para outra empresa da lista.",
      "Por serem poucas vagas, precisamos avançar apenas com quem fizer sentido nesta etapa.",
    ], input.seed, 4));
    applied.push("scarcity_preserved");
  }

  if (hasPattern(input.blocks, "permission_cta") || input.blocks.hasQuestion) {
    paragraphs.push(pick([
      "Posso te explicar rapidamente?",
      "Faz sentido eu te mostrar como funciona?",
      "Quer que eu te mande os detalhes?",
      "Posso te passar as informações?",
    ], input.seed, 5));
    applied.push("cta_preserved");
  }

  if (paragraphs.length === 0) {
    return { applied: ["fallback_original_structure"], text: input.original };
  }

  if (input.mode === "ultra_short") {
    return { applied: [...applied, "ultra_short_compaction"], text: [paragraphs[0], paragraphs.at(-1)].filter(Boolean).join("\n\n") };
  }

  return { applied, text: paragraphs.join("\n\n") };
}
