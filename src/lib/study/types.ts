import type { Chapter } from "@/lib/chapters/schema";

export type StudyItem = {
  key: string;
  japanese: string;
  reading: string;
  acceptedReadings: string[];
  acceptedAnswerPairs?: { acceptedReadings: string[]; meanings: string[]; acceptedMeanings?: string[] }[];
  meanings: string[];
  acceptedMeanings?: string[];
  category?: string;
  notes?: string;
  kanji?: string;
  onyomi?: string[];
  kunyomi?: string[];
  strokeCount?: number;
};

export type JapaneseInputCandidate = { japanese: string; readings: string[] };

export function japaneseInputCandidates(chapters: Chapter[]): JapaneseInputCandidate[] {
  const candidates = new Map<string, Set<string>>();
  const add = (japanese: string, primaryReading: string, acceptedReadings: string[]) => {
    const forms = japanese.split(/\s*\/\s*/).map((form) => form.trim()).filter(Boolean);
    forms.forEach((form, index) => {
      const readings = acceptedReadings.length === forms.length ? [acceptedReadings[index]] : [primaryReading, ...acceptedReadings];
      const existing = candidates.get(form) ?? new Set<string>();
      readings.forEach((reading) => { if (reading) existing.add(reading); });
      candidates.set(form, existing);
    });
  };
  chapters.forEach((chapter) => {
    chapter.vocabulary.forEach((word) => add(word.japanese, word.reading, word.acceptedReadings));
    chapter.kanji.forEach((kanji) => {
      add(kanji.character, "", [...kanji.onyomi, ...kanji.kunyomi]);
      kanji.examples.forEach((example) => add(example.japanese, example.reading, example.acceptedReadings));
    });
  });
  return Array.from(candidates, ([japanese, readings]) => ({ japanese, readings: Array.from(readings) }));
}

export function studyItems(chapter: Chapter, subject: "vocabulary" | "kanji"): StudyItem[] {
  if (subject === "vocabulary") return chapter.vocabulary.map((word) => ({ ...word, key: `${chapter.id}:v:${word.id}` }));
  const examples = chapter.kanji.flatMap((kanji) => kanji.examples.map((example) => ({
    ...example,
    key: `${chapter.id}:k:${kanji.id}:${example.id}`,
    kanji: kanji.character,
    onyomi: kanji.onyomi,
    kunyomi: kanji.kunyomi,
    strokeCount: kanji.strokeCount,
    notes: kanji.notes,
  })));
  return examples.map((example) => {
    const sameSpelling = examples.filter((candidate) => candidate.japanese === example.japanese);
    const answerPairs = Array.from(new Map(sameSpelling.map((candidate) => {
      const pair = { acceptedReadings: candidate.acceptedReadings, meanings: candidate.meanings, acceptedMeanings: candidate.acceptedMeanings };
      return [JSON.stringify(pair), pair] as const;
    })).values());
    return {
      ...example,
      ...(answerPairs.length > 1 ? {
        acceptedAnswerPairs: answerPairs,
      } : {}),
    };
  });
}
