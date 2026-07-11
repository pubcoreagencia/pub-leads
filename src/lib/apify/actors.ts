import { requestApify } from "@/src/lib/apify/client";
import { createApifySourceDefinition } from "@/src/lib/apify/sources";

type ApifyActorListItem = {
  description?: string;
  id?: string;
  name?: string;
  title?: string;
  username?: string;
};

function getActorId(actor: ApifyActorListItem) {
  if (actor.username && actor.name) {
    return `${actor.username}/${actor.name}`;
  }

  return actor.id ?? actor.name ?? "";
}

export async function listApifyActorSources() {
  const response = await requestApify<{ items?: ApifyActorListItem[] }>("/acts?limit=100&desc=0").catch(() => ({ items: [] }));
  const items = Array.isArray(response.items) ? response.items : [];

  return items
    .map((actor) => ({ actor, id: getActorId(actor) }))
    .filter((item) => item.id)
    .map(({ actor, id }) =>
      createApifySourceDefinition({
        actorId: id,
        description: actor.description ?? null,
        kind: "actor",
        name: actor.title || actor.name || id,
        taskId: null,
      }),
    );
}
