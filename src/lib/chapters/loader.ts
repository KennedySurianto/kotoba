import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { ChapterSchema, type Chapter } from "./schema";

const chaptersDirectory = path.join(process.cwd(), "chapters");

export async function getChapters(): Promise<Chapter[]> {
  let files: string[];
  try {
    files = (await readdir(chaptersDirectory)).filter((file) => /^\d+\.json$/i.test(file)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const chapters = await Promise.all(files.map(async (file) => {
    const fullPath = path.join(chaptersDirectory, file);
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(fullPath, "utf8"));
    } catch (error) {
      throw new Error(`Invalid chapter file ${file}: ${(error as Error).message}`);
    }
    const parsed = ChapterSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`Invalid chapter file ${file}: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
    if (parsed.data.id !== path.basename(file, ".json")) throw new Error(`Chapter id in ${file} must match its filename.`);
    validateUniqueIds(parsed.data, file);
    return parsed.data;
  }));
  return chapters;
}

function validateUniqueIds(chapter: Chapter, file: string) {
  const vocabIds = chapter.vocabulary.map((word) => word.id);
  const kanjiIds = chapter.kanji.map((item) => item.id);
  const exampleIds = chapter.kanji.flatMap((item) => item.examples.map((example) => example.id));
  for (const [label, ids] of [["vocabulary", vocabIds], ["kanji", kanjiIds], ["kanji examples", exampleIds]] as const) {
    if (new Set(ids).size !== ids.length) throw new Error(`Invalid chapter file ${file}: ${label} IDs must be unique.`);
  }
}

export async function getChapter(id: string) {
  return (await getChapters()).find((chapter) => chapter.id === id) ?? null;
}
