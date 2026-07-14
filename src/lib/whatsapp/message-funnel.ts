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
    .replace(/Eu sou representante(?: da Agência PUB)?, representante comercial da Agência PUB/gi, "Eu sou representante comercial da Agência PUB")
    .replace(/Eu sou representante comercial, representante comercial da Agência PUB/gi, "Eu sou representante comercial da Agência PUB")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

export function getTimeAwareGreeting(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(date),
  );

  if (hour >= 5 && hour < 12) {
    return "bom dia";
  }

  if (hour >= 12 && hour < 18) {
    return "boa tarde";
  }

  return "boa noite";
}

export function applyTimeAwareGreeting(text: string, date = new Date()) {
  const greeting = getTimeAwareGreeting(date);

  return text.replace(/\bbom dia\b/gi, (match) =>
    match[0] === match[0]?.toUpperCase()
      ? `${greeting.charAt(0).toUpperCase()}${greeting.slice(1)}`
      : greeting,
  );
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] ?? "";
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function inferPortugueseNameArticle(name: string) {
  const normalized = normalizeName(firstName(name));

  const feminineNames = new Set([
    "aline",
    "amanda",
    "ana",
    "beatriz",
    "bianca",
    "bruna",
    "camila",
    "carla",
    "carolina",
    "clara",
    "debora",
    "fernanda",
    "gabriela",
    "helena",
    "isabela",
    "joana",
    "julia",
    "juliana",
    "larissa",
    "laura",
    "leticia",
    "luana",
    "mariana",
    "marina",
    "maria",
    "monica",
    "patricia",
    "paula",
    "priscila",
    "rafaela",
    "renata",
    "sofia",
    "sophia",
    "tatiana",
    "valentina",
    "vanessa",
    "yasmin",
  ]);
  const masculineNames = new Set([
    "andre",
    "antonio",
    "bernardo",
    "bruno",
    "caio",
    "carlos",
    "daniel",
    "davi",
    "diego",
    "eduardo",
    "enzo",
    "felipe",
    "francisco",
    "gabriel",
    "gustavo",
    "henrique",
    "joao",
    "jose",
    "leonardo",
    "lucas",
    "luis",
    "luiz",
    "marcelo",
    "mateus",
    "matheus",
    "miguel",
    "nicolas",
    "paulo",
    "pedro",
    "rafael",
    "ricardo",
    "rodrigo",
    "samuel",
    "thiago",
    "tiago",
    "victor",
    "vitor",
  ]);

  if (!normalized || normalized === "representante") {
    return null;
  }

  if (feminineNames.has(normalized)) {
    return "a";
  }

  if (masculineNames.has(normalized)) {
    return "o";
  }

  if (normalized.endsWith("a")) {
    return "a";
  }

  if (normalized.endsWith("o")) {
    return "o";
  }

  return null;
}

function isGenericOperatorName(name: string) {
  const normalized = normalizeName(name.trim());

  return !normalized || normalized === "representante" || normalized === "representante comercial";
}

export function getOperatorNameWithArticle(name: string) {
  const trimmed = name.trim();
  const article = inferPortugueseNameArticle(trimmed);

  return article ? `${article} ${trimmed}` : trimmed;
}

export function getOperatorIntroPhrase(name: string, seed = 0) {
  const trimmed = name.trim() || "representante";

  if (isGenericOperatorName(trimmed)) {
    return "Eu sou representante";
  }

  const nameWithArticle = getOperatorNameWithArticle(trimmed);
  const variants = [
    `Eu sou ${nameWithArticle}`,
    `Me chamo ${trimmed}`,
    `Aqui é ${nameWithArticle}`,
    `Meu nome é ${trimmed}`,
  ];

  return variants[Math.abs(seed) % variants.length];
}

export function applyOperatorIntroPhrase(text: string, operator: string, seed = 0) {
  if (isGenericOperatorName(operator)) {
    return text;
  }

  const intro = getOperatorIntroPhrase(operator, seed);
  const escapedOperator = operator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return text.replace(new RegExp(`\\bEu sou\\s+${escapedOperator}\\b`, "gi"), intro);
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

  return user?.email?.split("@")[0] || "representante";
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
  message = replaceToken(message, ["{intro_operador}"], getOperatorIntroPhrase(operator, hashText(`${lead.id}|${template}|${operator}`)));
  message = replaceToken(message, ["{operador}"], operator);
  message = replaceToken(message, ["{telefone}"], lead.whatsapp || lead.phone || lead.phone_2 || "");
  message = replaceToken(message, ["{site}"], lead.website || "");
  message = replaceToken(message, ["{instagram}"], instagramValue(lead));
  message = replaceToken(message, ["{plano}"], context?.plan || "");
  message = replaceToken(message, ["{projeto}"], project);

  message = message.replace(/\{[a-zA-Z_]+\}/g, "");
  message = applyOperatorIntroPhrase(message, operator, hashText(`${lead.id}|${template}|${operator}`));

  return cleanText(applyTimeAwareGreeting(message));
}

const pubStartUrl = "https://pub-start.pages.dev/";

const authorityNamesText =
  "L'Oréal Paris, Globosat, Circo Voador, Gabriel Pensador, Diogo Defante, Paulinho Serra e Vamos Dubai";

const stepVariations: Record<number, string[]> = {
  1: [
    "Oi, bom dia!",
    "Olá, bom dia!",
    "Bom dia!",
    "Oi, tudo bem?",
    "Olá, tudo bem?",
    "Bom dia, tudo certo?",
    "Oi! Bom dia, tudo certo?",
    "Olá! Tudo bem por aí?",
    "Oi, como vai?",
    "Olá, tudo certo por aí?",
    "Bom dia, como você está?",
    "Oi! Tudo tranquilo?",
  ],
  2: [
    "{intro_operador}, representante comercial da Agência PUB. A {empresa} entrou na lista das 5 empresas de {nicho} selecionadas para o {projeto}. Posso te explicar rapidinho?",
    "{intro_operador}, da equipe comercial da Agência PUB. A {empresa} foi selecionada entre 5 empresas de {nicho} para o {projeto}. Posso explicar em poucas palavras?",
    "{intro_operador}, representante comercial da Agência PUB. Estamos falando com a {empresa} porque vocês foram escolhidos entre 5 empresas de {nicho} para o {projeto}. Posso te contar como funciona?",
    "{intro_operador}, da Agência PUB. A {empresa} entrou na primeira lista de empresas de {nicho} do {projeto}. Posso explicar a proposta em poucos minutos?",
    "{intro_operador}, representante comercial da Agência PUB. A {empresa} foi uma das 5 empresas de {nicho} separadas para o {projeto}. Posso te contextualizar?",
    "{intro_operador}, da Agência PUB. Estamos priorizando algumas empresas de {nicho} para o {projeto}, e a {empresa} entrou nessa lista. Posso explicar o motivo?",
    "{intro_operador}, representante comercial da Agência PUB. A {empresa} apareceu entre as empresas de {nicho} selecionadas para o {projeto}. Posso te mostrar como funciona?",
    "{intro_operador}, da Agência PUB. A {empresa} foi escolhida para receber uma proposta do {projeto}, voltada para empresas de {nicho}. Posso te explicar?",
    "{intro_operador}, representante comercial da Agência PUB. Estamos falando com poucas empresas de {nicho} no {projeto}, e a {empresa} está entre elas. Posso resumir?",
    "{intro_operador}, da Agência PUB. A {empresa} foi selecionada nessa etapa do {projeto} junto com poucas empresas de {nicho}. Posso explicar rapidamente?",
    "{intro_operador}, representante comercial da Agência PUB. O contato é porque a {empresa} entrou na seleção de empresas de {nicho} para o {projeto}. Posso te passar o contexto?",
    "{intro_operador}, da Agência PUB. A {empresa} foi indicada para o {projeto}, que está selecionando 5 empresas de {nicho}. Posso te contar a ideia?",
  ],
  3: [
    "O projeto é para empresas já consolidadas que ainda podem ter uma presença digital mais profissional. A entrega inclui site, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business, tudo pronto em 3 a 7 dias.",
    "A ideia é estruturar a presença digital de empresas com boa base no mercado. Entram site profissional, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business, com entrega em 3 a 7 dias.",
    "Na prática, o projeto organiza site profissional, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business para deixar a empresa mais bem posicionada em 3 a 7 dias.",
    "O foco é dar uma estrutura digital mais forte para empresas que já têm valor no mercado. Isso inclui site profissional, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business em 3 a 7 dias.",
    "A proposta é simples: organizar a presença digital da empresa com site, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business, tudo entregue entre 3 e 7 dias.",
    "O projeto estrutura o básico que uma empresa forte precisa para vender melhor no digital: site, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business em 3 a 7 dias.",
    "A entrega cobre a parte essencial da presença digital: site profissional, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business, com prazo de 3 a 7 dias.",
    "A ideia é tirar a empresa do improviso digital e entregar site, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business em até 3 a 7 dias.",
    "O projeto reúne site profissional, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business para deixar a presença digital mais estruturada em 3 a 7 dias.",
    "A entrega foi pensada para empresas que já têm operação, mas precisam de uma estrutura digital melhor: site, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business em 3 a 7 dias.",
    "Na prática, a Agência PUB monta a estrutura digital base: site profissional, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business, com entrega entre 3 e 7 dias.",
    "O objetivo é posicionar melhor a empresa no digital com site, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business, sem um processo longo: fica pronto em 3 a 7 dias.",
  ],
  4: [
    `A estrutura é feita pela Agência PUB, que já atuou com nomes como ${authorityNamesText}. O site do serviço é ${pubStartUrl}`,
    `Quem conduz é a Agência PUB, com histórico junto a marcas e nomes como ${authorityNamesText}. Você pode ver o serviço aqui: ${pubStartUrl}`,
    `O projeto é conduzido pela Agência PUB, que já trabalhou com marcas, empresas e artistas como ${authorityNamesText}. Link do serviço: ${pubStartUrl}`,
    `A Agência PUB assina a estrutura e já atuou com ${authorityNamesText}. O serviço está apresentado em ${pubStartUrl}`,
    `A entrega é feita pela Agência PUB, que carrega experiência com ${authorityNamesText}. Site do Pub Start: ${pubStartUrl}`,
    `Por trás do projeto está a Agência PUB, que já trabalhou com ${authorityNamesText}. Para referência, o serviço é este: ${pubStartUrl}`,
    `A estrutura fica com a Agência PUB, que tem histórico com ${authorityNamesText}. Dá para ver o Pub Start aqui: ${pubStartUrl}`,
    `A Agência PUB conduz esse projeto e já participou de trabalhos com ${authorityNamesText}. Página do serviço: ${pubStartUrl}`,
    `Quem monta a estrutura é a Agência PUB, que já atuou com ${authorityNamesText}. O site do serviço é ${pubStartUrl}`,
    `A Agência PUB é responsável pela entrega e já trabalhou com ${authorityNamesText}. Link do serviço: ${pubStartUrl}`,
    `O projeto tem execução da Agência PUB, com experiência junto a ${authorityNamesText}. Referência do serviço: ${pubStartUrl}`,
    `A estrutura é conduzida pela Agência PUB, que já atuou com ${authorityNamesText}. Aqui está o site do serviço: ${pubStartUrl}`,
  ],
  5: [
    "São poucas vagas nesta etapa. Se não fizer sentido para vocês, seguimos para a próxima empresa da lista, possivelmente um concorrente direto.",
    "Como são só 5 empresas selecionadas, se vocês não quiserem avançar, a vaga vai para outra empresa do mesmo mercado.",
    "A lista é limitada. Caso não seja uma prioridade agora, liberamos a vaga para a próxima empresa selecionada, talvez um concorrente direto.",
    "Nessa etapa são apenas 5 empresas. Se não for o momento de vocês, a vaga segue para outra empresa da lista.",
    "A seleção é pequena. Se a {empresa} não quiser seguir, chamamos a próxima empresa selecionada, possivelmente do mesmo nicho.",
    "Como a oportunidade é limitada, não conseguimos segurar a vaga por muito tempo. Se não fizer sentido, seguimos com outro negócio da lista.",
    "Estamos trabalhando com poucas empresas por cidade. Se vocês não avançarem, a próxima vaga pode ir para alguém do mesmo mercado.",
    "A ideia é fechar com poucas empresas nessa etapa. Caso não seja prioridade, liberamos a vaga para outra empresa selecionada.",
    "Como são poucas vagas, preciso confirmar interesse antes de seguir com a próxima empresa da lista.",
    "Essa seleção não fica aberta por muito tempo. Se não fizer sentido agora, encaminhamos para outro negócio do mesmo nicho.",
    "São só algumas empresas selecionadas. Se vocês não quiserem participar, chamamos a próxima da lista.",
    "A vaga é limitada por nicho e cidade. Se não avançarmos com a {empresa}, ela pode ir para uma empresa concorrente.",
  ],
  6: [
    "Gostaríamos muito que fossem vocês. Posso te passar os detalhes da entrega e valores?",
    "Faz sentido eu te mostrar a entrega e os valores para vocês avaliarem?",
    "Posso te enviar os detalhes de como funcionaria para a {empresa}?",
    "Quer que eu te mande o resumo da entrega e próximos passos?",
    "Posso te explicar valores, prazo e o que ficaria incluso?",
    "Faz sentido eu te passar a proposta completa por aqui?",
    "Quer que eu te envie as informações para vocês avaliarem com calma?",
    "Posso te mandar o material com detalhes da entrega?",
    "Se fizer sentido, posso te explicar como seria para a {empresa}.",
    "Quer que eu te mostre como funciona a participação no projeto?",
    "Posso te passar o escopo e os valores para análise?",
    "Se vocês tiverem abertura, te mando agora o resumo com entrega, prazo e valores.",
  ],
  7: [
    "Passando só para confirmar se fez sentido eu te explicar melhor o {projeto}. Ainda estamos organizando as empresas selecionadas dessa etapa.",
    "Só retomando por aqui: ainda estamos fechando a lista do {projeto}. Faz sentido eu te explicar melhor?",
    "Voltei rapidinho para saber se vocês querem entender melhor o {projeto} antes de seguirmos com a lista.",
    "Retomando só para saber se a {empresa} ainda quer avaliar o {projeto}. A lista dessa etapa ainda está sendo organizada.",
    "Passando para confirmar se você conseguiu ver minha mensagem sobre o {projeto}. Posso te explicar melhor?",
    "Só para não deixar passar: a {empresa} segue na lista do {projeto}. Quer que eu envie os detalhes?",
    "Voltando aqui com calma: ainda estamos validando as empresas do {projeto}. Faz sentido conversarmos?",
    "Retomando o contato sobre o {projeto}. Se for interessante para vocês, posso enviar o resumo da proposta.",
    "Queria só confirmar se a {empresa} tem interesse em entender o {projeto} antes de seguirmos com outras empresas.",
    "Passando rapidamente para saber se você quer que eu detalhe a entrega do {projeto}.",
    "Ainda estamos fechando a etapa atual do {projeto}. Posso te explicar o que entraria para a {empresa}?",
    "Só retomando: caso faça sentido, ainda consigo te passar os detalhes do {projeto}.",
  ],
  8: [
    "Como são poucas vagas, vou precisar seguir com a próxima empresa da lista caso não seja uma prioridade para vocês agora. Mas gostaríamos bastante que a {empresa} participasse.",
    "Vou encerrar essa tentativa por aqui se não for prioridade agora, porque a lista é curta. Ainda assim, seria ótimo contar com a {empresa}.",
    "Último toque por aqui: se não fizer sentido agora, seguimos para outra empresa selecionada. Mas a nossa preferência seria avançar com a {empresa}.",
    "Como a seleção é limitada, vou seguir com a próxima empresa caso não seja o momento de vocês. Ainda assim, seria ótimo ter a {empresa} no projeto.",
    "Vou deixar essa última mensagem para não insistir demais. Se não for prioridade agora, liberamos a vaga para a próxima empresa da lista.",
    "Última tentativa por aqui: se vocês quiserem avaliar, ainda posso passar os detalhes. Se não, seguimos com outra empresa selecionada.",
    "Como precisamos fechar a lista, vou considerar que não é prioridade caso não tenha retorno. Mas a {empresa} seria uma ótima participante.",
    "Vou seguir com a lista se não fizer sentido para vocês agora. De qualquer forma, obrigado pela atenção e sigo à disposição.",
    "Encerrando por aqui com respeito: se a {empresa} quiser retomar depois, me chama. Por enquanto, vamos seguir com a próxima selecionada.",
    "Como são poucas vagas, preciso liberar a seleção se não houver interesse. Mas ainda gostaríamos bastante que fossem vocês.",
    "Se não for um bom momento, tudo certo. Vou apenas seguir com a próxima empresa da lista para não travar a etapa.",
    "Último contato sobre o {projeto}: caso queiram participar, me responda por aqui. Se não, seguimos para outra empresa selecionada.",
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
