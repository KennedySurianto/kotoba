"use client";

export type CardProgress = { correct: number; incorrect: number; difficult: boolean; mastered: boolean; streak: number; lastStudied: string | null; nextReview: string | null };
export type ProgressStore = { cards: Record<string, CardProgress>; updatedAt: string };
const KEY = "kotoba-progress-v1";
const empty: ProgressStore = { cards: {}, updatedAt: new Date(0).toISOString() };

export function loadProgress(): ProgressStore {
  if (typeof window === "undefined") return empty;
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? "null") as ProgressStore | null;
    if (!data || typeof data.cards !== "object") return empty;
    return data;
  } catch { return empty; }
}

export function saveProgress(value: ProgressStore) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify({ ...value, updatedAt: new Date().toISOString() }));
}

export function recordAnswer(key: string, correct: boolean) {
  const store = loadProgress();
  const current = store.cards[key] ?? { correct: 0, incorrect: 0, difficult: false, mastered: false, streak: 0, lastStudied: null, nextReview: null };
  const streak = correct ? current.streak + 1 : 0;
  const days = correct ? Math.min(30, Math.max(1, 2 ** Math.max(0, streak - 1))) : 0;
  const next = new Date(); next.setDate(next.getDate() + days);
  store.cards[key] = { ...current, correct: current.correct + Number(correct), incorrect: current.incorrect + Number(!correct), streak, mastered: streak >= 4, lastStudied: new Date().toISOString(), nextReview: next.toISOString() };
  saveProgress(store);
  return store;
}

export function setDifficult(key: string, difficult: boolean) {
  const store = loadProgress();
  const current = store.cards[key] ?? { correct: 0, incorrect: 0, difficult: false, mastered: false, streak: 0, lastStudied: null, nextReview: null };
  store.cards[key] = { ...current, difficult };
  saveProgress(store);
  return store;
}

export function exportProgress() { return JSON.stringify(loadProgress(), null, 2); }

export function importProgress(text: string) {
  const data = JSON.parse(text) as ProgressStore;
  if (!data || typeof data.cards !== "object") throw new Error("This backup is not a Kotoba progress file.");
  saveProgress(data); return data;
}
