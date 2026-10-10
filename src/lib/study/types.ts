import type { Chapter } from "@/lib/chapters/schema";

export type StudyItem = {
  key: string;
  japanese: string;
  reading: string;
  acceptedReadings: string[];
  acceptedAnswerPairs?: { acceptedReadings: string[]; meanings: string[] }[];
  meanings: string[];
  category?: string;
  notes?: string;
  kanji?: string;
  onyomi?: string[];
  kunyomi?: string[];
  strokeCount?: number;
};

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
      const pair = { acceptedReadings: candidate.acceptedReadings, meanings: candidate.meanings };
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
