import type { ApifyLeadMapping, ApifySourceType } from "@/src/lib/apify/types";

function normalize(value: string | null | undefined) {
  return value?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ?? "";
}

export function classifyApifySource(input: { actorId?: string | null; name?: string | null; taskId?: string | null }) {
  const text = normalize(`${input.name ?? ""} ${input.actorId ?? ""} ${input.taskId ?? ""}`);

  if (text.includes("google") && (text.includes("map") || text.includes("place"))) {
    return {
      category: "google_maps" as ApifySourceType,
      estimatedCostLabel: "Medio",
      leadMapping: "google_maps" as ApifyLeadMapping,
      supportedUse: "Buscar empresas locais",
    };
  }

  if (text.includes("instagram") || text.includes("insta")) {
    return {
      category: "instagram" as ApifySourceType,
      estimatedCostLabel: "Medio",
      leadMapping: "instagram_profile" as ApifyLeadMapping,
      supportedUse: "Buscar contas/perfis do Instagram",
    };
  }

  if (text.includes("google") && (text.includes("search") || text.includes("serp"))) {
    return {
      category: "google_search" as ApifySourceType,
      estimatedCostLabel: "Baixo",
      leadMapping: "google_search" as ApifyLeadMapping,
      supportedUse: "Buscar URLs, sites e perfis por termo",
    };
  }

  return {
    category: "generic" as ApifySourceType,
    estimatedCostLabel: "Desconhecido",
    leadMapping: "generic" as ApifyLeadMapping,
    supportedUse: "Executar fonte generica com revisao manual",
  };
}
