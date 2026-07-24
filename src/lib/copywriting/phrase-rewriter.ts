import { contextualSynonyms } from "./synonym-bank";

function pick<T>(items: T[], seed: number, offset = 0) {
  return items[Math.abs(seed + offset) % items.length];
}

export function applyContextualSynonyms(text: string, seed: number) {
  let next = text;
  const applied: string[] = [];

  contextualSynonyms.forEach((rule, index) => {
    if ((seed + index) % 4 === 0) {
      return;
    }

    let changed = false;
    next = next.replace(rule.pattern, (match) => {
      if (changed) {
        return match;
      }

      changed = true;
      return pick(rule.replacements, seed, index);
    });

    if (changed) {
      applied.push(rule.label);
    }
  });

  return { applied, text: next };
}
