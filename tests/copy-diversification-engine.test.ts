import assert from "node:assert/strict";
import test from "node:test";

import { diversifyCopy } from "../src/lib/copywriting";

function diversify(text: string, variantSeed = 1) {
  return diversifyCopy({
    funnelStepName: "Introdução",
    mode: "funnel_step",
    originalText: text,
    renderedText: text,
    variantSeed,
  });
}

test("reescreve sem inventar um contexto comercial ausente", () => {
  const original =
    "A maioria das clínicas perde agendamentos não por falta de qualidade, mas porque o paciente não encontra informações claras antes de decidir. Organizamos esse caminho sem mudar a rotina da equipe. Quer ver um exemplo?";
  const result = diversify(original);

  assert.notEqual(result.message, original);
  assert.match(result.message, /clínicas/i);
  assert.match(result.message, /agendamentos/i);
  assert.match(result.message, /rotina da equipe/i);
  assert.match(result.message, /\?/);
  assert.doesNotMatch(result.message, /\bselecionad[ao]|\bprojeto\b|presença digital/i);
  assert.ok(result.stats.semanticPreservationScore >= 82);
});

test("preserva nomes, números, prazo, oferta, marca e URL", () => {
  const original =
    "A Clínica Exemplo foi selecionada para o Projeto Niterói. A entrega inclui site profissional, Instagram e WhatsApp Business, tudo pronto em 3 a 7 dias. A Agência PUB apresenta os detalhes em https://pub-start.pages.dev/. Posso te explicar melhor?";
  const result = diversify(original, 2);

  for (const literal of [
    "Clínica Exemplo",
    "Projeto Niterói",
    "site profissional",
    "Instagram",
    "WhatsApp Business",
    "3 a 7 dias",
    "Agência PUB",
    "https://pub-start.pages.dev/",
  ]) {
    assert.ok(result.message.includes(literal), `A mensagem deveria preservar: ${literal}`);
  }

  assert.match(result.message, /\?/);
  assert.equal(result.stats.warnings.length, 0);
});

test("gera uma única saída e varia a construção entre tentativas", () => {
  const original =
    "Me chamo Luana, representante comercial da Agência PUB. Estamos entrando em contato pois a Acqua Fitness Academia foi selecionada para o nosso Projeto Vitória porque identificamos uma oportunidade clara no posicionamento digital de vocês. A empresa já entrega valor no mercado, mas a forma como aparece hoje no digital pode estar fazendo vocês perderem procura, contatos e vendas. Posso te explicar melhor?";
  const messages = new Set(Array.from({ length: 6 }, (_, index) => diversify(original, index + 1).message));

  assert.ok(messages.size >= 3);

  for (const message of messages) {
    assert.match(message, /Acqua Fitness Academia/);
    assert.match(message, /Projeto Vitória/);
    assert.match(message, /Agência PUB/);
    assert.match(message, /procura, contatos e vendas/);
    assert.match(message, /\?/);
  }
});

test("mantém o objetivo e os fatos dos passos principais do funil", () => {
  const steps = [
    {
      mustKeep: ["boa tarde"],
      name: "Primeiro contato",
      text: "Olá, boa tarde!",
    },
    {
      mustKeep: ["Agência PUB", "Clínica Exemplo", "5", "Projeto Niterói"],
      name: "Introdução",
      text: "Eu sou a Luana, representante comercial da Agência PUB. Estou entrando em contato porque a Clínica Exemplo foi uma das 5 empresas de odontologia selecionadas para o nosso Projeto Niterói. Posso te explicar rapidamente como funciona?",
    },
    {
      mustKeep: ["site profissional", "Instagram", "Google Meu Negócio", "e-mail corporativo", "WhatsApp Business", "3 a 7 dias"],
      name: "Explicação curta",
      text: "O projeto é voltado para empresas já consolidadas, mas que ainda não têm uma presença digital no nível que merecem. A entrega inclui site profissional, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business — tudo pronto em 3 a 7 dias.",
    },
    {
      mustKeep: ["Agência PUB", "L'Oréal Paris", "Globosat", "Vamos Dubai", "https://pub-start.pages.dev/"],
      name: "Autoridade",
      text: "A estrutura é feita pela Agência PUB, que já atuou com marcas e nomes como L'Oréal Paris, Globosat, Circo Voador, Gabriel Pensador, Diogo Defante, Paulinho Serra e Vamos Dubai. O site do serviço é https://pub-start.pages.dev/",
    },
    {
      mustKeep: ["5", "concorrente direto"],
      name: "Escassez",
      text: "Nessa etapa são apenas 5 empresas selecionadas. Caso não faça sentido para vocês, a vaga segue para a próxima empresa da lista — possivelmente um concorrente direto.",
    },
    {
      mustKeep: ["detalhes", "entrega", "valores"],
      name: "CTA",
      text: "Gostaríamos muito que fossem vocês. Posso te passar os detalhes da entrega e valores?",
    },
  ];

  for (const step of steps) {
    const result = diversifyCopy({
      funnelStepName: step.name,
      mode: "funnel_step",
      originalText: step.text,
      renderedText: step.text,
      variantSeed: 3,
    });

    for (const literal of step.mustKeep) {
      assert.ok(
        result.message.toLocaleLowerCase("pt-BR").includes(literal.toLocaleLowerCase("pt-BR")),
        `${step.name} deveria preservar: ${literal}`,
      );
    }

    assert.ok(result.stats.semanticPreservationScore >= 82, `${step.name} perdeu conteúdo relevante`);
  }
});
