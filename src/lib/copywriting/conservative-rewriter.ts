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

function decapitalize(value: string) {
  return value.replace(/^(\s*)([\p{Lu}])/u, (_, spacing: string, letter: string) => `${spacing}${letter.toLocaleLowerCase("pt-BR")}`);
}

function contractWithDe(value: string) {
  const trimmed = value.trim();

  if (/^a\s+/i.test(trimmed)) {
    return trimmed.replace(/^a\s+/i, "da ");
  }

  if (/^o\s+/i.test(trimmed)) {
    return trimmed.replace(/^o\s+/i, "do ");
  }

  return `de ${trimmed}`;
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
              `Oi! ${capitalize(period)}, tudo bem?`,
              `${capitalize(period)}! Como você está?`,
              `Olá! ${capitalize(period)}, tudo certo?`,
              `Oi, ${period}! Como vão as coisas?`,
              `${capitalize(period)}! Tudo bem por aí?`,
              `Olá, ${period}! Tudo tranquilo?`,
              `Oi! ${capitalize(period)}, como você está?`,
              `${capitalize(period)}! Como está?`,
              `Olá! Tudo bem? ${capitalize(period)}!`,
              `Oi, tudo bem? ${capitalize(period)}!`,
              `${capitalize(period)}, tudo tranquilo?`,
              `Olá! Como você está? ${capitalize(period)}!`,
              `Oi! Tudo certo por aí? ${capitalize(period)}!`,
              `${capitalize(period)}! Espero que esteja tudo bem.`,
              `Olá, ${period}! Como estão as coisas?`,
              `Oi! ${capitalize(period)}. Tudo tranquilo?`,
              `${capitalize(period)}! Tudo em ordem por aí?`,
              `Olá! ${capitalize(period)}. Como vai você?`,
              `Oi, ${period}! Está tudo bem?`,
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
              `Quem fala é ${match[1]}, ${match[2]}${match[3]}`,
              `Eu sou ${match[1]} e atuo como ${match[2]}${match[3]}`,
              `Meu nome é ${match[1]}. Atuo como ${match[2]}${match[3]}`,
              `Eu me apresento como ${match[1]} e trabalho como ${match[2]}${match[3]}`,
              `Aqui quem fala é ${match[1]}, ${match[2]}${match[3]}`,
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
              `Quem fala é ${match[1]}, ${match[2]}${match[3]}`,
              `Sou ${match[1]} e atuo como ${match[2]}${match[3]}`,
              `Meu nome é ${match[1]} e trabalho como ${match[2]}${match[3]}`,
              `Aqui quem fala é ${match[1]}, ${match[2]}${match[3]}`,
              `Pode me chamar de ${match[1]}; sou ${match[2]}${match[3]}`,
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
              "Estamos falando com vocês por uma razão específica: ",
              "Nosso contato acontece por este motivo: ",
              "Chamamos vocês porque observamos o seguinte: ",
              "Este contato tem um motivo bem definido: ",
              "A razão de falarmos com vocês é esta: ",
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
              "Estou falando com vocês por uma razão específica: ",
              "Meu contato acontece por este motivo: ",
              "Chamei vocês porque observei o seguinte: ",
              "Este contato tem um motivo bem definido: ",
              "A razão de eu falar com vocês é esta: ",
            ],
            option,
          ),
      ),
  },
  {
    label: "selection_with_count",
    apply: (text, option) =>
      replaceFirst(
        text,
        /(^|[.!?:]\s+|\bporque\s+)([AO])\s+([^.!?\n]{2,90}?)\s+foi uma das\s+(\d+)\s+empresas de\s+([^.!?\n]{2,80}?)\s+selecionadas para\s+(o nosso|a nossa)\s+([^.!?\n]+)([.!?])/i,
        (match) => {
          const prefix = match[1];
          const article = match[2];
          const lowerArticle = article.toLocaleLowerCase("pt-BR");
          const company = match[3].trim();
          const count = match[4];
          const niche = match[5].trim();
          const projectArticle = match[6].toLocaleLowerCase("pt-BR").startsWith("a") ? "a" : "o";
          const project = match[7].trim();
          const punctuation = match[8];
          const toProject = `${projectArticle} ${project}`;
          const ofProject = `${projectArticle === "a" ? "da" : "do"} ${project}`;
          const startsSentence = prefix.trim() !== "porque";
          const atSentenceStart = (value: string) => (startsSentence ? value : decapitalize(value));
          const withPrefix = (value: string) => `${prefix}${value}`;

          return pick(
            [
              withPrefix(`${article} ${company} está entre as ${count} empresas de ${niche} selecionadas para ${toProject}${punctuation}`),
              withPrefix(atSentenceStart(`Entre as ${count} empresas de ${niche} selecionadas para ${toProject}, está ${lowerArticle} ${company}${punctuation}`)),
              withPrefix(`${article} ${company} entrou no grupo de ${count} empresas de ${niche} selecionadas para ${toProject}${punctuation}`),
              withPrefix(atSentenceStart(`Para ${toProject}, foram selecionadas ${count} empresas de ${niche}, incluindo ${lowerArticle} ${company}${punctuation}`)),
              withPrefix(`${article} ${company} faz parte da lista de ${count} empresas de ${niche} escolhidas para ${toProject}${punctuation}`),
              withPrefix(atSentenceStart(`A seleção ${ofProject} reúne ${count} empresas de ${niche}, e ${lowerArticle} ${company} está nessa lista${punctuation}`)),
              withPrefix(`${article} ${company} passou a integrar a seleção de ${count} empresas de ${niche} para ${toProject}${punctuation}`),
              withPrefix(atSentenceStart(`Das ${count} empresas de ${niche} selecionadas para ${toProject}, uma delas é ${lowerArticle} ${company}${punctuation}`)),
              withPrefix(atSentenceStart(`${project} terá ${count} empresas de ${niche} nesta etapa, entre elas ${lowerArticle} ${company}${punctuation}`)),
              withPrefix(`${article} ${company} integra o grupo de ${count} empresas de ${niche} selecionadas para ${toProject}${punctuation}`),
            ],
            option,
          );
        },
      ),
  },
  {
    label: "selection_with_reason",
    apply: (text, option) =>
      replaceFirst(
        text,
        /(^|[.!?:]\s+|\bporque\s+)([AO])\s+([^.!?\n]{2,90}?)\s+foi selecionad[ao]\s+para\s+(o nosso|a nossa|o|a)\s+([^.!?\n]{3,100}?)\s+porque\s+([^.!?\n]{8,260})([.!?])/i,
        (match) => {
          const prefix = match[1];
          const article = match[2];
          const lowerArticle = article.toLocaleLowerCase("pt-BR");
          const contractedArticle = lowerArticle === "a" ? "da" : "do";
          const company = match[3].trim();
          const projectArticle = match[4].toLocaleLowerCase("pt-BR").startsWith("a") ? "a" : "o";
          const project = match[5].trim();
          const reason = match[6].trim();
          const punctuation = match[7];
          const toProject = `${projectArticle} ${project}`;
          const ofProject = `${projectArticle === "a" ? "da" : "do"} ${project}`;
          const startsSentence = prefix.trim() !== "porque";
          const atSentenceStart = (value: string) => (startsSentence ? value : decapitalize(value));
          const withPrefix = (value: string) => `${prefix}${value}`;

          return pick(
            [
              withPrefix(`${article} ${company} entrou na seleção para ${toProject} porque ${reason}${punctuation}`),
              withPrefix(`${article} ${company} faz parte da seleção ${ofProject} porque ${reason}${punctuation}`),
              withPrefix(atSentenceStart(`O motivo ${contractedArticle} ${company} estar na seleção ${ofProject} é que ${reason}${punctuation}`)),
              withPrefix(atSentenceStart(`Selecionamos ${lowerArticle} ${company} para ${toProject} porque ${reason}${punctuation}`)),
              withPrefix(`${article} ${company} está na seleção ${ofProject} porque ${reason}${punctuation}`),
              withPrefix(atSentenceStart(`Para ${toProject}, selecionamos ${lowerArticle} ${company} porque ${reason}${punctuation}`)),
            ],
            option,
          );
        },
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
              `${capitalize(match[1])} são o foco do projeto. Mesmo assim, essas empresas ${contrastWithoutRepetition}${match[3]}`,
              `O foco do projeto está em ${match[1]}. Porém, essas empresas ${contrastWithoutRepetition}${match[3]}`,
              `O projeto foi pensado para ${match[1]}, que ${match[2]}${match[3]}`,
              `A iniciativa atende ${match[1]}. Ainda assim, essas empresas ${contrastWithoutRepetition}${match[3]}`,
              `Trabalhamos com ${match[1]}. O ponto é que essas empresas ${match[2]}${match[3]}`,
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
        () =>
          pick(
            [
              "A entrega reúne ",
              "A estrutura inclui ",
              "Na prática, a entrega contempla ",
              "O projeto entrega ",
              "A solução é composta por ",
              "O pacote contempla ",
              "Entre os itens entregues estão ",
              "A estrutura final reúne ",
            ],
            option,
          ),
      ),
  },
  {
    label: "proposal_opening",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bA proposta é\s+(?!direcionad[ao]\b)/i,
        () =>
          pick(
            [
              "O objetivo é ",
              "A ideia é ",
              "O propósito é ",
              "A intenção é ",
              "O foco é ",
              "O que buscamos é ",
              "Na prática, queremos ",
              "O resultado esperado é ",
            ],
            option,
          ),
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
              "notamos uma oportunidade real",
              "observamos um espaço claro para evolução",
              "identificamos um potencial concreto",
              "percebemos um caminho evidente de melhoria",
              "enxergamos uma oportunidade relevante",
            ],
            option,
          ),
      ),
  },
  {
    label: "existing_market_value",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bA empresa já entrega valor no mercado\b/i,
        () =>
          pick(
            [
              "A empresa já gera valor no mercado",
              "O negócio já entrega valor ao mercado",
              "A empresa já tem valor reconhecível no mercado",
              "O valor entregue pela empresa já existe no mercado",
              "A empresa já construiu valor no próprio mercado",
              "O negócio já demonstra valor na sua atuação",
              "A empresa já possui uma entrega valiosa no mercado",
              "O mercado já recebe valor do trabalho da empresa",
            ],
            option,
          ),
      ),
  },
  {
    label: "digital_appearance",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\ba forma como aparece hoje no digital\b/i,
        () =>
          pick(
            [
              "a maneira como se apresenta hoje no digital",
              "a forma como está posicionada atualmente no digital",
              "a presença que mantém hoje no ambiente digital",
              "a maneira como o negócio aparece no digital atualmente",
              "o modo como a empresa se apresenta hoje online",
              "o posicionamento que a empresa possui hoje no digital",
              "a imagem que o negócio transmite atualmente no digital",
              "a forma atual de apresentação da empresa no digital",
            ],
            option,
          ),
      ),
  },
  {
    label: "lost_opportunities",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bpode estar fazendo vocês perderem\s+/i,
        () =>
          pick(
            [
              "pode estar levando vocês a perder ",
              "talvez esteja reduzindo ",
              "pode acabar diminuindo ",
              "pode estar limitando ",
              "talvez faça com que vocês percam ",
              "talvez esteja prejudicando ",
              "pode acabar comprometendo ",
              "pode acabar fazendo vocês perderem ",
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
              "A execução da estrutura é conduzida pela ",
              "Quem assina essa estrutura é a ",
              "O desenvolvimento fica sob responsabilidade da ",
              "A estrutura é preparada pela ",
              "Quem realiza essa entrega é a ",
              "A condução do projeto fica com a ",
              "Por trás dessa estrutura está a ",
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
        () =>
          pick(
            [
              "que já trabalhou com ",
              "que tem experiência com ",
              "que já desenvolveu trabalhos com ",
              "que reúne projetos realizados com ",
              "que possui histórico de atuação com ",
              "que já participou de projetos com ",
              "com experiência construída ao lado de ",
              "que carrega no portfólio trabalhos com ",
              "que já colaborou profissionalmente com ",
              "que tem atuação ligada a ",
            ],
            option,
          ),
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
              `A apresentação do serviço está em ${match[1]}`,
              `Você encontra o serviço aqui: ${match[1]}`,
              `Para conhecer o serviço, acesse ${match[1]}`,
              `A página do serviço é ${match[1]}`,
              `O serviço está apresentado em ${match[1]}`,
              `Veja os detalhes do serviço em ${match[1]}`,
              `Esta é a página do serviço: ${match[1]}`,
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
        () =>
          pick(
            [
              "Esta etapa reúne apenas ",
              "Nesta etapa, trabalhamos com apenas ",
              "A lista desta etapa tem apenas ",
              "Limitamos esta etapa a ",
              "A lista desta etapa conta com somente ",
              "Esta etapa considera apenas ",
              "Esta fase contempla somente ",
              "O número de empresas nesta etapa é de apenas ",
            ],
            option,
          ),
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
              "avançaremos com a próxima empresa",
              "a próxima empresa da lista receberá a oportunidade",
              "chamaremos a próxima empresa",
              "a oportunidade passará para a próxima empresa",
              "daremos sequência com a próxima empresa",
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
              "Passando novamente para saber se ",
              "Só retomando o contato para confirmar se ",
              "Quero confirmar com vocês se ",
              "Retomo a conversa apenas para saber se ",
              "Voltando rapidamente para entender se ",
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
        /\bAinda estamos organizando as empresas selecionadas dessa etapa\./i,
        () =>
          pick(
            [
              "Seguimos organizando as empresas selecionadas dessa etapa.",
              "Continuamos organizando as empresas selecionadas para essa etapa.",
              "A organização das empresas dessa etapa continua em andamento.",
              "Ainda estamos definindo as empresas selecionadas dessa etapa.",
              "Seguimos estruturando a lista de empresas dessa etapa.",
              "A definição das empresas selecionadas ainda está acontecendo.",
              "Continuamos trabalhando na organização das empresas dessa etapa.",
              "Ainda estamos fechando a lista de empresas selecionadas.",
              "A lista de empresas desta etapa ainda está sendo organizada.",
              "Seguimos concluindo a seleção de empresas para esta etapa.",
            ],
            option,
          ),
      ),
  },
  {
    label: "limited_slots_follow_up",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bComo são poucas vagas,\s+vou precisar seguir com a próxima empresa da lista caso não seja uma prioridade para vocês agora\./i,
        () =>
          pick(
            [
              "Como temos poucas vagas, precisarei avançar com a próxima empresa da lista se isso não for prioridade para vocês agora.",
              "As vagas são limitadas; por isso, caso não seja uma prioridade agora, seguirei com a próxima empresa da lista.",
              "Por trabalharmos com poucas vagas, vou dar sequência com a próxima empresa se vocês não quiserem priorizar isso agora.",
              "Como a lista tem poucas vagas, precisarei chamar a próxima empresa caso este não seja o momento de vocês.",
              "Temos poucas vagas disponíveis. Se não for prioridade agora, vou avançar com a próxima empresa da lista.",
              "A quantidade de vagas é pequena, então seguirei com a próxima empresa caso vocês não queiram avançar neste momento.",
              "Por conta do limite de vagas, a próxima empresa da lista será chamada se isso não estiver entre as prioridades de vocês agora.",
              "Como as vagas são restritas, preciso seguir a lista caso vocês prefiram não avançar agora.",
              "A lista é curta e, se não for prioridade neste momento, entrarei em contato com a próxima empresa.",
              "Há poucas vagas nesta etapa; se agora não for o melhor momento, vou liberar a oportunidade para a próxima empresa.",
            ],
            option,
          ),
      ),
  },
  {
    label: "follow_up_preference",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bMas,\s*sinceramente,\s*gostaríamos bastante que\s+([^.!?\n]+?)\s+participasse\./i,
        (match) =>
          pick(
            [
              `Ainda assim, gostaríamos muito que ${match[1]} participasse.`,
              `Nossa preferência, sinceramente, seria contar com ${match[1]}.`,
              `Mesmo assim, seria muito bom ter ${match[1]} nesta etapa.`,
              `Apesar disso, queremos bastante que ${match[1]} participe.`,
              `De toda forma, nossa vontade é avançar com ${match[1]}.`,
              `Ainda gostaríamos bastante de incluir ${match[1]} nesta etapa.`,
              `Sendo bem sincera, preferimos seguir com ${match[1]}.`,
              `Mesmo com o limite da lista, gostaríamos de contar com ${match[1]}.`,
              `A nossa preferência continua sendo a participação ${contractWithDe(match[1])}.`,
              `Se for possível avançar, gostaríamos muito que fosse com ${match[1]}.`,
            ],
            option,
          ),
      ),
  },
  {
    label: "preference_cta",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bGostaríamos muito que fossem vocês\./i,
        () =>
          pick(
            [
              "Nossa preferência é avançar com vocês.",
              "Gostaríamos bastante de seguir com vocês.",
              "Seria muito bom contar com vocês.",
              "A ideia é que essa oportunidade fique com vocês.",
              "Queremos muito ter vocês nesta etapa.",
              "Nossa vontade é conduzir essa etapa com vocês.",
              "A preferência continua sendo por vocês.",
              "Seria ótimo se pudéssemos avançar juntos.",
              "Gostaríamos que vocês ocupassem essa vaga.",
              "Esperamos poder seguir com vocês.",
            ],
            option,
          ),
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
              "Posso detalhar melhor para você?",
              "Quer que eu te mostre como isso funciona?",
              "Faz sentido eu explicar isso em mais detalhes?",
              "Posso te contar melhor como funciona?",
              "Quer entender melhor essa parte?",
              "Posso explicar isso de forma mais clara?",
              "Você quer que eu detalhe como funciona?",
            ],
            option,
          ),
      ),
  },
  {
    label: "permission_cta_explain_how",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bPosso te explicar rapidamente como funciona\?/i,
        () =>
          pick(
            [
              "Posso te explicar rapidamente como funciona?",
              "Quer que eu te mostre em poucas palavras como funciona?",
              "Posso te contar rapidamente como essa etapa funciona?",
              "Faz sentido eu te explicar de forma breve como funciona?",
              "Quer entender rapidamente como funciona?",
              "Posso resumir para você como funciona?",
              "Te explico em poucas palavras como funciona?",
              "Posso mostrar de forma rápida como essa etapa funciona?",
              "Quer que eu explique o funcionamento de maneira objetiva?",
              "Posso te passar uma explicação rápida de como funciona?",
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
              `Quer receber ${match[1]}?`,
              `Posso compartilhar ${match[1]} com você?`,
              `Faz sentido eu enviar ${match[1]} agora?`,
              `Quer que eu encaminhe ${match[1]}?`,
              `Posso apresentar ${match[1]}?`,
              `Você gostaria de receber ${match[1]}?`,
              `Te envio ${match[1]}?`,
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
              "Se vocês entenderem que não faz sentido",
              "Caso não seja uma prioridade agora",
              "Se preferirem não seguir nesta etapa",
              "Caso decidam não avançar agora",
              "Se não houver interesse neste momento",
            ],
            option,
          ),
      ),
  },
  {
    label: "delivery_deadline",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\s*[—-]\s*tudo pronto em\s+(\d+\s*(?:a|e|-)\s*\d+\s+dias)([.!?]?)/i,
        (match) =>
          pick(
            [
              ` — com tudo pronto em ${match[1]}${match[2]}`,
              `, com entrega completa em ${match[1]}${match[2]}`,
              ` — tudo estruturado em ${match[1]}${match[2]}`,
              `, ficando tudo pronto em ${match[1]}${match[2]}`,
              ` — com conclusão em ${match[1]}${match[2]}`,
              `, com toda a estrutura pronta em ${match[1]}${match[2]}`,
              ` — e a entrega acontece em ${match[1]}${match[2]}`,
              `, para ficar tudo pronto em ${match[1]}${match[2]}`,
              ` — com prazo total de ${match[1]}${match[2]}`,
              `, com a estrutura finalizada em ${match[1]}${match[2]}`,
            ],
            option,
          ),
      ),
  },
  {
    label: "competitor_closing",
    apply: (text, option) =>
      replaceFirst(
        text,
        /\bpossivelmente um concorrente direto\b/i,
        () =>
          pick(
            [
              "possivelmente um concorrente direto",
              "que talvez seja um concorrente direto",
              "talvez um concorrente direto",
              "com possibilidade de ser um concorrente direto",
              "que pode ser um concorrente direto",
              "possivelmente, um concorrente direto",
              "talvez até um concorrente direto",
              "muito possivelmente um concorrente direto",
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
      const connector = pick(
        ["Ainda assim", "Contudo", "Porém", "Mesmo assim", "Apesar disso", "No entanto", "Em contrapartida", "Por outro lado"],
        option,
      );
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

function mixSeed(seed: number, attempt: number, ruleIndex: number) {
  let value =
    seed ^
    Math.imul(attempt + 1, 0x45d9f3b) ^
    Math.imul(ruleIndex + 1, 0x27d4eb2d);

  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);

  return (value ^ (value >>> 16)) >>> 0;
}

export function buildConservativeRewriteCandidates(original: string, seed: number) {
  const candidates: ConservativeRewriteCandidate[] = [];
  const seen = new Set<string>([candidateKey(original)]);

  for (let attempt = 0; attempt < 192; attempt += 1) {
    let text = original;
    const applied: string[] = [];
    const allRules = [...rewriteRules, ...structuralRules];

    allRules.forEach((rule, ruleIndex) => {
      const mixedSeed = mixSeed(seed, attempt, ruleIndex);
      const shouldApply = mixedSeed % 6 !== 0;

      if (!shouldApply) {
        return;
      }

      const result = rule.apply(text, mixedSeed >>> 3);

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
