"use client";

export type CardProgress = { correct: number; incorrect: number; difficult: boolean; mastered: boolean; streak: number; lastStudied: string | null; nextReview: string | null };
export type QuizStats = { completedRuns: number; correctAnswers: number; completedRunIds: string[] };
export type ProgressStore = { cards: Record<string, CardProgress>; quizStats: QuizStats; updatedAt: string };
const KEY = "kotoba-progress-v1";
const empty: ProgressStore = { cards: {}, quizStats: { completedRuns: 0, correctAnswers: 0, completedRunIds: [] }, updatedAt: new Date(0).toISOString() };

function normalizeProgress(data: Partial<ProgressStore> | null | undefined): ProgressStore {
  if (!data || typeof data.cards !== "object" || !data.cards) return empty;
  const stats = data.quizStats;
  const completedRuns = stats?.completedRuns;
  const correctAnswers = stats?.correctAnswers;
  return {
    cards: data.cards,
    quizStats: {
      completedRuns: typeof completedRuns === "number" && Number.isFinite(completedRuns) ? Math.max(0, completedRuns) : 0,
      correctAnswers: typeof correctAnswers === "number" && Number.isFinite(correctAnswers) ? Math.max(0, correctAnswers) : 0,
      completedRunIds: Array.isArray(stats?.completedRunIds) ? stats.completedRunIds.filter((id): id is string => typeof id === "string") : [],
    },
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date(0).toISOString(),
  };
}

export function loadProgress(): ProgressStore {
  if (typeof window === "undefined") return empty;
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<ProgressStore> | null;
    return normalizeProgress(data);
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

export function recordCorrectQuizAnswer() {
  const store = loadProgress();
  store.quizStats.correctAnswers += 1;
  saveProgress(store);
  return store;
}

export function recordCompletedQuiz(runId: string) {
  const store = loadProgress();
  if (store.quizStats.completedRunIds.includes(runId)) return store;
  store.quizStats.completedRuns += 1;
  store.quizStats.completedRunIds.push(runId);
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
  const data = normalizeProgress(JSON.parse(text) as Partial<ProgressStore>);
  if (!data || typeof data.cards !== "object") throw new Error("This backup is not a Kotoba progress file.");
  saveProgress(data); return data;
}
