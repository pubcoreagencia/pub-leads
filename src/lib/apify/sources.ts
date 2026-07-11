import type { ApifySourceDefinition, ApifySourceKind } from "@/src/lib/apify/types";
import { classifyApifySource } from "@/src/lib/apify/source-classifier";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function makeApifySourceId(kind: ApifySourceKind, id: string) {
  return `apify-${kind}-${slugify(id).replace(/\//g, "-")}`;
}

export function createApifySourceDefinition(input: {
  actorId: string | null;
  defaultInput?: Record<string, unknown> | null;
  description?: string | null;
  inputSchema?: Record<string, unknown> | null;
  kind: ApifySourceKind;
  name: string;
  recommended?: boolean;
  taskId: string | null;
}): ApifySourceDefinition {
  const classifier = classifyApifySource(input);
  const stableId = input.taskId ?? input.actorId ?? input.name;

  return {
    actorId: input.actorId,
    category: classifier.category,
    defaultInput: input.defaultInput ?? null,
    description: input.description ?? null,
    enabled: true,
    estimatedCostLabel: classifier.estimatedCostLabel,
    id: makeApifySourceId(input.kind, stableId),
    inputSchema: input.inputSchema ?? null,
    isRecommended: Boolean(input.recommended || classifier.category === "google_maps"),
    kind: input.kind,
    leadMapping: classifier.leadMapping,
    metadata: {},
    name: input.name,
    requiresInput: input.kind === "actor",
    supportedUse: classifier.supportedUse,
    taskId: input.taskId,
  };
}

export function fallbackApifySources() {
  const googleMapsActorId = process.env.APIFY_GOOGLE_MAPS_ACTOR_ID?.trim() || "compass/crawler-google-places";
  const instagramActorId = process.env.APIFY_INSTAGRAM_ACTOR_ID?.trim() || "apify/instagram-scraper";
  const googleSearchActorId = process.env.APIFY_GOOGLE_SEARCH_ACTOR_ID?.trim();

  return [
    createApifySourceDefinition({
      actorId: googleMapsActorId,
      description: "Fonte padrao para buscar empresas locais no Google Maps via Apify.",
      kind: "actor",
      name: "Google Maps Scraper",
      recommended: true,
      taskId: null,
    }),
    createApifySourceDefinition({
      actorId: instagramActorId,
      description: "Fonte para buscar perfis e contas do Instagram via Apify.",
      kind: "actor",
      name: "Instagram Scraper",
      taskId: null,
    }),
    ...(googleSearchActorId
      ? [
          createApifySourceDefinition({
            actorId: googleSearchActorId,
            description: "Fonte para buscar URLs e contatos pelo Google Search via Apify.",
            kind: "actor" as const,
            name: "Google Search Scraper",
            taskId: null,
          }),
        ]
      : []),
  ];
}
