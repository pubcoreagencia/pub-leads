import { normalizeBrazilianPortuguese } from "./grammar-normalizer";

export type ConservativeRewriteCandidate = {
  applied: string[];
  message: string;
};

type RewriteResult = {
  applied: boolean;
  text: string;
};

type RewriteRule = {
  apply: (text: string, option: number) => RewriteResult;
  label: string;
};

function pick<T>(items: T[], option: number) {
  return items[Math.abs(option) % items.length];
}

function capitalize(value: string) {
  return value.replace(/^(\s*)([\p{Ll}])/u, (_, spacing: string, letter: string) => `${spacing}${letter.toLocaleUpperCase("pt-BR")}`);
}

function replaceFirst(
  text: string,
  pattern: RegExp,
  replacement: (match: RegExpMatchArray) => string,
): RewriteResult {
  const match = text.match(pattern);

  if (!match || match.index === undefined) {
    return { applied: false, text };
  }

  const next = `${text.slice(0, match.index)}${replacement(match)}${text.slice(match.index + match[0].length)}`;

  return { applied: next !== text, text: next };
}

const rewriteRules: RewriteRule[] = [
  {
    label: "time_aware_greeting",
    apply: (text, option) =>
      replaceFirst(
        text,
        /^\s*(?:Olá|Oi),?\s+(bom dia|boa tarde|boa noite)(?:,?\s*(?:tudo bem|tudo certo))?[!?]*\s*$/i,
        (match) => {
          const period = match[1].toLocaleLowerCase("pt-BR");

          return pick(
            [
              `Oi, ${period}! Tudo bem?`,
              `${capitalize(period)}! Tudo certo?`,
              `Olá, ${period}! Como vai?`,
            ],
            option,
          );
        },
      ),
  },
  {
    label: "operator_introduction",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bMe chamo\s+([^,.!?\n]+),\s*([^.!?\n]+)([.!?])/i,
        (match) =>
          pick(
            [
              `Meu nome é ${match[1]} e sou ${match[2]}${match[3]}`,
              `Sou ${match[1]}, ${match[2]}${match[3]}`,
              `Aqui é ${match[1]}, ${match[2]}${match[3]}`,
            ],
            option,
          ),
      ),
  },
  {
    label: "operator_introduction_eu_sou",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bEu sou\s+(?:a\s+|o\s+)?([^,.!?\n]+),\s*([^.!?\n]+)([.!?])/i,
        (match) =>
          pick(
            [
              `Me chamo ${match[1]} e sou ${match[2]}${match[3]}`,
              `Meu nome é ${match[1]}. Sou ${match[2]}${match[3]}`,
              `Aqui é ${match[1]}, ${match[2]}${match[3]}`,
            ],
            option,
          ),
      ),
  },
  {
    label: "contact_reason_plural",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bEstamos entrando em contato\s+(?:pois|porque)\s+/i,
        () =>
          pick(
            [
              "O motivo do nosso contato é este: ",
              "Entramos em contato por um motivo específico: ",
              "O contexto do nosso contato é o seguinte: ",
            ],
            option,
          ),
      ),
  },
  {
    label: "contact_reason_singular",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bEstou entrando em contato\s+(?:pois|porque)\s+/i,
        () =>
          pick(
            [
              "O motivo do meu contato é este: ",
              "Entrei em contato por um motivo específico: ",
              "O contexto do meu contato é o seguinte: ",
            ],
            option,
          ),
      ),
  },
  {
    label: "project_audience",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bO projeto é voltado para\s+([^.!?\n]+?),\s+mas que\s+([^.!?\n]+)([.!?])/i,
        (match) => {
          const contrastWithoutRepetition = match[2].replace(/^ainda\s+/i, "");

          return pick(
            [
              `O projeto atende ${match[1]}. Essas empresas, porém, ${match[2]}${match[3]}`,
              `A proposta é direcionada a ${match[1]}. Ainda assim, essas empresas ${contrastWithoutRepetition}${match[3]}`,
              `A ideia é trabalhar com ${match[1]}, que ${match[2]}${match[3]}`,
            ],
            option,
          );
        },
      ),
  },
  {
    label: "delivery_opening",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bA entrega inclui\s+/i,
        () => pick(["A entrega reúne ", "A estrutura inclui ", "Na prática, a entrega contempla "], option),
      ),
  },
  {
    label: "proposal_opening",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bA proposta é\s+(?!direcionad[ao]\b)/i,
        () => pick(["O objetivo é ", "A ideia é ", "O propósito é "], option),
      ),
  },
  {
    label: "identified_opportunity",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bidentificamos uma oportunidade clara\b/i,
        () =>
          pick(
            [
              "percebemos uma oportunidade clara",
              "encontramos uma oportunidade concreta",
              "vimos uma oportunidade evidente",
            ],
            option,
          ),
      ),
  },
  {
    label: "authority_owner",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bA estrutura é feita pela\s+/i,
        () =>
          pick(
            [
              "A estrutura fica por conta da ",
              "A responsável pela estrutura é a ",
              "Quem desenvolve a estrutura é a ",
            ],
            option,
          ),
      ),
  },
  {
    label: "authority_experience",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bque já atuou com\s+/i,
        () => pick(["que já trabalhou com ", "que tem experiência com ", "que já desenvolveu trabalhos com "], option),
      ),
  },
  {
    label: "service_site",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bO site do serviço é\s+(https?:\/\/\S+)/i,
        (match) =>
          pick(
            [
              `Você pode conhecer o serviço em ${match[1]}`,
              `Mais detalhes do serviço: ${match[1]}`,
              `O serviço pode ser visto em ${match[1]}`,
            ],
            option,
          ),
      ),
  },
  {
    label: "scarcity_opening",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bNessa etapa são apenas\s+/i,
        () => pick(["Esta etapa reúne apenas ", "Nesta etapa, trabalhamos com apenas ", "A seleção desta etapa tem apenas "], option),
      ),
  },
  {
    label: "scarcity_next_lead",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\ba vaga segue para a próxima empresa\b/i,
        () =>
          pick(
            [
              "seguiremos com a próxima empresa",
              "a vaga será destinada à próxima empresa",
              "entraremos em contato com a próxima empresa",
            ],
            option,
          ),
      ),
  },
  {
    label: "follow_up_opening",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bPassando só para confirmar se\s+/i,
        () =>
          pick(
            [
              "Queria apenas confirmar se ",
              "Retomando nossa conversa para saber se ",
              "Voltando por aqui para confirmar se ",
            ],
            option,
          ),
      ),
  },
  {
    label: "follow_up_progress",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bAinda estamos organizando\s+/i,
        () => pick(["Seguimos organizando ", "Continuamos organizando ", "A organização continua com "], option),
      ),
  },
  {
    label: "permission_cta_explain",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bPosso te explicar melhor\?/i,
        () =>
          pick(
            [
              "Posso te explicar isso com mais detalhes?",
              "Faz sentido eu te explicar melhor?",
              "Quer que eu te explique como funciona?",
            ],
            option,
          ),
      ),
  },
  {
    label: "permission_cta_details",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bPosso te passar\s+([^?]+)\?/i,
        (match) =>
          pick(
            [
              `Quer que eu te envie ${match[1]}?`,
              `Faz sentido eu te passar ${match[1]}?`,
              `Posso te enviar ${match[1]}?`,
            ],
            option,
          ),
      ),
  },
  {
    label: "sense_softener",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bCaso não faça sentido(?: para vocês)?\b/i,
        () =>
          pick(
            [
              "Se não fizer sentido para vocês",
              "Se não for o momento para vocês",
              "Caso vocês prefiram não avançar",
            ],
            option,
          ),
      ),
  },
];

function splitContrast(text: string, option: number): RewriteResult {
  return replaceFirst(
    text,
    /(^|[\n.!?]\s*)([^.!?\n]{18,220}?),\s+mas\s+(?!(?:que|porque|pois|quando|como|se)\b)([^.!?\n]{12,260})([.!?])/i,
    (match) => {
      const connector = pick(["Ainda assim", "Ao mesmo tempo", "Porém"], option);
      return `${match[1]}${match[2].trim()}. ${connector}, ${match[3].trim()}${match[4]}`;
    },
  );
}

function splitNegativeReason(text: string): RewriteResult {
  return replaceFirst(
    text,
    /(^|[\n.!?]\s*)([^.!?\n]*\bnão\b[^.!?\n]*?),\s+mas\s+porque\s+([^.!?\n]{12,260})([.!?])/i,
    (match) => `${match[1]}${match[2].trim()}. Isso acontece porque ${match[3].trim()}${match[4]}`,
  );
}

function moveDeadline(text: string): RewriteResult {
  return replaceFirst(
    text,
    /(^|[\n.!?]\s*)Em\s+(\d+\s*(?:a|e|-)\s*\d+\s+dias),\s+([^.!?\n]+)([.!?])/i,
    (match) => `${match[1]}${capitalize(match[3].trim())} em ${match[2]}${match[4]}`,
  );
}

function varyParagraphs(text: string, option: number): RewriteResult {
  const protectedUrls: string[] = [];
  const protectedText = text.replace(/https?:\/\/\S+/gi, (url) => {
    const trailingPunctuation = url.match(/[.!?,;]+$/)?.[0] ?? "";
    const cleanUrl = trailingPunctuation ? url.slice(0, -trailingPunctuation.length) : url;
    const token = `URLPROTEGIDA${protectedUrls.length}`;

    protectedUrls.push(cleanUrl);
    return `${token}${trailingPunctuation}`;
  });
  const sentences = protectedText.match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];

  if (sentences.length < 2) {
    return { applied: false, text };
  }

  const groupSize = option % 2 === 0 ? 1 : 2;
  const paragraphs: string[] = [];

  for (let index = 0; index < sentences.length; index += groupSize) {
    paragraphs.push(sentences.slice(index, index + groupSize).join(" "));
  }

  const next = protectedUrls.reduce(
    (current, url, index) => current.replace(`URLPROTEGIDA${index}`, url),
    paragraphs.join("\n\n"),
  );

  return { applied: next !== text, text: next };
}

const structuralRules: RewriteRule[] = [
  { apply: splitContrast, label: "contrast_restructure" },
  { apply: (text) => splitNegativeReason(text), label: "negative_reason_restructure" },
  { apply: (text) => moveDeadline(text), label: "deadline_reorder" },
  { apply: varyParagraphs, label: "paragraph_rhythm" },
];

function candidateKey(message: string) {
  return message.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

export function buildConservativeRewriteCandidates(original: string, seed: number) {
  const candidates: ConservativeRewriteCandidate[] = [];
  const seen = new Set<string>([candidateKey(original)]);

  for (let attempt = 0; attempt < 24; attempt += 1) {
    let text = original;
    const applied: string[] = [];
    const allRules = [...rewriteRules, ...structuralRules];

    allRules.forEach((rule, ruleIndex) => {
      const shouldApply = (seed + attempt * 5 + ruleIndex * 3) % 5 !== 0;

      if (!shouldApply) {
        return;
      }

      const result = rule.apply(text, seed + attempt + ruleIndex);

      if (result.applied) {
        text = result.text;
        applied.push(rule.label);
      }
    });

    const message = normalizeBrazilianPortuguese(text);
    const key = candidateKey(message);

    if (applied.length > 0 && !seen.has(key)) {
      seen.add(key);
      candidates.push({ applied, message });
    }
  }

  return candidates;
}
