export type SavedQuizSession = {
  runId?: string;
  countsAsSession?: boolean;
  vocabularyDirection?: "japanese-to-english" | "english-to-japanese";
  japaneseInputMode?: "hiragana" | "katakana" | "kanji";
  answerReadingOverride?: string | null;
  id: string;
  href: string;
  chapterId: string;
  chapterTitle: string;
  subject: "vocabulary" | "kanji";
  itemKeys: string[];
  index: number;
  answer: string;
  meaningAnswer: string;
  formalAnswer: boolean;
  beforeNounAnswer: boolean;
  distanceAnswer: "close" | "far" | "";
  checked: boolean | null;
  results: { correct: number; incorrect: number; skipped: number; mistakeKeys: string[]; difficultKeys: string[] };
  smartShuffle: boolean;
  updatedAt: string;
};

const KEY = "kotoba-quiz-sessions-v1";

function readSessions(): Record<string, SavedQuizSession> {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, SavedQuizSession>;
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

export function canonicalQuizHref(href: string) {
  const url = new URL(href, typeof window === "undefined" ? "http://localhost" : window.location.origin);
  url.searchParams.sort();
  return `${url.pathname}${url.search}`;
}

export function getQuizSession(href: string) {
  return readSessions()[canonicalQuizHref(href)] ?? null;
}

export function getLatestQuizSession() {
  return getQuizSessions()[0] ?? null;
}

export function getQuizSessions() {
  return Object.values(readSessions()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveQuizSession(session: SavedQuizSession) {
  if (typeof window === "undefined") return;
  try {
    const sessions = readSessions();
    sessions[session.id] = { ...session, updatedAt: new Date().toISOString() };
    const trimmed = Object.entries(sessions).sort(([, a], [, b]) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 12);
    window.localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(trimmed)));
  } catch { /* A full or unavailable localStorage should not interrupt a quiz. */ }
}

export function removeQuizSession(href: string) {
  if (typeof window === "undefined") return;
  try {
    const sessions = readSessions();
    delete sessions[canonicalQuizHref(href)];
    window.localStorage.setItem(KEY, JSON.stringify(sessions));
  } catch { /* Ignore unavailable localStorage. */ }
}
