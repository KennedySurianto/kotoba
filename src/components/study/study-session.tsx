"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, RotateCcw, Shuffle, Volume2, X } from "lucide-react";
import { toHiragana } from "wanakana";
import { matchesKanjiAnswer, matchesMeaning, matchesReading, normalizeReading, romaji } from "@/lib/japanese";
import { playUiSound } from "@/lib/ui-sound";
import { loadProgress, recordAnswer, recordCompletedQuiz, recordCorrectQuizAnswer, setDifficult, type ProgressStore } from "@/lib/storage/progress";
import { canonicalQuizHref, getQuizSession, removeQuizSession, saveQuizSession, type SavedQuizSession } from "@/lib/storage/quiz-sessions";
import { recordStudyActivity } from "@/lib/storage/study-activity";
import type { StudyItem } from "@/lib/study/types";

type Mode = "learn" | "flashcards" | "quiz";
type VocabularyQuizDirection = "japanese-to-english" | "english-to-japanese";

function createQuizRunId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `quiz-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function matchesJapaneseVocabulary(value: string, item: StudyItem) {
  const normalizedAnswer = normalizeReading(value);
  return normalizedAnswer.length > 0 && [item.japanese, ...item.acceptedReadings].some((candidate) => normalizeReading(candidate) === normalizedAnswer);
}

function describeVocabularyMeaning(item: StudyItem) {
  const meaning = item.meanings.map((value) => value.replace(/\s*\(\s*before a noun\s*\)/gi, "")).join(" · ");
  const location = locationAnswerDetails[item.japanese];
  if (location) return `${meaning} · ${location.formal ? "formal" : "informal"} · relatively ${location.distance}`;
  const demonstrative = demonstrativeAnswerDetails[item.japanese];
  if (demonstrative) return `${meaning} · ${demonstrative.beforeNoun ? "before a noun" : "standalone"} · relatively ${demonstrative.distance}`;
  return meaning;
}

const locationAnswerDetails: Record<string, { meaning: "here" | "there"; formal: boolean; distance: "close" | "far"; optionalDistance?: boolean }> = {
  "ここ": { meaning: "here", formal: false, distance: "close", optionalDistance: true },
  "こちら": { meaning: "here", formal: true, distance: "close", optionalDistance: true },
  "そこ": { meaning: "there", formal: false, distance: "close", optionalDistance: true },
  "そちら": { meaning: "there", formal: true, distance: "close", optionalDistance: true },
  "あそこ": { meaning: "there", formal: false, distance: "far", optionalDistance: true },
  "あちら": { meaning: "there", formal: true, distance: "far", optionalDistance: true },
};
const demonstrativeAnswerDetails: Record<string, { meaning: "this" | "that"; beforeNoun: boolean; distance: "close" | "far"; optionalDistance?: boolean }> = {
  "これ": { meaning: "this", beforeNoun: false, distance: "close", optionalDistance: true },
  "それ": { meaning: "that", beforeNoun: false, distance: "close", optionalDistance: true },
  "あれ": { meaning: "that", beforeNoun: false, distance: "far", optionalDistance: true },
  "この": { meaning: "this", beforeNoun: true, distance: "close", optionalDistance: true },
  "その": { meaning: "that", beforeNoun: true, distance: "close", optionalDistance: true },
  "あの": { meaning: "that", beforeNoun: true, distance: "far", optionalDistance: true },
};

const kanjiReadingSplits: Record<string, string[]> = {
  "喫煙所": ["きつ", "えん", "じょ"],
  "喫茶店": ["きっ", "さ", "てん"],
  "地下": ["ち", "か"],
  "携帯電話": ["けい", "たい", "でん", "わ"],
  "電子辞書": ["でん", "し", "じ", "しょ"],
  "店員": ["てん", "いん"],
  "牛肉": ["ぎゅう", "にく"],
  "鶏肉": ["とり", "にく"],
  "豚肉": ["ぶた", "にく"],
  "野菜": ["や", "さい"],
  "料理": ["りょう", "り"],
  "紅茶": ["こう", "ちゃ"],
  "財布": ["さい", "ふ"],
  "英語": ["えい", "ご"],
  "注文": ["ちゅう", "もん"],
  "少々": ["しょう", "しょう"],
};

function splitReadingByKanji(kanji: string[], reading: string) {
  const knownSplit = kanjiReadingSplits[kanji.join("")];
  if (knownSplit?.join("") === reading) return knownSplit;
  if (kanji.length === 1) return [reading];

  const mora = Array.from(reading).reduce<string[]>((result, character) => {
    if (/[ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ]/u.test(character) && result.length > 0) result[result.length - 1] += character;
    else result.push(character);
    return result;
  }, []);
  let offset = 0;
  return kanji.map((_, index) => {
    const remainingKanji = kanji.length - index;
    const remainingMora = mora.length - offset;
    const count = index === kanji.length - 1 ? remainingMora : Math.max(1, Math.round(remainingMora / remainingKanji));
    const chunk = mora.slice(offset, offset + count).join("");
    offset += count;
    return chunk;
  });
}

function renderKotobaWithFurigana(japanese: string, reading: string): ReactNode {
  const tokens = Array.from(japanese).reduce<{ kind: "kanji" | "kana" | "other"; text: string; furigana?: string }[]>((result, character) => {
    const kind = /\p{Script=Han}/u.test(character) || character === "々" ? "kanji" : /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(character) ? "kana" : "other";
    const previous = result[result.length - 1];
    if (kind !== "kanji" && previous?.kind === kind) previous.text += character;
    else result.push({ kind, text: character });
    return result;
  }, []);
  const hiraganaReading = normalizeReading(reading);
  let readingOffset = 0;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind === "kana") {
      const kana = normalizeReading(token.text);
      const matchAt = hiraganaReading.indexOf(kana, readingOffset);
      if (matchAt >= readingOffset) readingOffset = matchAt + kana.length;
      continue;
    }
    if (token.kind !== "kanji") continue;

    const kanjiRun = [token];
    while (tokens[index + 1]?.kind === "kanji") kanjiRun.push(tokens[++index]);
    const nextKana = tokens.slice(index + 1).find((candidate) => candidate.kind === "kana");
    if (nextKana) {
      const nextKanaText = normalizeReading(nextKana.text);
      const nextKanaAt = hiraganaReading.indexOf(nextKanaText, readingOffset);
      if (nextKanaAt >= readingOffset) {
        splitReadingByKanji(kanjiRun.map((part) => part.text), hiraganaReading.slice(readingOffset, nextKanaAt)).forEach((furigana, partIndex) => {
          kanjiRun[partIndex].furigana = furigana;
        });
      }
    } else {
      splitReadingByKanji(kanjiRun.map((part) => part.text), hiraganaReading.slice(readingOffset)).forEach((furigana, partIndex) => {
        kanjiRun[partIndex].furigana = furigana;
      });
    }
  }

  return <>{tokens.map((token, index) => token.kind === "kanji" && token.furigana
    ? <ruby className="prompt-furigana" key={`${index}-${token.text}`}>{token.text}<rt>{token.furigana}</rt></ruby>
    : <span key={`${index}-${token.text}`}>{token.text}</span>)}</>;
}

function expandVocabularyAlternatives(items: StudyItem[]) {
  return items.flatMap((item) => {
    const forms = item.japanese.split(/\s*\/\s*/).map((form) => form.trim()).filter(Boolean);
    if (forms.length < 2) return [item];
    return forms.map((japanese, index) => {
      const pairedReadings = item.acceptedReadings.length === forms.length;
      const pairedMeanings = item.meanings.length === forms.length;
      const reading = pairedReadings ? item.acceptedReadings[index] : item.reading;
      const pairedAcceptedMeanings = (item.acceptedMeanings?.length ?? 0) === forms.length;
      return {
        ...item,
        key: `${item.key}:form-${index + 1}`,
        japanese,
        reading,
        acceptedReadings: pairedReadings ? [reading] : item.acceptedReadings,
        meanings: pairedMeanings ? [item.meanings[index]] : item.meanings,
        acceptedMeanings: pairedAcceptedMeanings ? [item.acceptedMeanings![index]] : item.acceptedMeanings,
      };
    });
  });
}

function smartShuffleItems(items: StudyItem[], progress: ProgressStore) {
  const now = Date.now();
  return items
    .map((item) => {
      const card = progress.cards[item.key];
      const isDue = Boolean(card?.nextReview && new Date(card.nextReview).getTime() <= now);
      const missedRate = card ? card.incorrect / (card.correct + 1) : 0;
      const priority = (card?.difficult ? 10 : 0) + missedRate * 4 + (isDue ? 3 : 0);
      return { item, rank: priority + Math.random() * 0.8 };
    })
    .sort((a, b) => b.rank - a.rank)
    .map(({ item }) => item);
}

export function StudySession({ chapterId, chapterTitle, subject, mode, initialItems }: { chapterId: string; chapterTitle: string; subject: "vocabulary" | "kanji"; mode: Mode; initialItems: StudyItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [flashDirection, setFlashDirection] = useState<"primary" | "reverse" | "meaning" | "mixed">("primary");
  const [answer, setAnswer] = useState("");
  const [meaningAnswer, setMeaningAnswer] = useState("");
  const [formalAnswer, setFormalAnswer] = useState(false);
  const [beforeNounAnswer, setBeforeNounAnswer] = useState(false);
  const [distanceAnswer, setDistanceAnswer] = useState<"close" | "far" | "">("");
  const [checked, setChecked] = useState<boolean | null>(null);
  const [results, setResults] = useState<{ correct: number; incorrect: number; skipped: number; mistakes: StudyItem[]; difficult: StudyItem[] }>({ correct: 0, incorrect: 0, skipped: 0, mistakes: [], difficult: [] });
  const [finished, setFinished] = useState(false);
  const [quizSessionStatus, setQuizSessionStatus] = useState<"checking" | "prompt" | "setup" | "ready">(mode === "quiz" ? "checking" : "ready");
  const [pendingQuizSession, setPendingQuizSession] = useState<SavedQuizSession | null>(null);
  const [showQuitPrompt, setShowQuitPrompt] = useState(false);
  const [quizBaseItems, setQuizBaseItems] = useState<StudyItem[] | null>(null);
  const [progress, setProgress] = useState<ProgressStore>({ cards: {}, quizStats: { completedRuns: 0, correctAnswers: 0, completedRunIds: [] }, updatedAt: "" });
  const [quizRunId, setQuizRunId] = useState<string | null>(null);
  const [quizCountsAsSession, setQuizCountsAsSession] = useState(true);
  const [vocabularyDirection, setVocabularyDirection] = useState<VocabularyQuizDirection>("japanese-to-english");
  const [showRomaji, setShowRomaji] = useState(false);
  const [smartShuffle, setSmartShuffle] = useState(mode === "quiz");
  const smartOriginalRemaining = useRef<StudyItem[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const router = useRouter();
  const current = items[index];
  const vocabularyQuiz = mode === "quiz" && subject === "vocabulary";
  const englishToJapaneseQuiz = vocabularyQuiz && vocabularyDirection === "english-to-japanese";
  const kanjiInVocabulary = vocabularyQuiz && Boolean(current?.japanese.match(/\p{Script=Han}/u));
  const locationAnswer = vocabularyQuiz ? locationAnswerDetails[current?.japanese ?? ""] : undefined;
  const demonstrativeAnswer = vocabularyQuiz ? demonstrativeAnswerDetails[current?.japanese ?? ""] : undefined;
  const specialMeaningAnswer = locationAnswer?.meaning ?? demonstrativeAnswer?.meaning;
  const activeDirection = flashDirection === "mixed" ? ((index % 2 === 0) ? "primary" : (subject === "vocabulary" ? "reverse" : "meaning")) : flashDirection;
  const focusMode = mode !== "learn";
  const subjectPath = `/chapter/${chapterId}/${subject}`;
  const quizSourceItems = useMemo(() => mode === "quiz" && subject === "vocabulary" ? expandVocabularyAlternatives(initialItems) : initialItems, [initialItems, mode, subject]);

  useEffect(() => {
    recordStudyActivity({ chapterId, chapterTitle, subject, mode });
  }, [chapterId, chapterTitle, subject, mode]);

  const toggleSmartShuffle = () => {
    if (checked !== null) return;
    const completed = items.slice(0, index);
    if (!smartShuffle) {
      const remaining = items.slice(index);
      smartOriginalRemaining.current = remaining;
      setItems([...completed, ...smartShuffleItems(remaining, progress)]);
      setSmartShuffle(true);
    } else {
      const completedKeys = new Set(completed.map((item) => item.key));
      const restore = (smartOriginalRemaining.current ?? items.slice(index)).filter((item) => !completedKeys.has(item.key));
      setItems([...completed, ...restore]);
      smartOriginalRemaining.current = null;
      setSmartShuffle(false);
    }
    setAnswer("");
    setMeaningAnswer("");
    setFormalAnswer(false); setBeforeNounAnswer(false); setDistanceAnswer("");
    setChecked(null);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = loadProgress();
      setProgress(saved);
      const params = new URLSearchParams(window.location.search);
      const review = params.get("review");
      const category = params.get("category");
      let selectedItems = initialItems;
      if (review === "due") selectedItems = initialItems.filter((item) => { const due = saved.cards[item.key]?.nextReview; return due && new Date(due) <= new Date(); });
      else if (review === "mistakes") selectedItems = initialItems.filter((item) => { const card = saved.cards[item.key]; return card && (card.incorrect > card.correct || card.difficult); });
      else if (category) selectedItems = initialItems.filter((item) => item.category === category);
      if (mode === "quiz" && subject === "vocabulary") selectedItems = expandVocabularyAlternatives(selectedItems);
      if (mode === "quiz") {
        const href = canonicalQuizHref(`${window.location.pathname}${window.location.search}`);
        const savedSession = getQuizSession(href);
        setQuizBaseItems(selectedItems);
        if (savedSession && savedSession.itemKeys.length > 0 && savedSession.itemKeys.every((key) => selectedItems.some((item) => item.key === key))) {
          setItems(selectedItems);
          setPendingQuizSession(savedSession);
          setQuizSessionStatus("prompt");
        } else {
          if (savedSession) removeQuizSession(href);
          setItems(smartShuffleItems(selectedItems, saved));
          if (subject === "vocabulary") {
            setQuizRunId(null);
            setQuizSessionStatus("setup");
          } else {
            setQuizRunId(createQuizRunId());
            setQuizSessionStatus("ready");
          }
        }
      } else {
        setItems(selectedItems);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialItems, mode, subject]);
  useEffect(() => {
    if (mode !== "quiz" || quizSessionStatus !== "ready" || checked !== null || finished) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [index, current?.key, mode, checked, finished, quizSessionStatus]);

  useEffect(() => {
    if (mode !== "quiz" || quizSessionStatus !== "ready" || !quizBaseItems) return;
    const href = canonicalQuizHref(`${window.location.pathname}${window.location.search}`);
    if (finished) {
      removeQuizSession(href);
      return;
    }
    if (items.length === 0) return;
    saveQuizSession({
      id: href,
      runId: quizRunId ?? undefined,
      countsAsSession: quizCountsAsSession,
      vocabularyDirection,
      href,
      chapterId,
      chapterTitle,
      subject,
      itemKeys: items.map((item) => item.key),
      index,
      answer,
      meaningAnswer,
      formalAnswer,
      beforeNounAnswer,
      distanceAnswer,
      checked,
      results: { correct: results.correct, incorrect: results.incorrect, skipped: results.skipped, mistakeKeys: results.mistakes.map((item) => item.key), difficultKeys: results.difficult.map((item) => item.key) },
      smartShuffle,
      updatedAt: new Date().toISOString(),
    });
  }, [mode, quizSessionStatus, quizBaseItems, finished, items, index, answer, meaningAnswer, formalAnswer, beforeNounAnswer, distanceAnswer, checked, results, smartShuffle, chapterId, chapterTitle, subject, quizRunId, quizCountsAsSession, vocabularyDirection]);
  useEffect(() => {
    if (mode !== "quiz" || !finished || !quizRunId || !quizCountsAsSession || results.correct + results.incorrect === 0) return;
    recordCompletedQuiz(quizRunId);
  }, [mode, finished, quizRunId, quizCountsAsSession, results.correct, results.incorrect]);
  const next = useCallback(() => {
    if (index >= items.length - 1) setFinished(true);
    else { setIndex((value) => value + 1); setAnswer(""); setMeaningAnswer(""); setFormalAnswer(false); setBeforeNounAnswer(false); setDistanceAnswer(""); setChecked(null); setRevealed(false); }
  }, [index, items.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key === "Escape") { if (mode === "quiz") setShowQuitPrompt(true); else router.push(subjectPath); return; }
      if ((event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) && !(mode === "quiz" && checked !== null && event.key === "Enter")) return;
      if (mode === "flashcards") {
        if (event.code === "Space") { event.preventDefault(); setRevealed((value) => !value); }
        if (event.key === "ArrowRight") next();
        if (event.key === "ArrowLeft") { setIndex((value) => Math.max(0, value - 1)); setRevealed(false); }
      }
      if (mode === "quiz" && checked !== null && event.key === "Enter") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, next, subjectPath, checked, router]);

  const emptyResults = () => ({ correct: 0, incorrect: 0, skipped: 0, mistakes: [] as StudyItem[], difficult: [] as StudyItem[] });
  const shuffle = () => { setItems((value) => [...value].sort(() => Math.random() - 0.5)); setIndex(0); setFinished(false); setResults(emptyResults()); setRevealed(false); setChecked(null); setAnswer(""); setMeaningAnswer(""); setFormalAnswer(false); setBeforeNounAnswer(false); setDistanceAnswer(""); };
  const restart = () => {
    if (mode === "quiz") { setQuizRunId(createQuizRunId()); setQuizCountsAsSession(true); }
    smartOriginalRemaining.current = smartShuffle ? quizSourceItems : null;
    setItems(smartShuffle ? smartShuffleItems(quizSourceItems, progress) : quizSourceItems);
    setIndex(0); setFinished(false); setResults(emptyResults()); setChecked(null); setAnswer(""); setMeaningAnswer(""); setFormalAnswer(false); setBeforeNounAnswer(false); setDistanceAnswer(""); setRevealed(false);
  };
  const mark = (correct: boolean, difficult = false) => {
    const updated = recordAnswer(current.key, correct);
    if (difficult) setDifficult(current.key, true);
    setProgress(updated);
    setResults((value) => ({ ...value, [correct ? "correct" : "incorrect"]: value[correct ? "correct" : "incorrect"] + 1, mistakes: correct ? value.mistakes : [...value.mistakes, current], difficult: difficult ? [...value.difficult, current] : value.difficult }));
    next();
  };
  const submit = () => {
    if (!current || checked !== null) return;
    const specialAnswerCorrect = specialMeaningAnswer
      ? matchesMeaning(answer, [specialMeaningAnswer])
        && (locationAnswer ? formalAnswer === locationAnswer.formal : beforeNounAnswer === demonstrativeAnswer?.beforeNoun)
        && (distanceAnswer === "" ? Boolean(locationAnswer?.optionalDistance || demonstrativeAnswer?.optionalDistance) : distanceAnswer === (locationAnswer?.distance ?? demonstrativeAnswer?.distance))
      : false;
    const correct = vocabularyQuiz
      ? vocabularyDirection === "english-to-japanese"
        ? matchesJapaneseVocabulary(answer, current)
        : specialMeaningAnswer ? specialAnswerCorrect : matchesMeaning(answer, current.meanings, current.acceptedMeanings)
      : matchesKanjiAnswer(answer, meaningAnswer, current);
    playUiSound(correct ? "correct" : "incorrect");
    setChecked(correct);
    let updated = recordAnswer(current.key, correct);
    if (correct) updated = recordCorrectQuizAnswer();
    setProgress(updated);
    setResults((value) => ({ ...value, [correct ? "correct" : "incorrect"]: value[correct ? "correct" : "incorrect"] + 1, mistakes: correct ? value.mistakes : [...value.mistakes, current] }));
  };
  const updateReadingAnswer = (input: HTMLInputElement) => {
    const value = input.value;
    if (composingRef.current) {
      setAnswer(value);
      return;
    }
    const selectionStart = input.selectionStart ?? value.length;
    const selectionEnd = input.selectionEnd ?? selectionStart;
    const options = { IMEMode: "toHiragana" as const };
    const converted = toHiragana(value, options);
    const nextStart = toHiragana(value.slice(0, selectionStart), options).length;
    const nextEnd = toHiragana(value.slice(0, selectionEnd), options).length;
    setAnswer(converted);
    window.requestAnimationFrame(() => inputRef.current?.setSelectionRange(nextStart, nextEnd));
  };
  const flagDifficult = () => {
    if (!current || results.difficult.some((item) => item.key === current.key)) return;
    setDifficult(current.key, true);
    setProgress(loadProgress());
    setResults((value) => ({ ...value, difficult: [...value.difficult, current] }));
  };
  const skip = () => { setResults((value) => ({ ...value, skipped: value.skipped + 1 })); next(); };
  const continueSavedQuiz = () => {
    if (!pendingQuizSession || !quizBaseItems) return;
    const byKey = new Map(quizBaseItems.map((item) => [item.key, item]));
    const restoredItems = pendingQuizSession.itemKeys.map((key) => byKey.get(key)).filter((item): item is StudyItem => Boolean(item));
    if (restoredItems.length !== pendingQuizSession.itemKeys.length || restoredItems.length === 0) {
      restartSavedQuiz();
      return;
    }
    const restoredIndex = Math.min(Math.max(0, pendingQuizSession.index), restoredItems.length - 1);
    setItems(restoredItems);
    setIndex(restoredIndex);
    setAnswer(pendingQuizSession.answer ?? "");
    setMeaningAnswer(pendingQuizSession.meaningAnswer ?? "");
    setFormalAnswer(Boolean(pendingQuizSession.formalAnswer));
    setBeforeNounAnswer(Boolean(pendingQuizSession.beforeNounAnswer));
    setDistanceAnswer(pendingQuizSession.distanceAnswer ?? "");
    setChecked(pendingQuizSession.checked ?? null);
    setResults({
      correct: pendingQuizSession.results?.correct ?? 0,
      incorrect: pendingQuizSession.results?.incorrect ?? 0,
      skipped: pendingQuizSession.results?.skipped ?? 0,
      mistakes: (pendingQuizSession.results?.mistakeKeys ?? []).map((key) => byKey.get(key)).filter((item): item is StudyItem => Boolean(item)),
      difficult: (pendingQuizSession.results?.difficultKeys ?? []).map((key) => byKey.get(key)).filter((item): item is StudyItem => Boolean(item)),
    });
    setSmartShuffle(pendingQuizSession.smartShuffle);
    setQuizRunId(pendingQuizSession.runId ?? createQuizRunId());
    setQuizCountsAsSession(pendingQuizSession.countsAsSession ?? true);
    setVocabularyDirection(pendingQuizSession.vocabularyDirection ?? "japanese-to-english");
    smartOriginalRemaining.current = null;
    setFinished(false);
    setPendingQuizSession(null);
    setQuizSessionStatus("ready");
  };
  const restartSavedQuiz = () => {
    if (!quizBaseItems) return;
    const href = pendingQuizSession?.href ?? canonicalQuizHref(`${window.location.pathname}${window.location.search}`);
    removeQuizSession(href);
    setItems(smartShuffleItems(quizBaseItems, progress));
    setQuizRunId(subject === "vocabulary" ? null : createQuizRunId());
    setQuizCountsAsSession(true);
    setIndex(0);
    setAnswer(""); setMeaningAnswer(""); setFormalAnswer(false); setBeforeNounAnswer(false); setDistanceAnswer("");
    setChecked(null); setResults(emptyResults()); setFinished(false); setSmartShuffle(true);
    smartOriginalRemaining.current = null;
    setPendingQuizSession(null);
    setVocabularyDirection("japanese-to-english");
    setQuizSessionStatus(subject === "vocabulary" ? "setup" : "ready");
  };
  const confirmQuizExit = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (mode !== "quiz") return;
    event.preventDefault();
    setShowQuitPrompt(true);
  };
  const quitQuiz = () => {
    removeQuizSession(canonicalQuizHref(`${window.location.pathname}${window.location.search}`));
    router.push(`/chapter/${chapterId}`);
  };
  const startVocabularyQuiz = (direction: VocabularyQuizDirection) => {
    setVocabularyDirection(direction);
    setQuizRunId(createQuizRunId());
    setQuizCountsAsSession(true);
    setQuizSessionStatus("ready");
  };
  const cancelQuitPrompt = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setShowQuitPrompt(false);
  };
  const speak = () => { if (typeof window !== "undefined" && "speechSynthesis" in window) { const utterance = new SpeechSynthesisUtterance(current.japanese); utterance.lang = "ja-JP"; window.speechSynthesis.speak(utterance); } };
  const dueItems = useMemo(() => initialItems.filter((item) => { const due = progress.cards[item.key]?.nextReview; return due && new Date(due) <= new Date(); }), [initialItems, progress]);
  if (mode === "quiz" && quizSessionStatus === "checking") return <main className={`study-shell ${focusMode ? "focus-mode" : ""}`} aria-busy="true"><div className="quiz-session-loading">Preparing your quiz…</div></main>;
  if (mode === "quiz" && showQuitPrompt) return <main className={`study-shell ${focusMode ? "focus-mode" : ""}`}>
    <div className="study-topline"><Link href={subjectPath} className="study-exit" onClick={cancelQuitPrompt}><ArrowLeft size={15} /><span>{chapterTitle} <i>/</i> {subject}</span></Link><span className="study-mode-label">QUIZ IN PROGRESS<b> · </b> {chapterId}</span><span className="study-mode-right">{focusMode && <span>FOCUS MODE</span>}<Link href={`/chapter/${chapterId}`} onClick={(event) => { event.preventDefault(); quitQuiz(); }}>EXIT <span>×</span></Link></span></div>
    <section className="quiz-resume-prompt" aria-labelledby="quiz-quit-title"><p className="eyebrow"><span className="eyebrow-line" />QUIZ IN PROGRESS</p><h1 id="quiz-quit-title">Do you really want to quit?</h1><p>Your saved position and answers for this quiz, if any, will be erased.</p><div><button type="button" className="button button-dark" onClick={() => setShowQuitPrompt(false)}>Keep quiz <ArrowRight size={15} /></button><button type="button" className="quiz-start-over" onClick={quitQuiz}>Quit quiz <X size={14} /></button></div></section>
  </main>;
  if (mode === "quiz" && quizSessionStatus === "prompt" && pendingQuizSession) return <main className={`study-shell ${focusMode ? "focus-mode" : ""}`}>
    <div className="study-topline"><Link href={subjectPath} className="study-exit" onClick={confirmQuizExit}><ArrowLeft size={15} /><span>{chapterTitle} <i>/</i> {subject}</span></Link><span className="study-mode-label">QUIZ IN PROGRESS<b> · </b> {chapterId}</span><span className="study-mode-right">{focusMode && <span>FOCUS MODE</span>}<Link href={`/chapter/${chapterId}`} onClick={confirmQuizExit}>EXIT <span>×</span></Link></span></div>
    <section className="quiz-resume-prompt" aria-labelledby="quiz-resume-title"><p className="eyebrow"><span className="eyebrow-line" />SAVED IN THIS BROWSER</p><h1 id="quiz-resume-title">Continue your quiz?</h1><p>You were on question {Math.min(pendingQuizSession.index + 1, pendingQuizSession.itemKeys.length)} of {pendingQuizSession.itemKeys.length}. Your answers and quiz order are saved.</p><div><button type="button" className="button button-dark" onClick={continueSavedQuiz}>Continue quiz <ArrowRight size={15} /></button><button type="button" className="quiz-start-over" onClick={restartSavedQuiz}>Start over <RotateCcw size={14} /></button></div></section>
  </main>;
  if (mode === "quiz" && quizSessionStatus === "setup" && vocabularyQuiz && items.length > 0) return <main className={`study-shell ${focusMode ? "focus-mode" : ""}`}>
    <div className="study-topline"><Link href={subjectPath} className="study-exit" onClick={confirmQuizExit}><ArrowLeft size={15} /><span>{chapterTitle} <i>/</i> {subject}</span></Link><span className="study-mode-label">VOCABULARY QUIZ<b> · </b> {chapterId}</span><span className="study-mode-right">{focusMode && <span>FOCUS MODE</span>}<Link href={`/chapter/${chapterId}`} onClick={confirmQuizExit}>EXIT <span>×</span></Link></span></div>
    <section className="quiz-resume-prompt" aria-labelledby="quiz-direction-title"><p className="eyebrow"><span className="eyebrow-line" />CHOOSE YOUR RECALL DIRECTION</p><h1 id="quiz-direction-title">Which side first?</h1><p>Choose what you want to recall from each vocabulary prompt.</p><div className="quiz-direction-options"><button type="button" className="quiz-direction-choice" onClick={() => startVocabularyQuiz("japanese-to-english")}><span><strong>Japanese → English</strong><small>See the Japanese word; enter its meaning.</small></span><ArrowRight size={15} /></button><button type="button" className="quiz-direction-choice" onClick={() => startVocabularyQuiz("english-to-japanese")}><span><strong>English → Japanese</strong><small>See the meaning; enter the Japanese word.</small></span><ArrowRight size={15} /></button></div></section>
  </main>;
  if (mode !== "learn" && items.length === 0) return <main className="study-shell"><div className="study-empty"><span>頁</span><h1>No cards in this chapter yet.</h1><p>When you add vocabulary or kanji examples, you’ll find them here.</p><Link className="button button-dark" href={subjectPath}>Back to {subject}</Link></div></main>;

  return <main className={`study-shell ${focusMode ? "focus-mode" : "learn-mode"}`}>
    <div className="study-topline"><Link href={subjectPath} className="study-exit" onClick={mode === "quiz" ? confirmQuizExit : undefined}><ArrowLeft size={15} /><span>{chapterTitle} <i>/</i> {subject}</span></Link><span className="study-mode-label">{mode === "quiz" ? englishToJapaneseQuiz ? "JAPANESE WORD PRACTICE" : vocabularyQuiz ? "MEANING PRACTICE" : "READING PRACTICE" : mode === "flashcards" ? "FLASHCARDS" : "STUDY LIBRARY"}<b> · </b> {chapterId}</span><span className="study-mode-right">{focusMode && <span>FOCUS MODE</span>}<Link href={`/chapter/${chapterId}`} onClick={mode === "quiz" ? confirmQuizExit : undefined}>EXIT <span>×</span></Link></span></div>
    {mode === "learn" ? <LearnView items={items} subject={subject} progress={progress} showRomaji={showRomaji} setShowRomaji={setShowRomaji} chapterId={chapterId} dueCount={dueItems.length} onShuffle={shuffle} /> : finished ? <Results results={results} itemsLength={items.length} restart={restart} mistakesOnly={() => { setQuizRunId(createQuizRunId()); setQuizCountsAsSession(false); smartOriginalRemaining.current = smartShuffle ? results.mistakes : null; setItems(smartShuffle ? smartShuffleItems(results.mistakes, progress) : results.mistakes); setIndex(0); setFinished(false); setResults(emptyResults()); setAnswer(""); setMeaningAnswer(""); setFormalAnswer(false); setBeforeNounAnswer(false); setDistanceAnswer(""); setChecked(null); setRevealed(false); }} /> : <>
      <div className={`session-progress ${mode === "quiz" ? "with-smart-shuffle" : ""}`}><span>{String(index + 1).padStart(2, "0")} <i>/</i> {String(items.length).padStart(2, "0")}</span><div><i style={{ width: `${((index + 1) / items.length) * 100}%` }} /></div>{mode === "quiz" && <button type="button" className={`smart-shuffle-toggle ${smartShuffle ? "is-active" : ""}`} aria-pressed={smartShuffle} title="Prioritize missed and difficult cards; shuffle ties." disabled={checked !== null} onClick={toggleSmartShuffle}><Shuffle size={12} /> SMART {smartShuffle ? "ON" : "OFF"}</button>}<button onClick={skip}>Skip <ArrowRight size={13} /></button></div>
      <div className="study-card-stage" key={current?.key}>
        <div className="study-context">{current?.kanji && <span className="kanji-chip">KANJI {current.kanji}</span>}<span>{current?.category ?? (current?.kanji ? `${current.strokeCount} STROKES` : "CHAPTER WORD")}</span><button className="audio-button" onClick={speak} aria-label="Play Japanese pronunciation"><Volume2 size={16} /></button></div>
        <div className="study-prompt"><span className={`prompt-japanese ${mode === "flashcards" && activeDirection === "reverse" || englishToJapaneseQuiz ? "prompt-english" : ""}`}>{mode === "flashcards" && activeDirection === "reverse" ? current?.meanings.join(" · ") : englishToJapaneseQuiz ? describeVocabularyMeaning(current!) : kanjiInVocabulary ? renderKotobaWithFurigana(current?.japanese ?? "", current?.reading ?? "") : current?.japanese}</span>{mode === "quiz" ? <span className="prompt-meaning">{englishToJapaneseQuiz ? "TYPE THE JAPANESE WORD" : vocabularyQuiz ? "TYPE THE ENGLISH MEANING" : "TYPE THE READING + ENGLISH MEANING"}</span> : (mode !== "flashcards" || (Boolean(current?.kanji) && activeDirection !== "meaning") || activeDirection === "reverse") && <span className="prompt-meaning">{mode === "flashcards" && activeDirection === "reverse" ? "FIND THE JAPANESE" : current?.meanings.join(" · ")}</span>}</div>
        {mode === "flashcards" ? <div className={`flash-reveal ${revealed ? "is-revealed" : ""}`}>
          {revealed ? <><span className="answer-reading">{activeDirection === "reverse" ? current?.japanese : activeDirection === "meaning" ? current?.meanings.join(" · ") : current?.reading}</span><span className="answer-romaji">{activeDirection === "reverse" ? current?.reading : romaji(current?.reading ?? "")}</span>{activeDirection !== "meaning" && <span className="answer-meaning">{current?.meanings.join(" · ")}</span>}<div className="answer-actions"><button className="answer-wrong" onClick={() => mark(false)}>Again</button><button className="difficult-button" onClick={() => { setDifficult(current.key, true); mark(false, true); }}>Difficult</button><button className="answer-correct" onClick={() => mark(true)}>I knew it <Check size={15} /></button></div></> : <button className="reveal-button" onClick={() => setRevealed(true)}>Reveal answer <span>SPACE</span></button>}
        </div> : <div className="quiz-answer-area">
          <form className="answer-form" onSubmit={(event) => { event.preventDefault(); if (!(event.nativeEvent as Event & { isComposing?: boolean }).isComposing && !composingRef.current) submit(); }}>
            <label htmlFor="reading-answer">YOUR ANSWER <span>{vocabularyQuiz ? englishToJapaneseQuiz ? "JAPANESE" : "ENGLISH" : "HIRAGANA / ROMAJI + ENGLISH"}</span></label>
            <div className={`answer-input-wrap ${checked === null ? "" : vocabularyQuiz ? checked ? "input-correct" : "input-wrong" : current?.acceptedAnswerPairs ? checked ? "input-correct" : "input-wrong" : matchesReading(answer, current?.acceptedReadings ?? []) ? "input-correct" : "input-wrong"}`}>
              <input ref={inputRef} id="reading-answer" aria-label={vocabularyQuiz ? englishToJapaneseQuiz ? "Japanese word; Hiragana, Katakana, Kanji, or Romaji accepted" : "English meaning" : "Hiragana reading; Romaji accepted"} autoComplete="off" autoCapitalize="off" spellCheck={vocabularyQuiz && !englishToJapaneseQuiz} lang={vocabularyQuiz && !englishToJapaneseQuiz ? "en" : "ja"} inputMode="text" placeholder={vocabularyQuiz ? englishToJapaneseQuiz ? "Type the Japanese word…" : "Type the meaning…" : "Type Hiragana or Romaji…"} value={answer} onChange={(event) => vocabularyQuiz ? setAnswer(event.target.value) : updateReadingAnswer(event.currentTarget)} onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={() => { composingRef.current = false; }} disabled={checked !== null} />
              <span>↵</span>
            </div>
            {!vocabularyQuiz && <div className={`answer-input-wrap meaning-answer-wrap ${checked === null ? "" : current?.acceptedAnswerPairs ? checked ? "input-correct" : "input-wrong" : matchesMeaning(meaningAnswer, current?.meanings ?? [], current?.acceptedMeanings) ? "input-correct" : "input-wrong"}`}>
              <input id="meaning-answer" aria-label="English meaning (Kotoba IME: Alphanumeric)" autoComplete="off" autoCapitalize="off" spellCheck lang="en" inputMode="text" placeholder="Type the English meaning…" value={meaningAnswer} onChange={(event) => setMeaningAnswer(event.target.value)} disabled={checked !== null} />
            </div>}
            {(locationAnswer || demonstrativeAnswer) && !englishToJapaneseQuiz && <SpecialMeaningControls location={locationAnswer} demonstrative={demonstrativeAnswer} formal={formalAnswer} setFormal={setFormalAnswer} beforeNoun={beforeNounAnswer} setBeforeNoun={setBeforeNounAnswer} distance={distanceAnswer} setDistance={setDistanceAnswer} disabled={checked !== null} />}
            {checked === null ? <button type="submit" className="button button-dark check-button" disabled={!answer.trim() || (!vocabularyQuiz && !meaningAnswer.trim()) || Boolean(!englishToJapaneseQuiz && (locationAnswer || demonstrativeAnswer) && !distanceAnswer && !(locationAnswer?.optionalDistance || demonstrativeAnswer?.optionalDistance))}>Check answer <ArrowRight size={15} /></button> : <div className={`quiz-feedback ${checked ? "feedback-correct" : "feedback-wrong"}`}><div><strong>{checked ? "Correct." : "Not quite."}</strong><span>{vocabularyQuiz ? englishToJapaneseQuiz ? <>{current?.japanese} <i>·</i> {current?.reading}</> : current?.meanings.join(" · ") : current?.acceptedAnswerPairs ? current.acceptedAnswerPairs.map((pair) => `${pair.acceptedReadings.join(" / ")} (${pair.acceptedReadings.map(romaji).join(" / ")}) — ${pair.meanings.join(" / ")}`).join(" · ") : <>{current?.reading} <i>·</i> {romaji(current?.reading ?? "")} <i>·</i> {current?.meanings.join(" · ")}</>}</span></div><button type="button" className="flag-difficult" onClick={flagDifficult}>{results.difficult.some((item) => item.key === current?.key) ? "Marked difficult" : "Mark difficult"}</button><button type="button" onClick={next}>Continue <ArrowRight size={15} /></button></div>}
          </form>
          <p className="answer-hint">{vocabularyQuiz ? englishToJapaneseQuiz ? "Enter the Japanese word. Hiragana, Katakana, Kanji, or Romaji readings are accepted." : "Enter the English meaning. Hiragana readings appear above kanji." : "Enter the reading in Hiragana or Romaji, plus one of the English meanings. Katakana is accepted too."}</p>
        </div>}
        {current?.notes && <p className="study-note">NOTE <span>{current.notes}</span></p>}
      </div>
      {mode === "flashcards" && <div className="flash-controls"><button disabled={index === 0} onClick={() => { setIndex((value) => Math.max(0, value - 1)); setRevealed(false); }}><ChevronLeft size={17} /> Previous</button><label className="flash-direction">FRONT<select value={flashDirection} onChange={(event) => { setFlashDirection(event.target.value as typeof flashDirection); setRevealed(false); }}><option value="primary">{subject === "vocabulary" ? "Japanese → English" : "Kanji → Hiragana"}</option><option value={subject === "vocabulary" ? "reverse" : "meaning"}>{subject === "vocabulary" ? "English → Japanese" : "Kanji → English"}</option><option value="mixed">Mixed review</option></select></label><button onClick={shuffle}><Shuffle size={14} /> Shuffle</button><button onClick={next}>Next <ChevronRight size={17} /></button></div>}
      <div className="study-footer"><span>{mode === "quiz" ? "TAKE YOUR TIME · ACCURACY OVER SPEED" : "A GOOD GUESS IS STILL PRACTICE"}</span><span>ENTER {mode === "quiz" && checked !== null ? "TO CONTINUE" : "TO CHECK"}</span></div>
    </>}
  </main>;
}

function SpecialMeaningControls({ location, demonstrative, formal, setFormal, beforeNoun, setBeforeNoun, distance, setDistance, disabled }: {
  location?: (typeof locationAnswerDetails)[string];
  demonstrative?: (typeof demonstrativeAnswerDetails)[string];
  formal: boolean; setFormal: (value: boolean) => void;
  beforeNoun: boolean; setBeforeNoun: (value: boolean) => void;
  distance: "close" | "far" | ""; setDistance: (value: "close" | "far" | "") => void;
  disabled: boolean;
}) {
  const optionalDistance = Boolean(location?.optionalDistance || demonstrative?.optionalDistance);
  return <div className="special-meaning-controls">
    {location && <label className="special-checkbox"><input type="checkbox" checked={formal} onChange={(event) => setFormal(event.target.checked)} disabled={disabled} /> <span>Formal</span></label>}
    {demonstrative && <label className="special-checkbox"><input type="checkbox" checked={beforeNoun} onChange={(event) => setBeforeNoun(event.target.checked)} disabled={disabled} /> <span>Before a noun</span></label>}
    <fieldset className="special-distance"><legend>DISTANCE{optionalDistance ? " · OPTIONAL" : ""}</legend>
      {optionalDistance && <label><input type="radio" name="special-distance" value="" checked={distance === ""} onChange={() => setDistance("")} disabled={disabled} /> <span>Unspecified</span></label>}
      <label><input type="radio" name="special-distance" value="close" checked={distance === "close"} onChange={() => setDistance("close")} disabled={disabled} /> <span>Relatively close</span></label>
      <label><input type="radio" name="special-distance" value="far" checked={distance === "far"} onChange={() => setDistance("far")} disabled={disabled} /> <span>Relatively far</span></label>
    </fieldset>
  </div>;
}

function LearnView({ items, subject, progress, showRomaji, setShowRomaji, chapterId, dueCount, onShuffle }: { items: StudyItem[]; subject: string; progress: ProgressStore; showRomaji: boolean; setShowRomaji: (value: boolean) => void; chapterId: string; dueCount: number; onShuffle: () => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))] as string[];
  const visible = items.filter((item) => (!query || `${item.japanese} ${item.reading} ${item.meanings.join(" ")}`.toLowerCase().includes(query.toLowerCase())) && (category === "All" || item.category === category));
  return <div className="library-view"><div className="library-heading"><div><p className="eyebrow"><span className="eyebrow-line" />CHAPTER {chapterId} · STUDY LIBRARY</p><h1>Meet the <em>{subject === "vocabulary" ? "words." : "characters."}</em></h1></div><div className="library-actions"><label className="toggle-control"><input type="checkbox" checked={showRomaji} onChange={(e) => setShowRomaji(e.target.checked)} /><span>ROMAJI</span></label><Link href={`/chapter/${chapterId}/study/${subject}/quiz${category !== "All" ? `?category=${encodeURIComponent(category)}` : ""}`} className="button button-dark">{category !== "All" ? "Quiz this category" : "Start a quiz"} <ArrowRight size={15} /></Link></div></div>
    <div className="library-toolbar"><input className="search-input" aria-label="Search entries" placeholder="Search words, readings, meanings…" value={query} onChange={(e) => setQuery(e.target.value)} />{categories.length > 0 && <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter category"><option>All</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>}<span>{visible.length} / {items.length} ENTRIES</span></div>
    <div className="word-list">{visible.map((item, i) => <article className="word-row" key={item.key}><span className="word-index">{String(i + 1).padStart(2, "0")}</span>{item.kanji && <span className="word-kanji-mark" aria-label={`${item.kanji}, ${item.strokeCount} strokes`}>{item.kanji}</span>}<div className="word-primary"><strong>{item.japanese}</strong><span>{item.reading}{showRomaji && ` · ${romaji(item.reading)}`}</span>{item.kanji && <span className="word-readings">{item.strokeCount} strokes · 音 {item.onyomi?.join("、") || "—"} · 訓 {item.kunyomi?.join("、") || "—"}</span>}{item.kanji && item.notes && <span className="word-kanji-note">{item.notes}</span>}</div><span className="word-meaning">{item.meanings.join(" · ")}</span>{item.category && <span className="word-category">{item.category}</span>}<button className="word-audio" onClick={() => { const utterance = new SpeechSynthesisUtterance(item.japanese); utterance.lang = "ja-JP"; window.speechSynthesis?.speak(utterance); }} aria-label={`Play ${item.japanese}`}><Volume2 size={15} /></button><span className="word-mastered">{progress.cards[item.key]?.mastered ? "MASTERED" : progress.cards[item.key]?.difficult ? "REVIEW" : ""}</span></article>)}</div>
    {items.length === 0 && <div className="empty-state compact-empty"><div className="empty-kanji">頁</div><h3>No entries yet.</h3><p>Add some to this chapter JSON when you’re ready.</p></div>}
    <div className="library-bottom"><span>{dueCount} DUE FOR REVIEW</span>{dueCount > 0 && <Link href={`/chapter/${chapterId}/study/${subject}/flashcards?review=due`}>Study due cards <ArrowRight size={15} /></Link>}<button onClick={onShuffle}><Shuffle size={14} /> Mix it up</button><Link href={`/chapter/${chapterId}/study/${subject}/flashcards?review=mistakes`}>Review mistakes <ArrowRight size={15} /></Link><Link href={`/chapter/${chapterId}/study/${subject}/flashcards`}>Practice with flashcards <ArrowRight size={15} /></Link></div>
  </div>;
}

function Results({ results, itemsLength, restart, mistakesOnly }: { results: { correct: number; incorrect: number; skipped: number; mistakes: StudyItem[]; difficult: StudyItem[] }; itemsLength: number; restart: () => void; mistakesOnly: () => void }) {
  const total = results.correct + results.incorrect;
  const accuracy = total ? Math.round(results.correct / total * 100) : 0;
  return <div className="results-view"><p className="eyebrow"><span className="eyebrow-line" />SESSION COMPLETE</p><span className="results-kanji">終</span><h1>One step <em>deeper.</em></h1><p className="results-copy">Every time you recall a word, you make it a little more yours.</p><div className="results-score"><div><span>ACCURACY</span><strong>{accuracy}<small>%</small></strong></div><div><span>CORRECT</span><strong>{String(results.correct).padStart(2, "0")}</strong></div><div><span>REVISIT</span><strong>{String(results.incorrect).padStart(2, "0")}</strong></div><div><span>SKIPPED</span><strong>{String(results.skipped).padStart(2, "0")}</strong></div></div>{results.mistakes.length > 0 && <section className="results-review"><h2>Words to meet again <span>{results.mistakes.length}</span></h2>{results.mistakes.map((item) => <div key={item.key}><strong>{item.japanese}</strong><span>{item.reading} · {item.meanings.join(" / ")}</span></div>)}</section>}{results.difficult.length > 0 && <section className="results-review"><h2>Marked difficult <span>{results.difficult.length}</span></h2>{results.difficult.map((item) => <div key={item.key}><strong>{item.japanese}</strong><span>{item.reading} · {item.meanings.join(" / ")}</span></div>)}</section>}<div className="results-actions"><button className="button button-dark" onClick={restart}><RotateCcw size={15} /> Study again</button>{results.mistakes.length > 0 && <button className="button button-outline" onClick={mistakesOnly}>Review mistakes <ArrowRight size={15} /></button>}<span>{total} answered of {itemsLength} cards</span></div></div>;
}
