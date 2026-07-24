import type { Lead } from "@/schemas/lead";
import type { RenderedPlaceholderContext } from "./types";

function companyName(lead?: Lead | null) {
  return lead?.company || lead?.business_name || lead?.fantasy_name || lead?.name || "sua empresa";
}

function instagramValue(lead?: Lead | null) {
  const metadata = lead?.metadata ?? {};
  const handle = typeof metadata.instagram_handle === "string" ? metadata.instagram_handle : "";
  const url = typeof metadata.instagram_url === "string" ? metadata.instagram_url : "";

  return handle ? `@${handle.replace(/^@/, "")}` : url;
}

function replaceTemplateValue(text: string, names: string[], value: string) {
  return names.reduce((current, name) => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wrappedPattern = new RegExp(`\\{${escapedName}\\}|\\[${escapedName}\\]`, "gi");
    const uppercasePattern = new RegExp(`\\b${escapedName.toUpperCase()}\\b`, "g");

    return current.replace(wrappedPattern, value).replace(uppercasePattern, value);
  }, text);
}

export function buildPlaceholderContext(input: {
  city?: string | null;
  lead?: Lead | null;
  niche?: string | null;
  operatorName?: string | null;
}) {
  const city = input.city?.trim() || input.lead?.city || "";
  const niche = input.niche?.trim() || input.lead?.category || "segmento";
  const operatorName = input.operatorName?.trim() || "representante da Agência PUB";

  return {
    city,
    company: companyName(input.lead),
    instagram: instagramValue(input.lead),
    niche,
    operatorName,
    phone: input.lead?.whatsapp || input.lead?.phone || input.lead?.phone_2 || "",
    project: city ? `Projeto ${city}` : "projeto",
    site: input.lead?.website || "",
  } satisfies RenderedPlaceholderContext;
}

export function renderCopyPlaceholders(text: string, context: RenderedPlaceholderContext) {
  let rendered = text;

  rendered = replaceTemplateValue(rendered, ["intro_operador"], `Eu sou ${context.operatorName}`);
  rendered = replaceTemplateValue(rendered, ["nome", "operador"], context.operatorName);
  rendered = replaceTemplateValue(rendered, ["empresa", "lead"], context.company);
  rendered = replaceTemplateValue(rendered, ["cidade"], context.city);
  rendered = replaceTemplateValue(rendered, ["nicho", "copy", "categoria"], context.niche);
  rendered = replaceTemplateValue(rendered, ["telefone"], context.phone);
  rendered = replaceTemplateValue(rendered, ["site"], context.site);
  rendered = replaceTemplateValue(rendered, ["instagram"], context.instagram);
  rendered = replaceTemplateValue(rendered, ["projeto"], context.project);

  return rendered
    .replace(/\{[a-zA-Z_]+\}/g, "")
    .replace(/\[[A-Z_]+\]/g, "")
    .replace(/\ba\s+foram\b/gi, "a empresa foi")
    .replace(/\bo\s+foram\b/gi, "o negócio foi");
}
