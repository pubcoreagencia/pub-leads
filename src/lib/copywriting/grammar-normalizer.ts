export function normalizeBrazilianPortuguese(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([!?.,])\1{1,}/g, "$1")
    .replace(/\b(voc[eê]s)\s+foi\b/gi, "$1 foram")
    .replace(/\ba empresa\s+foram\b/gi, "a empresa foi")
    .replace(/\bo neg[oó]cio\s+foram\b/gi, "o negócio foi")
    .replace(/\ba\s+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^,.!?]{2,80}?)\s+foram\b/g, "$1 foi")
    .replace(/\s+$/gm, "")
    .trim();
}

export function enforceMaxLength(text: string, maxLength?: number) {
  if (!maxLength || text.length <= maxLength) {
    return text;
  }

  const paragraphs = text.split(/\n{2,}/).filter(Boolean);
  const kept: string[] = [];
  let total = 0;

  for (const paragraph of paragraphs) {
    if (total + paragraph.length + 2 > maxLength) {
      continue;
    }

    kept.push(paragraph);
    total += paragraph.length + 2;
  }

  return kept.length > 0 ? kept.join("\n\n") : text.slice(0, maxLength).replace(/\s+\S*$/, "").trim();
}
