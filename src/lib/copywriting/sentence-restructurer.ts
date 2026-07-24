import type { SemanticBlocks } from "./semantic-blocks";
import { hasPattern } from "./semantic-blocks";
import type { CopyDiversificationMode } from "./types";

function pick<T>(items: T[], seed: number, offset = 0) {
  return items[Math.abs(seed + offset) % items.length];
}

function listToText(items: string[]) {
  if (items.length === 0) {
    return "";
  }

  return items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

const greetings = ["Oi, tudo bem?", "Olá, tudo certo?", "Bom dia, tudo certo?", "Oi! Como vai?"];

export function rewriteByCommercialStructure(input: {
  blocks: SemanticBlocks;
  mode: CopyDiversificationMode;
  original: string;
  seed: number;
  stepName?: string | null;
}) {
  const applied: string[] = ["semantic_blocks"];
  const paragraphs: string[] = [];
  const step = (input.stepName ?? "").toLowerCase();
  const isGreetingStep = input.mode === "funnel_step" && /primeiro|contato/.test(step) && input.original.length <= 120;

  if (isGreetingStep) {
    return {
      applied: ["funnel_step_greeting"],
      text: pick(greetings, input.seed),
    };
  }

  if (hasPattern(input.blocks, "greeting") && input.mode !== "balanced") {
    paragraphs.push(pick(greetings, input.seed));
    applied.push("greeting");
  }

  if (hasPattern(input.blocks, "selection")) {
    const subject = input.blocks.leadName || "A empresa";
    const selectionVariants = [
      `${subject} entrou na lista de empresas selecionadas para o ${input.blocks.project}.`,
      `Te procurei porque ${subject} foi selecionada para o ${input.blocks.project}.`,
      `${subject} foi escolhida para esta etapa do ${input.blocks.project}.`,
    ];
    paragraphs.push(pick(selectionVariants, input.seed, 1));
    applied.push("selection_restructure");
  }

  if (hasPattern(input.blocks, "opportunity")) {
    const opportunityVariants = [
      "A ideia é ajudar negócios que já têm valor no mercado, mas ainda podem evoluir na estrutura digital.",
      "Identificamos uma oportunidade clara de melhorar o posicionamento digital sem mudar a essência do negócio.",
      "O ponto é transformar o que vocês já construíram em uma presença digital mais forte e fácil de encontrar.",
    ];
    paragraphs.push(pick(opportunityVariants, input.seed, 2));
    applied.push("opportunity_restructure");
  }

  if (input.blocks.deliveryItems.length > 0) {
    const items = listToText(input.blocks.deliveryItems);
    const deadline = input.blocks.deadline ? `, com entrega em ${input.blocks.deadline}` : "";
    const deliveryVariants = [
      `Na prática, a estrutura contempla ${items}${deadline}.`,
      `Vocês recebem ${items}${deadline}.`,
      `O pacote monta a base digital com ${items}${deadline}.`,
    ];
    paragraphs.push(pick(deliveryVariants, input.seed, 3));
    applied.push("delivery_restructure");
  }

  if (hasPattern(input.blocks, "authority")) {
    const names = input.blocks.authorityNames.length > 0 ? listToText(input.blocks.authorityNames) : "nomes relevantes";
    paragraphs.push(`A entrega é conduzida pela Agência PUB, que já atuou com ${names}.`);
    applied.push("authority_preserved");
  }

  if (hasPattern(input.blocks, "scarcity")) {
    const scarcityVariants = [
      "Como a lista é limitada, se não fizer sentido seguimos para a próxima empresa.",
      "Se não for prioridade agora, a vaga pode seguir para outra empresa da lista.",
      "Por serem poucas vagas, precisamos avançar apenas com quem fizer sentido nesta etapa.",
    ];
    paragraphs.push(pick(scarcityVariants, input.seed, 4));
    applied.push("scarcity_preserved");
  }

  if (hasPattern(input.blocks, "permission_cta") || input.blocks.hasQuestion) {
    const ctaVariants = [
      "Posso te explicar rapidamente?",
      "Faz sentido eu te mostrar como funciona?",
      "Quer que eu te mande os detalhes?",
      "Posso te passar as informações?",
    ];
    paragraphs.push(pick(ctaVariants, input.seed, 5));
    applied.push("cta_preserved");
  }

  if (paragraphs.length === 0) {
    return { applied: ["fallback_original_structure"], text: input.original };
  }

  if (input.mode === "high_variation" && paragraphs.length > 3) {
    const cta = paragraphs.pop();
    const first = paragraphs.shift();
    if (first) {
      paragraphs.splice(Math.min(2, paragraphs.length), 0, first);
      applied.push("paragraph_reorder");
    }
    if (cta) {
      paragraphs.push(cta);
    }
  }

  if (input.mode === "ultra_short") {
    return {
      applied: [...applied, "ultra_short_compaction"],
      text: [paragraphs[0], paragraphs.at(-1)].filter(Boolean).join("\n\n"),
    };
  }

  return { applied, text: paragraphs.join("\n\n") };
}
