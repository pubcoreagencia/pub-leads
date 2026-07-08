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
