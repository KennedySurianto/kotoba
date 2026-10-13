import { toHiragana, toRomaji } from "wanakana";

export function normalizeReading(value: string) {
  return toHiragana(value.normalize("NFKC").trim());
}

export function matchesReading(value: string, acceptedReadings: string[]) {
  const answer = normalizeReading(value);
  return answer.length > 0 && acceptedReadings.some((reading) => {
    const normalized = normalizeReading(reading);
    const variants = normalized.endsWith("は") ? [normalized, `${normalized.slice(0, -1)}わ`] : [normalized];
    return variants.includes(answer);
  });
}

export function normalizeMeaning(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[~〜～]/g, "")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/[\s.,!?;:'"()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningVariants(value: string) {
  const variants = [normalizeMeaning(value)];
  // Parenthetical labels such as "before a noun" are study notes, not part of
  // the meaning a learner needs to recall.
  const withoutNounLabel = value.replace(/\s*\(\s*before a noun\s*\)/gi, "");
  if (withoutNounLabel !== value) variants.push(normalizeMeaning(withoutNounLabel));
  return variants.filter(Boolean);
}

export function matchesMeaning(value: string, acceptedMeanings: string[], meaningAliases: string[] = []) {
  const answer = normalizeMeaning(value);
  return answer.length > 0 && [...acceptedMeanings, ...meaningAliases].some((meaning) => meaningVariants(meaning).includes(answer));
}

export function matchesKanjiAnswer(reading: string, meaning: string, item: { acceptedReadings: string[]; meanings: string[]; acceptedMeanings?: string[]; acceptedAnswerPairs?: { acceptedReadings: string[]; meanings: string[]; acceptedMeanings?: string[] }[] }) {
  const pairs = item.acceptedAnswerPairs ?? [{ acceptedReadings: item.acceptedReadings, meanings: item.meanings, acceptedMeanings: item.acceptedMeanings }];
  return pairs.some((pair) => matchesReading(reading, pair.acceptedReadings) && matchesMeaning(meaning, pair.meanings, pair.acceptedMeanings));
}

export function romaji(reading: string) {
  return toRomaji(toHiragana(reading));
}
