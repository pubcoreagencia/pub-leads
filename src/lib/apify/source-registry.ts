import { listApifyActorSources } from "@/src/lib/apify/actors";
import { fallbackApifySources } from "@/src/lib/apify/sources";
import { listApifyTaskSources } from "@/src/lib/apify/tasks";
import type { ApifySourceDefinition } from "@/src/lib/apify/types";
import {
  listCachedApifySources,
  upsertCachedApifySources,
} from "@/src/lib/turso/apify-sources-repository";

function dedupeSources(sources: ApifySourceDefinition[]) {
  const byId = new Map<string, ApifySourceDefinition>();

  for (const source of sources) {
    if (!byId.has(source.id)) {
      byId.set(source.id, source);
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "task" ? -1 : 1;
    if (a.isRecommended !== b.isRecommended) return a.isRecommended ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function discoverApifySources(userId: string) {
  const discovered = await Promise.all([listApifyTaskSources(), listApifyActorSources()]);
  const sources = dedupeSources([...discovered.flat(), ...fallbackApifySources()]);

  await upsertCachedApifySources(userId, sources);

  return sources;
}

export async function getApifySources(userId: string) {
  const cached = await listCachedApifySources(userId);

  if (cached.length > 0) {
    return cached;
  }

  return discoverApifySources(userId);
}

export async function resolveApifySource(userId: string, sourceId: string) {
  const sources = await getApifySources(userId);

  return sources.find((source) => source.id === sourceId && source.enabled) ?? null;
}
