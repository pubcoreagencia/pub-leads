import type { RewritePattern, RewritePatternType } from "./types";

export type SemanticBlocks = {
  authorityNames: string[];
  city: string;
  competitor: boolean;
  deliveryItems: string[];
  deadline: string | null;
  hasQuestion: boolean;
  leadName: string;
  niche: string;
  numbers: string[];
  patterns: RewritePattern[];
  prices: string[];
  project: string;
};

const patternRules: Array<{
  importance: number;
  regex: RegExp;
  type: RewritePatternType;
}> = [
  { importance: 5, regex: /\b(ol[aá]|oi|bom dia|boa tarde|boa noite|tudo bem|como vai|tudo certo)\b/i, type: "greeting" },
  { importance: 5, regex: /\b(eu sou|me chamo|aqui [eé]|sou representante|falo em nome)\b/i, type: "introduction" },
  { importance: 8, regex: /\b(estou entrando em contato|te chamei|estamos falando|procurei|contato porque)\b/i, type: "selection" },
  { importance: 9, regex: /\b(selecionad|escolhid|entrou na lista|uma das\s+\d+|primeira lista)\b/i, type: "selection" },
  { importance: 8, regex: /\b(presen[cç]a digital|posicionamento digital|estrutura digital|aparece hoje no digital|potencial)\b/i, type: "opportunity" },
  { importance: 10, regex: /\b(site|instagram|google meu neg[oó]cio|e-?mail corporativo|whatsapp business|base digital)\b/i, type: "delivery" },
  { importance: 10, regex: /\b(\d+\s*(?:a|e|-)\s*\d+\s+dias|em at[eé]\s+\d+\s+dias|pronto em)\b/i, type: "deadline" },
  { importance: 9, regex: /\b(ag[eê]ncia pub|j[aá] trabalhou|marcas|clientes|artistas|l.?or[eé]al|globosat|circo voador)\b/i, type: "authority" },
  { importance: 9, regex: /\b(apenas\s+\d+|poucas vagas|pr[oó]xima empresa|vaga segue|lista limitada)\b/i, type: "scarcity" },
  { importance: 7, regex: /\b(concorrente direto|mesmo segmento|mesmo mercado|mesma categoria)\b/i, type: "scarcity" },
  { importance: 10, regex: /\b(posso te explicar|posso explicar|posso te passar|faz sentido|quer que eu|te mando|te envio)\b/i, type: "permission_cta" },
  { importance: 6, regex: /\b(passando para confirmar|s[oó] retomando|ainda faz sentido|[uú]ltima tentativa)\b/i, type: "follow_up" },
];

const deliveryItems = [
  { label: "site profissional", regex: /\bsite(?:\s+profissional)?\b/i },
  { label: "Instagram", regex: /\binstagram\b/i },
  { label: "Google Meu Negócio", regex: /\bgoogle meu neg[oó]cio\b/i },
  { label: "e-mail corporativo", regex: /\be-?mail corporativo\b/i },
  { label: "WhatsApp Business", regex: /\bwhatsapp business\b/i },
];

const authorityNames = [
  "Agência PUB",
  "L'Oréal Paris",
  "Globosat",
  "Circo Voador",
  "Gabriel Pensador",
  "Diogo Defante",
  "Paulinho Serra",
  "Vamos Dubai",
];

export function normalizeCopyText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNumbers(text: string) {
  return Array.from(new Set(text.match(/\b\d+(?:[.,]\d+)?(?:\s*(?:a|e|-)\s*\d+)?\b/g) ?? []));
}

function extractPrices(text: string) {
  return Array.from(new Set(text.match(/R\$\s*\d+(?:[.,]\d+)?|\b\d+(?:[.,]\d+)?\s*reais\b/gi) ?? []));
}

const normalizedPatternRules: Array<{
  importance: number;
  regex: RegExp;
  text: string;
  type: RewritePatternType;
}> = [
  { importance: 5, regex: /\b(ola|oi|bom dia|boa tarde|boa noite|tudo bem|como vai|tudo certo)\b/i, text: "saudacao", type: "greeting" },
  { importance: 5, regex: /\b(eu sou|me chamo|aqui e|sou representante|falo em nome)\b/i, text: "apresentacao", type: "introduction" },
  { importance: 8, regex: /\b(estou entrando em contato|te chamei|estamos falando|procurei|contato porque)\b/i, text: "motivo do contato", type: "selection" },
  { importance: 9, regex: /\b(selecionad|escolhid|entrou na lista|uma das\s+\d+|primeira lista)\b/i, text: "selecao", type: "selection" },
  { importance: 8, regex: /\b(presenca digital|posicionamento digital|estrutura digital|aparece hoje no digital|potencial|consolidad|nivel que merecem)\b/i, text: "oportunidade digital", type: "opportunity" },
  { importance: 10, regex: /\b(site|instagram|google meu negocio|e mail corporativo|email corporativo|whatsapp business|base digital)\b/i, text: "entrega", type: "delivery" },
  { importance: 10, regex: /\b(\d+\s*(?:a|e|-)\s*\d+\s+dias|em ate\s+\d+\s+dias|pronto em)\b/i, text: "prazo", type: "deadline" },
  { importance: 9, regex: /\b(agencia pub|ja trabalhou|marcas|clientes|artistas|l.?oreal|globosat|circo voador)\b/i, text: "autoridade", type: "authority" },
  { importance: 9, regex: /\b(apenas\s+\d+|poucas vagas|proxima empresa|vaga segue|lista limitada)\b/i, text: "escassez", type: "scarcity" },
  { importance: 7, regex: /\b(concorrente direto|mesmo segmento|mesmo mercado|mesma categoria)\b/i, text: "concorrencia", type: "scarcity" },
  { importance: 10, regex: /\b(posso te explicar|posso explicar|posso te passar|faz sentido|quer que eu|te mando|te envio)\b/i, text: "cta", type: "permission_cta" },
  { importance: 6, regex: /\b(passando para confirmar|so retomando|ainda faz sentido|ultima tentativa)\b/i, text: "follow up", type: "follow_up" },
];

function detectPatterns(text: string): RewritePattern[] {
  const normalized = normalizeCopyText(text);
  const exactMatches = patternRules.flatMap((rule) => {
    const match = text.match(rule.regex);

    return match?.[0]
      ? [
          {
            confidence: Math.min(1, 0.72 + rule.importance / 40),
            importance: rule.importance,
            text: match[0],
            type: rule.type,
          },
        ]
      : [];
  });
  const normalizedMatches = normalizedPatternRules.flatMap((rule) =>
    rule.regex.test(normalized)
      ? [
          {
            confidence: Math.min(1, 0.7 + rule.importance / 40),
            importance: rule.importance,
            text: rule.text,
            type: rule.type,
          },
        ]
      : [],
  );
  const byType = new Map<RewritePatternType, RewritePattern>();

  for (const pattern of [...exactMatches, ...normalizedMatches]) {
    const current = byType.get(pattern.type);

    if (!current || current.confidence < pattern.confidence) {
      byType.set(pattern.type, pattern);
    }
  }

  return Array.from(byType.values());
}

export function extractSemanticBlocks(text: string, context: { city?: string; leadName?: string; niche?: string }) {
  const patterns = detectPatterns(text);
  const normalized = normalizeCopyText(text);
  const foundDelivery = deliveryItems.filter((item) => item.regex.test(text) || normalizeCopyText(item.label).split(" ").every((part) => normalized.includes(part))).map((item) => item.label);
  const foundAuthority = authorityNames.filter((name) => normalized.includes(normalizeCopyText(name)));
  const deadline = text.match(/\b\d+\s*(?:a|e|-)\s*\d+\s+dias\b/i)?.[0] ?? text.match(/\bat[eé]\s+\d+\s+dias\b/i)?.[0] ?? null;

  return {
    authorityNames: foundAuthority,
    city: context.city ?? "",
    competitor: /\b(concorrente|mesmo segmento|mesmo mercado|mesma categoria)\b/i.test(text),
    deliveryItems: Array.from(new Set(foundDelivery)),
    deadline,
    hasQuestion: /\?/.test(text),
    leadName: context.leadName ?? "",
    niche: context.niche ?? "",
    numbers: extractNumbers(text),
    patterns,
    prices: extractPrices(text),
    project: context.city ? `Projeto ${context.city}` : "projeto",
  } satisfies SemanticBlocks;
}

export function hasPattern(blocks: SemanticBlocks, type: RewritePatternType) {
  return blocks.patterns.some((pattern) => pattern.type === type);
}
