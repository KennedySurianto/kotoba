import type { NumbersPracticeCategoryId, NumbersPracticeQuestion } from "@/lib/study/numbers-practice";

export type NumbersPracticeOrder = "shuffle" | "category";
export type SavedNumbersPractice = {
  runId: string;
  categoryIds: NumbersPracticeCategoryId[];
  order: NumbersPracticeOrder;
  japaneseInputMode?: "hiragana" | "katakana";
  questions: NumbersPracticeQuestion[];
  questionIds: string[];
  index: number;
  answer: string;
  checked: boolean | null;
  correct: number;
  incorrect: number;
  skipped: number;
  updatedAt: string;
};

const KEY = "kotoba-numbers-practice-v1";

export function getNumbersPracticeSession(): SavedNumbersPractice | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as SavedNumbersPractice | null;
    if (!value || !Array.isArray(value.questionIds) || value.questionIds.length === 0 || !Array.isArray(value.questions) || typeof value.runId !== "string") return null;
    return value;
  } catch { return null; }
}

export function saveNumbersPracticeSession(session: SavedNumbersPractice) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify({ ...session, updatedAt: new Date().toISOString() })); }
  catch { /* A full or unavailable localStorage should not interrupt practice. */ }
}

export function removeNumbersPracticeSession() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(KEY); }
  catch { /* Ignore unavailable localStorage. */ }
}
