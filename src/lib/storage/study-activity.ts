export type StudyActivity = {
  chapterId: string;
  chapterTitle: string;
  subject: "vocabulary" | "kanji";
  mode: "learn" | "flashcards" | "quiz";
  updatedAt: string;
};

const KEY = "kotoba-last-study-activity-v1";

export function getLastStudyActivity(): StudyActivity | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as StudyActivity | null;
    if (!value || typeof value.chapterId !== "string" || typeof value.updatedAt !== "string") return null;
    return value;
  } catch { return null; }
}

export function recordStudyActivity(activity: Omit<StudyActivity, "updatedAt">) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...activity, updatedAt: new Date().toISOString() } satisfies StudyActivity));
  } catch { /* Activity tracking should never interrupt studying. */ }
}
