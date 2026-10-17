import { notFound } from "next/navigation";
import { StudySession } from "@/components/study/study-session";
import { getChapters } from "@/lib/chapters/loader";
import { japaneseInputCandidates, studyItems } from "@/lib/study/types";

export async function generateStaticParams() {
  const chapters = await getChapters();
  return chapters.flatMap((chapter) => ["vocabulary", "kanji"].flatMap((subject) => ["learn", "flashcards", "quiz"].map((mode) => ({ chapterId: chapter.id, subject, mode }))));
}
export const dynamicParams = false;

export default async function StudyPage({ params }: { params: Promise<{ chapterId: string; subject: string; mode: string }> }) {
  const { chapterId, subject, mode } = await params;
  if ((subject !== "vocabulary" && subject !== "kanji") || (mode !== "learn" && mode !== "flashcards" && mode !== "quiz")) notFound();
  const chapters = await getChapters();
  const chapter = chapters.find((item) => item.id === chapterId);
  if (!chapter) notFound();
  return <StudySession chapterId={chapter.id} chapterTitle={chapter.title} subject={subject} mode={mode} initialItems={studyItems(chapter, subject)} japaneseCandidates={japaneseInputCandidates(chapters)} />;
}
