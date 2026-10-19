import { notFound, redirect } from "next/navigation";
import { SubjectExperience } from "@/components/chapters/chapter-experience";
import { getChapter, getChapters } from "@/lib/chapters/loader";

export async function generateStaticParams() { return (await getChapters()).flatMap((chapter) => ["vocabulary", "kanji"].map((subject) => ({ chapterId: chapter.id, subject }))); }
export const dynamicParams = false;

export default async function SubjectPage({ params }: { params: Promise<{ chapterId: string; subject: string }> }) {
  const { chapterId, subject } = await params;
  if (subject !== "vocabulary" && subject !== "kanji") notFound();
  const chapter = await getChapter(chapterId);
  if (!chapter) notFound();
  if (subject === "kanji" && chapter.kanji.length === 0) redirect(`/chapter/${chapter.id}`);
  return <SubjectExperience chapter={chapter} subject={subject} />;
}
