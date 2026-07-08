export type MessageTone = "direto" | "consultivo" | "informal" | "premium" | "divertido";

export type MessageObjective =
  | "apresentar_servico"
  | "marcar_reuniao"
  | "vender_trafego_pago"
  | "vender_automacao"
  | "vender_site"
  | "vender_gestao_redes_sociais";

export const messageTones: Array<{ id: MessageTone; label: string }> = [
  { id: "direto", label: "direto" },
  { id: "consultivo", label: "consultivo" },
  { id: "informal", label: "informal" },
  { id: "premium", label: "premium" },
  { id: "divertido", label: "divertido" },
];

export const messageObjectives: Array<{ id: MessageObjective; label: string }> = [
  { id: "apresentar_servico", label: "apresentar serviço" },
  { id: "marcar_reuniao", label: "marcar reunião" },
  { id: "vender_trafego_pago", label: "vender tráfego pago" },
  { id: "vender_automacao", label: "vender automação" },
  { id: "vender_site", label: "vender site" },
  { id: "vender_gestao_redes_sociais", label: "vender gestão de redes sociais" },
];

export const messageToneLabels = messageTones.reduce<Record<MessageTone, string>>(
  (labels, tone) => {
    labels[tone.id] = tone.label;
    return labels;
  },
  {} as Record<MessageTone, string>,
);

export const messageObjectiveLabels = messageObjectives.reduce<Record<MessageObjective, string>>(
  (labels, objective) => {
    labels[objective.id] = objective.label;
    return labels;
  },
  {} as Record<MessageObjective, string>,
);
