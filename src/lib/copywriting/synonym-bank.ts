export type SynonymRule = {
  label: string;
  pattern: RegExp;
  replacements: string[];
};

export const contextualSynonyms: SynonymRule[] = [
  {
    label: "contact_reason",
    pattern: /\b(?:estou|estamos)\s+entrando em contato(?:\s+porque|\s+pois)?\b/i,
    replacements: ["te chamei porque", "estamos falando com vocês porque", "te procurei porque"],
  },
  {
    label: "selection",
    pattern: /\bfoi selecionad[ao]\b/i,
    replacements: ["foi escolhida", "entrou na lista", "foi separada para essa etapa"],
  },
  {
    label: "selected_company",
    pattern: /\buma das empresas escolhidas\b/i,
    replacements: ["uma das empresas selecionadas", "uma das empresas separadas para essa etapa"],
  },
  {
    label: "consolidated_business",
    pattern: /\bempresas j[aá] consolidadas\b/i,
    replacements: ["negócios já estabelecidos", "empresas com boa base", "negócios que já têm valor no mercado"],
  },
  {
    label: "digital_presence",
    pattern: /\bpresen[cç]a digital\b/i,
    replacements: ["estrutura digital", "posicionamento online", "base digital"],
  },
  {
    label: "deserved_level",
    pattern: /\bno n[ií]vel que merecem\b/i,
    replacements: ["à altura do negócio", "compatível com o que vocês já construíram", "proporcional ao potencial de vocês"],
  },
  {
    label: "delivery_includes",
    pattern: /\ba entrega inclui\b/i,
    replacements: ["a estrutura contempla", "na prática, entregamos", "o pacote inclui"],
  },
  {
    label: "not_priority",
    pattern: /\bcaso n[aã]o fa[cç]a sentido\b/i,
    replacements: ["se não for prioridade agora", "se não fizer sentido para vocês", "se não quiserem avançar"],
  },
  {
    label: "direct_competitor",
    pattern: /\bconcorrente direto\b/i,
    replacements: ["empresa do mesmo segmento", "negócio do mesmo mercado", "concorrente da região"],
  },
  {
    label: "permission_cta",
    pattern: /\bposso te explicar(?: melhor| rapidamente)?\?/i,
    replacements: ["posso te passar os detalhes?", "faz sentido eu te mostrar como funciona?", "quer que eu te mande as informações?"],
  },
];

export const protectedTermPatterns = [
  /\bAg[eê]ncia PUB\b/gi,
  /\bL.?Or[eé]al Paris\b/gi,
  /\bGlobosat\b/gi,
  /\bCirco Voador\b/gi,
  /\bGabriel Pensador\b/gi,
  /\bDiogo Defante\b/gi,
  /\bPaulinho Serra\b/gi,
  /\bVamos Dubai\b/gi,
  /\b\d+\s*(?:a|e|-)\s*\d+\s+dias\b/gi,
  /R\$\s*\d+(?:[.,]\d+)?/gi,
];
