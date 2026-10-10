import { notFound } from "next/navigation";
import { ChapterExperience } from "@/components/chapters/chapter-experience";
import { getChapter, getChapters } from "@/lib/chapters/loader";

export async function generateStaticParams() { return (await getChapters()).map((chapter) => ({ chapterId: chapter.id })); }
export const dynamicParams = false;

export default async function ChapterPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = await params;
  const chapter = await getChapter(chapterId);
  if (!chapter) notFound();
  return <ChapterExperience chapter={chapter} />;
}
