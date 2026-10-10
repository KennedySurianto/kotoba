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

export function matchesMeaning(value: string, acceptedMeanings: string[]) {
  const normalize = (text: string) => text.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
  const answer = normalize(value);
  return answer.length > 0 && acceptedMeanings.some((meaning) => normalize(meaning) === answer);
}

export function matchesKanjiAnswer(reading: string, meaning: string, item: { acceptedReadings: string[]; meanings: string[]; acceptedAnswerPairs?: { acceptedReadings: string[]; meanings: string[] }[] }) {
  const pairs = item.acceptedAnswerPairs ?? [{ acceptedReadings: item.acceptedReadings, meanings: item.meanings }];
  return pairs.some((pair) => matchesReading(reading, pair.acceptedReadings) && matchesMeaning(meaning, pair.meanings));
}

export function romaji(reading: string) {
  return toRomaji(toHiragana(reading));
}
