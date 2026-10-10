import { z } from "zod";

const JapaneseText = z.string().min(1);
const Reading = z.object({
  id: z.string().min(1),
  japanese: JapaneseText,
  reading: JapaneseText,
  meanings: z.array(z.string().min(1)).min(1),
  acceptedReadings: z.array(JapaneseText).min(1),
});

export const VocabularySchema = Reading.extend({
  category: z.string().min(1),
  notes: z.string().default(""),
});

export const KanjiSchema = z.object({
  id: z.string().min(1),
  character: JapaneseText,
  meanings: z.array(z.string().min(1)).min(1),
  strokeCount: z.number().int().positive(),
  onyomi: z.array(z.string()),
  kunyomi: z.array(z.string()),
  notes: z.string().default(""),
  examples: z.array(Reading.extend({})),
});

export const ChapterSchema = z.object({
  id: z.string().regex(/^\d{2,}$/),
  title: z.string().min(1),
  titleJapanese: JapaneseText,
  description: z.string().default(""),
  vocabulary: z.array(VocabularySchema),
  kanji: z.array(KanjiSchema),
});

export type Vocabulary = z.infer<typeof VocabularySchema>;
export type Kanji = z.infer<typeof KanjiSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
