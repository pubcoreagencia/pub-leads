import { requestApify } from "@/src/lib/apify/client";
import { createApifySourceDefinition } from "@/src/lib/apify/sources";

type ApifyTaskListItem = {
  actId?: string;
  actorId?: string;
  description?: string;
  id: string;
  input?: Record<string, unknown>;
  name?: string;
  title?: string;
};

export async function listApifyTaskSources() {
  const response = await requestApify<{ items?: ApifyTaskListItem[] }>("/actor-tasks?limit=100&desc=0").catch(() => ({ items: [] }));
  const items = Array.isArray(response.items) ? response.items : [];

  return items.map((task) =>
    createApifySourceDefinition({
      actorId: task.actorId ?? task.actId ?? null,
      defaultInput: task.input ?? null,
      description: task.description ?? null,
      kind: "task",
      name: task.title || task.name || task.id,
      taskId: task.id,
    }),
  );
}
