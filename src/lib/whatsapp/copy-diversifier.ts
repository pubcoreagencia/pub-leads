import type { Lead } from "@/schemas/lead";

export type DiversifyBaseCopyInput = {
  baseCopy?: string;
  city?: string | null;
  copyBase?: string;
  lead?: Lead;
  leadName?: string | null;
  niche?: string | null;
  variantSeed?: number;
};

export type DiversificationReport = {
  message: string;
  originalWithPlaceholders: string;
  placeholdersRemaining: string[];
  protectedTermsMissing: string[];
  sentenceChanges: number;
  identicalParagraphRatio: number;
  transformationsApplied: number;
  diversificationScore: number;
};

type Replacement = string | ((match: string, ...groups: string[]) => string);

type RewriteRule = {
  id: string;
  pattern: RegExp;
  variants: Replacement[];
};

type RewriteResult = {
  appliedIds: string[];
  text: string;
};

const protectedTerms = [
  "Agencia PUB",
  "Agência PUB",
  "L'Oreal Paris",
  "L'Oréal Paris",
  "Globosat",
  "Circo Voador",
  "Gabriel Pensador",
  "Diogo Defante",
  "Paulinho Serra",
  "Site estruturado",
  "Instagram profissional",
  "Google Meu Negocio estruturado",
  "Google Meu Negócio estruturado",
  "e-mail corporativo",
  "WhatsApp Business",
];

const rewriteRules: RewriteRule[] = [
  {
    id: "project-interviews",
    pattern: /Estamos atualmente realizando entrevistas para o nosso Projeto ([^,\n.!]+)/i,
    variants: [
      "No momento, estamos conduzindo entrevistas para o nosso Projeto $1",
      "Estamos em fase de entrevistas para o nosso Projeto $1",
      "Atualmente, estamos selecionando empresas para o nosso Projeto $1",
    ],
  },
  {
    id: "project-cycle",
    pattern: /Esse projeto (?:é|e) aberto semestralmente/i,
    variants: [
      "Esse projeto abre apenas uma vez por semestre",
      "Essa iniciativa é liberada semestralmente",
      "Abrimos esse projeto em ciclos semestrais",
    ],
  },
  {
    id: "consolidated-business",
    pattern: /empresas j(?:á|a) consolidadas no mercado/i,
    variants: [
      "empresas que já têm presença consolidada no mercado",
      "negócios que já demonstram consistência no mercado",
      "empresas que já construíram uma base sólida",
    ],
  },
  {
    id: "digital-presence",
    pattern: /mas que ainda n(?:ã|a)o possuem uma presen(?:ç|c)a digital estruturada no n(?:í|i)vel que o neg(?:ó|o)cio merece/i,
    variants: [
      "mas que ainda não têm uma estrutura digital proporcional ao valor do negócio",
      "mas que ainda não estão posicionadas digitalmente no nível que poderiam",
      "mas que ainda não contam com uma presença digital à altura do que já construíram",
    ],
  },
  {
    id: "selected-five",
    pattern: /Selecionamos nessa etapa apenas 5 empresas/i,
    variants: [
      "Nesta etapa, selecionamos somente 5 empresas",
      "Para essa fase, separamos apenas 5 empresas",
      "Neste ciclo, estamos trabalhando com apenas 5 empresas",
    ],
  },
  {
    id: "strong-potential",
    pattern: /com grande potencial em ([^.!\n]+)/i,
    variants: [
      "com forte potencial em $1",
      "com potencial claro de destaque em $1",
      "com grande possibilidade de crescimento em $1",
    ],
  },
  {
    id: "first-contact",
    pattern: /Estamos entrando em contato com voc(?:ê|e)s primeiro/i,
    variants: [
      "Por isso, estamos falando com vocês antes dos demais",
      "Estamos priorizando esse contato com vocês",
      "Decidimos entrar em contato com vocês primeiro",
    ],
  },
  {
    id: "value-built",
    pattern: /porque enxergamos muito valor no trabalho que voc(?:ê|e)s j(?:á|a) v(?:ê|e)m construindo/i,
    variants: [
      "porque vemos valor real no trabalho que vocês já construíram",
      "porque percebemos uma base muito forte no que vocês vêm construindo",
      "porque o trabalho de vocês já demonstra um potencial claro",
    ],
  },
  {
    id: "delivery-label",
    pattern: /A entrega inclui:/i,
    variants: [
      "A estrutura entregue inclui:",
      "Na prática, a entrega contempla:",
      "O pacote de estruturação inclui:",
    ],
  },
  {
    id: "delivery-time",
    pattern: /tudo pronto em apenas 3 a 7 dias/i,
    variants: [
      "com tudo entregue em apenas 3 a 7 dias",
      "com a estrutura pronta em 3 a 7 dias",
      "e tudo isso fica pronto em um prazo de 3 a 7 dias",
    ],
  },
  {
    id: "pub-structure",
    pattern: /Voc(?:ê|e)s ter(?:ã|a)o a empresa estruturada pela Ag(?:ê|e)ncia PUB/i,
    variants: [
      "A estruturação será feita pela Agência PUB",
      "A empresa de vocês será estruturada pela Agência PUB",
      "Todo o processo será conduzido pela Agência PUB",
    ],
  },
  {
    id: "pub-authority",
    pattern: /que cuida e j(?:á|a) trabalhou com marcas, empresas e artistas como/i,
    variants: [
      "que já atuou com marcas, empresas e artistas como",
      "que tem histórico com marcas, empresas e artistas como",
      "que carrega experiência com marcas, empresas e artistas como",
    ],
  },
  {
    id: "no-interest",
    pattern: /Caso n(?:ã|a)o haja interesse/i,
    variants: [
      "Se não fizer sentido para vocês neste momento",
      "Caso vocês não queiram seguir com essa vaga",
      "Se vocês preferirem não avançar agora",
    ],
  },
  {
    id: "vacancy-next",
    pattern: /a vaga ser(?:á|a) repassada imediatamente para a pr(?:ó|o)xima empresa da lista/i,
    variants: [
      "a vaga será imediatamente liberada para a próxima empresa da lista",
      "seguiremos imediatamente com a próxima empresa selecionada da lista",
      "a oportunidade será repassada imediatamente para outra empresa da lista",
    ],
  },
  {
    id: "direct-competitor",
    pattern: /muito provavelmente um concorrente direto/i,
    variants: [
      "possivelmente um concorrente direto",
      "com grande chance de ser um concorrente direto",
      "provavelmente alguém que disputa o mesmo mercado",
    ],
  },
  {
    id: "preference",
    pattern: /N(?:ó|o)s gostar(?:í|i)amos muito que fossem voc(?:ê|e)s!/i,
    variants: [
      "Nossa preferência seria avançar com vocês.",
      "Sinceramente, gostaríamos que essa vaga ficasse com vocês.",
      "A nossa intenção é que essa oportunidade seja de vocês.",
    ],
  },
  {
    id: "final-cta",
    pattern: /Se tiverem alguma d(?:ú|u)vida a respeito, estarei aqui (?:à|a) disposi(?:ç|c)(?:ã|a)o\./i,
    variants: [
      "Se surgir qualquer dúvida, fico à disposição por aqui.",
      "Qualquer dúvida sobre o projeto, posso explicar melhor por aqui.",
      "Se quiserem entender melhor, estou à disposição para esclarecer.",
    ],
  },
  {
    id: "common-details-cta",
    pattern: /posso te enviar mais detalhes\?/i,
    variants: [
      "quer que eu te envie mais detalhes?",
      "posso te mandar os detalhes por aqui?",
      "quer que eu te mande mais detalhes?",
    ],
  },
  {
    id: "great-potential",
    pattern: /grande potencial/i,
    variants: ["forte potencial", "potencial claro", "potencial relevante"],
  },
  {
    id: "makes-sense",
    pattern: /caso fa(?:ç|c)a sentido/i,
    variants: ["se fizer sentido", "se fizer sentido para vocês", "caso isso faça sentido"],
  },
];

function normalizeForCompare(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanInlineText(value: string) {
  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function leadCompany(lead: Lead | undefined, explicitLeadName?: string | null) {
  return (
    explicitLeadName?.trim() ||
    lead?.company ||
    lead?.business_name ||
    lead?.fantasy_name ||
    lead?.name ||
    "Vocês"
  );
}

function leadPhone(lead: Lead | undefined) {
  return lead?.whatsapp || lead?.phone || lead?.phone_2 || "";
}

function replaceAllPatterns(value: string, patterns: RegExp[], replacement: string) {
  return patterns.reduce((current, pattern) => current.replace(pattern, replacement), value);
}

function replacePlaceholders(input: DiversifyBaseCopyInput) {
  const lead = input.lead;
  const baseCopy = input.baseCopy ?? input.copyBase ?? "";
  const leadDisplayName = leadCompany(lead, input.leadName);
  const city = input.city?.trim() || lead?.city || "";
  const niche = input.niche?.trim() || lead?.category || "";
  const site = lead?.website || "";
  const phone = leadPhone(lead);

  let message = baseCopy;

  message = replaceAllPatterns(message, [/\{cidade\}/gi, /\[CIDADE\]/g, /\bCIDADE\b/g], city);
  message = replaceAllPatterns(
    message,
    [/\{nicho\}/gi, /\[NICHO\]/g, /\bNICHO\b/g, /\{copy\}/gi, /\[COPY\]/g, /\bCOPY\b/g],
    niche,
  );
  message = replaceAllPatterns(
    message,
    [/\{lead\}/gi, /\[LEAD\]/g, /\bLEAD\b/g, /\{empresa\}/gi, /\[EMPRESA\]/g, /\bEMPRESA\b/g],
    leadDisplayName,
  );
  message = replaceAllPatterns(message, [/\{nome\}/gi], lead?.name || leadDisplayName);
  message = replaceAllPatterns(message, [/\{telefone\}/gi], phone);
  message = replaceAllPatterns(message, [/\{site\}/gi], site);

  return {
    leadDisplayName,
    text: cleanInlineText(message),
  };
}

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function pickReplacement(variants: Replacement[], seed: number, index: number) {
  return variants[(seed + index) % variants.length];
}

function applyRules(text: string, rules: RewriteRule[], seed: number): RewriteResult {
  let nextText = text;
  const appliedIds: string[] = [];

  rules.forEach((rule, index) => {
    const replacement = pickReplacement(rule.variants, seed, index);
    const before = nextText;

    if (typeof replacement === "function") {
      nextText = nextText.replace(rule.pattern, (...args: string[]) => {
        return replacement(args[0], ...args.slice(1, -2));
      });
    } else {
      nextText = nextText.replace(rule.pattern, replacement);
    }

    if (nextText !== before) {
      appliedIds.push(rule.id);
    }
  });

  return {
    appliedIds,
    text: nextText,
  };
}

function varyGreeting(text: string, seed: number): RewriteResult {
  const variants = [
    "Oi, tudo bem?\n\n",
    "Olá, tudo bem?\n\n",
    "Oi!\n\n",
  ];
  const before = text;
  const next = text.replace(/^Ol[áa],?\s*/i, variants[seed % variants.length]);

  return {
    appliedIds: next === before ? [] : ["greeting"],
    text: next,
  };
}

function fixLeadGrammar(text: string, leadName: string, seed: number): RewriteResult {
  if (!leadName || leadName === "Vocês") {
    return { appliedIds: [], text };
  }

  const escapedLeadName = escapeRegExp(leadName);
  const variants = [
    `a empresa ${leadName} foi uma das selecionadas nesta primeira etapa`,
    `${leadName} está entre as empresas selecionadas nesta primeira fase`,
    `a empresa ${leadName} foi uma das escolhidas para essa etapa inicial`,
  ];
  const pattern = new RegExp(
    `a\\s+${escapedLeadName}\\s+foram\\s+uma\\s+das\\s+empresas\\s+selecionadas\\s+em\\s+primeiro\\s+lugar`,
    "i",
  );
  const before = text;
  const next = text.replace(pattern, variants[seed % variants.length]);

  return {
    appliedIds: next === before ? [] : ["lead-grammar"],
    text: next,
  };
}

function splitSentences(paragraph: string) {
  return paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()) ?? [];
}

function lightlyReorderParagraphs(text: string, seed: number): RewriteResult {
  const paragraphs = text.split(/\n{2,}/);
  let changed = false;
  const nextParagraphs = paragraphs.map((paragraph, index) => {
    if ((seed + index) % 3 !== 0) {
      return paragraph;
    }

    const sentences = splitSentences(paragraph);

    if (sentences.length !== 2 || paragraph.includes("+") || normalizeForCompare(paragraph).includes("agencia pub")) {
      return paragraph;
    }

    changed = true;
    return `${sentences[0]}\n${sentences[1]}`;
  });

  return {
    appliedIds: changed ? ["paragraph-structure"] : [],
    text: nextParagraphs.join("\n\n"),
  };
}

function extractNumbers(value: string) {
  return Array.from(new Set(value.match(/\d+(?:\s*(?:a|e|-)\s*\d+)?/g) ?? []));
}

function extractProtectedTerms(original: string) {
  const normalizedOriginal = normalizeForCompare(original);
  const terms = protectedTerms.filter((term) => normalizedOriginal.includes(normalizeForCompare(term)));

  return Array.from(new Set([...terms, ...extractNumbers(original)]));
}

function findMissingProtectedTerms(original: string, diversified: string) {
  const normalizedDiversified = normalizeForCompare(diversified);

  return extractProtectedTerms(original).filter(
    (term) => !normalizedDiversified.includes(normalizeForCompare(term)),
  );
}

function findRemainingPlaceholders(value: string) {
  const matches =
    value.match(
      /\[(?:CIDADE|NICHO|COPY|LEAD|EMPRESA)\]|\{(?:cidade|CIDADE|nicho|NICHO|copy|COPY|lead|LEAD|empresa|EMPRESA)\}|\b(?:CIDADE|NICHO|COPY|LEAD|EMPRESA)\b/g,
    ) ?? [];

  return Array.from(new Set(matches));
}

function countChangedSentences(original: string, diversified: string) {
  const originalSentences = splitSentences(original.replace(/\n+/g, " "));
  const diversifiedSentences = splitSentences(diversified.replace(/\n+/g, " "));
  const maxLength = Math.max(originalSentences.length, diversifiedSentences.length);
  let changed = 0;

  for (let index = 0; index < maxLength; index += 1) {
    if (normalizeForCompare(originalSentences[index] ?? "") !== normalizeForCompare(diversifiedSentences[index] ?? "")) {
      changed += 1;
    }
  }

  return changed;
}

function identicalParagraphRatio(original: string, diversified: string) {
  const originalParagraphs = original.split(/\n{2,}/).map(normalizeForCompare).filter(Boolean);
  const diversifiedParagraphs = diversified.split(/\n{2,}/).map(normalizeForCompare).filter(Boolean);

  if (originalParagraphs.length === 0) {
    return 0;
  }

  const identical = originalParagraphs.filter(
    (paragraph, index) => paragraph === (diversifiedParagraphs[index] ?? ""),
  ).length;

  return identical / originalParagraphs.length;
}

export function calculateDiversificationScore(
  original: string,
  diversified: string,
  transformationsApplied = 0,
) {
  const sentenceChanges = countChangedSentences(original, diversified);
  const paragraphRatio = identicalParagraphRatio(original, diversified);
  const placeholdersRemaining = findRemainingPlaceholders(diversified);
  const protectedTermsMissing = findMissingProtectedTerms(original, diversified);
  let score = 0;

  score += Math.min(sentenceChanges * 10, 40);
  score += Math.min(transformationsApplied * 6, 36);
  score += Math.round((1 - paragraphRatio) * 20);

  if (normalizeForCompare(original) !== normalizeForCompare(diversified)) {
    score += 10;
  }

  if (placeholdersRemaining.length === 0) {
    score += 8;
  }

  if (protectedTermsMissing.length === 0) {
    score += 12;
  } else {
    score -= protectedTermsMissing.length * 8;
  }

  return {
    diversificationScore: Math.max(0, Math.min(100, score)),
    identicalParagraphRatio: paragraphRatio,
    placeholdersRemaining,
    protectedTermsMissing,
    sentenceChanges,
  };
}

function applyFallback(text: string, seed: number): RewriteResult {
  const fallbackRules: RewriteRule[] = [
    {
      id: "fallback-currently",
      pattern: /\bAtualmente\b/i,
      variants: ["No momento", "Neste momento", "Agora"],
    },
    {
      id: "fallback-selected",
      pattern: /\bselecionadas?\b/i,
      variants: ["escolhidas", "separadas", "priorizadas"],
    },
    {
      id: "fallback-contact",
      pattern: /\bentrando em contato\b/i,
      variants: ["falando com vocês", "fazendo esse contato", "priorizando esse contato"],
    },
    {
      id: "fallback-details",
      pattern: /\bmais detalhes\b/i,
      variants: ["os detalhes", "mais informações", "um resumo completo"],
    },
  ];
  const result = applyRules(text, fallbackRules, seed);

  if (result.appliedIds.length > 0) {
    return result;
  }

  const middle = Math.floor(text.length / 2);
  const splitIndex = text.indexOf(" ", middle);

  if (splitIndex > 30 && splitIndex < text.length - 30) {
    return {
      appliedIds: ["fallback-line-break"],
      text: `${text.slice(0, splitIndex).trim()}\n${text.slice(splitIndex).trim()}`,
    };
  }

  return {
    appliedIds: ["fallback-punctuation"],
    text: /[.!?]$/.test(text) ? `${text} ` : `${text}.`,
  };
}

function diversifyInLayers(base: string, leadName: string, seed: number) {
  let text = base;
  let appliedIds: string[] = [];

  const grammar = fixLeadGrammar(text, leadName, seed);
  text = grammar.text;
  appliedIds = [...appliedIds, ...grammar.appliedIds];

  const greeting = varyGreeting(text, seed);
  text = greeting.text;
  appliedIds = [...appliedIds, ...greeting.appliedIds];

  const semantic = applyRules(text, rewriteRules, seed);
  text = semantic.text;
  appliedIds = [...appliedIds, ...semantic.appliedIds];

  const structure = lightlyReorderParagraphs(text, seed);
  text = structure.text;
  appliedIds = [...appliedIds, ...structure.appliedIds];

  return {
    appliedIds,
    text: cleanInlineText(text),
  };
}

function needsMoreDiversification(original: string, diversified: string, appliedCount: number) {
  const quality = calculateDiversificationScore(original, diversified, appliedCount);

  if (normalizeForCompare(original) === normalizeForCompare(diversified)) {
    return true;
  }

  if (original.length > 500) {
    return (
      appliedCount < 5 ||
      quality.identicalParagraphRatio > 0.7 ||
      quality.placeholdersRemaining.length > 0 ||
      quality.protectedTermsMissing.length > 0
    );
  }

  return original.length > 80 && quality.sentenceChanges === 0;
}

export function diversifyBaseCopyWithReport(input: DiversifyBaseCopyInput): DiversificationReport {
  const placeholderResult = replacePlaceholders(input);
  const seedSource = [
    input.variantSeed ?? 0,
    input.lead?.id,
    input.lead?.name,
    input.leadName,
    input.baseCopy ?? input.copyBase,
  ]
    .filter(Boolean)
    .join("|");
  const seed = hashText(seedSource);
  let diversified = diversifyInLayers(placeholderResult.text, placeholderResult.leadDisplayName, seed);

  for (let round = 0; round < 3; round += 1) {
    if (!needsMoreDiversification(placeholderResult.text, diversified.text, diversified.appliedIds.length)) {
      break;
    }

    const fallback = applyFallback(diversified.text, seed + round);
    diversified = {
      appliedIds: [...diversified.appliedIds, ...fallback.appliedIds],
      text: cleanInlineText(fallback.text),
    };
  }

  const quality = calculateDiversificationScore(
    placeholderResult.text,
    diversified.text,
    diversified.appliedIds.length,
  );

  return {
    ...quality,
    message: diversified.text,
    originalWithPlaceholders: placeholderResult.text,
    transformationsApplied: diversified.appliedIds.length,
  };
}

export function diversifyBaseCopy(input: DiversifyBaseCopyInput) {
  return diversifyBaseCopyWithReport(input).message;
}
