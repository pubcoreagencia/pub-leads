export type LeadCategoryId =
  | "restaurante"
  | "bar"
  | "cafeteria"
  | "hotel"
  | "pousada"
  | "academia"
  | "clinica"
  | "dentista"
  | "loja"
  | "oficina"
  | "imobiliaria"
  | "salao_de_beleza"
  | "pet_shop"
  | "escola"
  | "mercado";

export type LeadCategory = {
  id: LeadCategoryId;
  label: string;
};

export const leadCategories: LeadCategory[] = [
  { id: "restaurante", label: "restaurante" },
  { id: "bar", label: "bar" },
  { id: "cafeteria", label: "cafeteria" },
  { id: "hotel", label: "hotel" },
  { id: "pousada", label: "pousada" },
  { id: "academia", label: "academia" },
  { id: "clinica", label: "clinica" },
  { id: "dentista", label: "dentista" },
  { id: "loja", label: "loja" },
  { id: "oficina", label: "oficina" },
  { id: "imobiliaria", label: "imobiliaria" },
  { id: "salao_de_beleza", label: "salao de beleza" },
  { id: "pet_shop", label: "pet shop" },
  { id: "escola", label: "escola" },
  { id: "mercado", label: "mercado" },
];

export const leadCategoryLabels = leadCategories.reduce<Record<LeadCategoryId, string>>(
  (labels, category) => {
    labels[category.id] = category.label;
    return labels;
  },
  {} as Record<LeadCategoryId, string>,
);

function normalizeCategoryText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
}

const categoryAliases: Record<string, LeadCategoryId> = {
  bares: "bar",
  cafeterias: "cafeteria",
  clinica: "clinica",
  "clinica medica": "clinica",
  clinicas: "clinica",
  "clinicas medicas": "clinica",
  dentistas: "dentista",
  hoteis: "hotel",
  lojas: "loja",
  mercados: "mercado",
  oficinas: "oficina",
  petshops: "pet_shop",
  restaurantes: "restaurante",
  salao: "salao_de_beleza",
  "salao de beleza": "salao_de_beleza",
  saloes: "salao_de_beleza",
  "saloes de beleza": "salao_de_beleza",
};

export function resolveLeadCategoryId(value: string): LeadCategoryId | null {
  const normalized = normalizeCategoryText(value);

  if (!normalized) {
    return null;
  }

  const direct = leadCategories.find(
    (category) =>
      normalizeCategoryText(category.id) === normalized ||
      normalizeCategoryText(category.label) === normalized,
  );

  return direct?.id ?? categoryAliases[normalized] ?? null;
}

export function getLeadCategoryLabel(value: string) {
  const categoryId = resolveLeadCategoryId(value);

  return categoryId ? leadCategoryLabels[categoryId] : value.trim();
}
