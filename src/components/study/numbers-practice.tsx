"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type CompositionEvent, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, RotateCcw, Shuffle } from "lucide-react";
import { toHiragana, toKatakana } from "wanakana";
import { matchesReading } from "@/lib/japanese";
import { generateNumbersPracticeQuestions, getNumbersPracticeQuestionCount, numbersPracticeCategories, type NumbersPracticeCategoryId, type NumbersPracticeQuestion } from "@/lib/study/numbers-practice";
import { getNumbersPracticeSession, removeNumbersPracticeSession, saveNumbersPracticeSession, type SavedNumbersPractice, type NumbersPracticeOrder } from "@/lib/storage/numbers-practice";
import { recordCompletedQuiz, recordCorrectQuizAnswer } from "@/lib/storage/progress";
import { playUiSound } from "@/lib/ui-sound";

type View = "loading" | "setup" | "resume" | "quiz" | "quit" | "results";

function newRunId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `numbers-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

type JapaneseInputMode = "hiragana" | "katakana";

function convertJapaneseInput(value: string, mode: JapaneseInputMode) {
  const pendingN = /n$/i.test(value) && !/nn$/i.test(value);
  const text = pendingN ? value.slice(0, -1) : value;
  const hiragana = toHiragana(text, { IMEMode: "toHiragana" });
  const converted = mode === "katakana" ? toKatakana(hiragana) : hiragana;
  return `${converted}${pendingN ? value.slice(-1) : ""}`;
}

function renderJapaneseParts(parts: { text: string; reading?: string }[]) {
  return <>{parts.map((part, index) => part.reading
    ? <ruby className="numbers-furigana" key={`${index}-${part.text}`}>{part.text}<rt>{part.reading}</rt></ruby>
    : <span key={`${index}-${part.text}`}>{part.text}</span>)}</>;
}

export function NumbersPractice() {
  const [view, setView] = useState<View>("loading");
  const [selectedCategories, setSelectedCategories] = useState<NumbersPracticeCategoryId[]>(numbersPracticeCategories.map((category) => category.id));
  const [order, setOrder] = useState<NumbersPracticeOrder>("shuffle");
  const [questions, setQuestions] = useState<NumbersPracticeQuestion[]>([]);
  const [saved, setSaved] = useState<SavedNumbersPractice | null>(null);
  const [runId, setRunId] = useState("");
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [japaneseInputMode, setJapaneseInputMode] = useState<JapaneseInputMode>("hiragana");
  const [checked, setChecked] = useState<boolean | null>(null);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const question = questions[index];
  const allSelected = selectedCategories.length === numbersPracticeCategories.length;
  const questionCount = getNumbersPracticeQuestionCount(selectedCategories);

  useEffect(() => {
    const active = getNumbersPracticeSession();
    if (active && active.questions.length > 0) {
      if (active.questionIds.every((id) => active.questions.some((question) => question.id === id))) {
        setSaved(active);
        setSelectedCategories(active.categoryIds);
        setOrder(active.order);
        setView("resume");
        return;
      }
      removeNumbersPracticeSession();
    }
    setView("setup");
  }, []);

  useEffect(() => {
    if (view !== "quiz" || !runId || correct + incorrect === 0) return;
    saveNumbersPracticeSession({
      runId, categoryIds: selectedCategories, order, questions, questionIds: questions.map((item) => item.id),
      japaneseInputMode, index, answer, checked, correct, incorrect, skipped, updatedAt: new Date().toISOString(),
    });
  }, [view, runId, selectedCategories, order, questions, japaneseInputMode, index, answer, checked, correct, incorrect, skipped]);

  useEffect(() => {
    if (view !== "quiz") return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [view, index, checked]);

  const begin = (categoryIds: NumbersPracticeCategoryId[], selectedOrder: NumbersPracticeOrder, existing?: SavedNumbersPractice) => {
    const pool = existing?.questions ?? generateNumbersPracticeQuestions(categoryIds);
    const ordered = existing
      ? existing.questions
      : selectedOrder === "shuffle" ? shuffle(pool) : pool;
    if (!ordered.length) return;
    const nextRunId = existing?.runId ?? newRunId();
    setSelectedCategories(categoryIds);
    setOrder(selectedOrder);
    setQuestions(ordered);
    setRunId(nextRunId);
    setIndex(existing?.index ?? 0);
    setAnswer(existing?.answer ?? "");
    setJapaneseInputMode(existing?.japaneseInputMode ?? "hiragana");
    setChecked(existing?.checked ?? null);
    setCorrect(existing?.correct ?? 0);
    setIncorrect(existing?.incorrect ?? 0);
    setSkipped(existing?.skipped ?? 0);
    setView("quiz");
  };

  const toggleCategory = (categoryId: NumbersPracticeCategoryId) => {
    setSelectedCategories((current) => current.includes(categoryId) ? current.filter((id) => id !== categoryId) : numbersPracticeCategories.map((category) => category.id).filter((id) => id === categoryId || current.includes(id)));
  };

  const updateAnswer = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    if (isComposing) { setAnswer(input.value); return; }
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const converted = convertJapaneseInput(input.value, japaneseInputMode);
    const nextStart = convertJapaneseInput(input.value.slice(0, start), japaneseInputMode).length;
    const nextEnd = convertJapaneseInput(input.value.slice(0, end), japaneseInputMode).length;
    setAnswer(converted);
    window.requestAnimationFrame(() => inputRef.current?.setSelectionRange(nextStart, nextEnd));
  };

  const selectJapaneseInputMode = (nextMode: JapaneseInputMode) => {
    setJapaneseInputMode(nextMode);
    setAnswer(convertJapaneseInput(answer, nextMode));
    inputRef.current?.focus({ preventScroll: true });
  };

  const finish = () => {
    if (correct + incorrect > 0) recordCompletedQuiz(runId);
    removeNumbersPracticeSession();
    setSaved(null);
    setView("results");
  };

  const advance = (nextCorrect = correct, nextIncorrect = incorrect, nextSkipped = skipped) => {
    if (index >= questions.length - 1) {
      setCorrect(nextCorrect); setIncorrect(nextIncorrect); setSkipped(nextSkipped);
      finish();
      return;
    }
    setIndex((value) => value + 1);
    setAnswer(""); setChecked(null);
  };

  const submit = () => {
    if (!question || checked !== null || !answer.trim() || isComposing) return;
    const isCorrect = matchesReading(answer, [question.reading, ...(question.acceptedReadings ?? [])]);
    playUiSound(isCorrect ? "correct" : "incorrect");
    setChecked(isCorrect);
    if (isCorrect) {
      recordCorrectQuizAnswer();
      setCorrect((value) => value + 1);
    } else setIncorrect((value) => value + 1);
  };

  const skipQuestion = () => advance(correct, incorrect, skipped + 1);
  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || isComposing) return;
    if (event.altKey && (event.key === "1" || event.key === "2")) {
      event.preventDefault();
      selectJapaneseInputMode(event.key === "1" ? "hiragana" : "katakana");
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (checked === null) submit();
    else advance();
  };

  const quit = () => {
    removeNumbersPracticeSession();
    setSaved(null);
    setView("setup");
  };

  if (view === "loading") return <main className="study-shell focus-mode"><p className="quiz-session-loading">LOADING YOUR PRACTICE…</p></main>;

  return <main className={`study-shell focus-mode numbers-practice-shell`}>
    <div className="study-topline">
      {view === "setup" || view === "results" ? <Link href="/" className="study-exit"><ArrowLeft size={15} /><span>COLLECTION</span></Link> : <button type="button" className="study-exit numbers-exit" onClick={() => setView("quit")}><ArrowLeft size={15} /><span>EXIT PRACTICE</span></button>}
      <span className="study-mode-label">NUMBERS & EVERYDAY JAPANESE<b> · </b> PRACTICE</span>
      {view === "quiz" && <span className="study-mode-right"><span>FOCUS MODE</span><button type="button" onClick={() => setView("quit")}>EXIT <b>×</b></button></span>}
    </div>

    {view === "setup" && <section className="numbers-setup">
      <div className="numbers-setup-hero"><div className="numbers-setup-copy"><p className="eyebrow"><span className="eyebrow-line" />PRACTICE BY CATEGORY</p><h1>Numbers &<br /><em>everyday Japanese.</em></h1><p className="numbers-intro">Choose what to practice. Type the Japanese reading in romaji; it will convert to hiragana as you go.</p></div><div className="numbers-hero-art" aria-hidden="true"><span className="numbers-hero-orbit" /><span className="numbers-hero-kanji">数</span><small>FIG. 02<br />NUMBERS IN DAILY LIFE</small><span className="numbers-hero-caption">数を、少しずつ。</span></div></div>
      <div className="numbers-category-heading"><span>CHOOSE CATEGORIES</span><button type="button" onClick={() => setSelectedCategories(allSelected ? [] : numbersPracticeCategories.map((category) => category.id))}>{allSelected ? "Clear all" : "Select all"}</button></div>
      <div className="numbers-category-grid">{numbersPracticeCategories.map((category) => <label key={category.id} className={`numbers-category-option ${selectedCategories.includes(category.id) ? "is-selected" : ""}`}><input className="numbers-category-input" type="checkbox" checked={selectedCategories.includes(category.id)} onChange={() => toggleCategory(category.id)} /><span className="numbers-category-check" aria-hidden="true">{selectedCategories.includes(category.id) ? "✓" : ""}</span><span className="numbers-category-art" aria-hidden="true">{category.japaneseParts.map((part) => part.text).join("")}</span><span className="numbers-category-jp" lang="ja">{renderJapaneseParts(category.japaneseParts)}</span><strong>{category.title}</strong><small>{category.description}</small><span className="numbers-category-meta">{getNumbersPracticeQuestionCount([category.id])} PROMPTS <span className="numbers-card-arrow"><ArrowRight size={14} /></span></span></label>)}</div>
      <fieldset className="numbers-order"><legend>QUESTION ORDER</legend><label><input type="radio" name="numbers-order" checked={order === "shuffle"} onChange={() => setOrder("shuffle")} /><span><strong><Shuffle size={14} /> Shuffle together</strong><small>Mix all selected categories.</small></span></label><label><input type="radio" name="numbers-order" checked={order === "category"} onChange={() => setOrder("category")} /><span><strong>One category at a time</strong><small>Keep each selected category together.</small></span></label></fieldset>
      <div className="numbers-start-row"><span>{questionCount} questions selected</span><button type="button" className="button button-dark" disabled={questionCount === 0} onClick={() => begin(selectedCategories, order)}>Start practice <ArrowRight size={15} /></button></div>
      <Link className="back-link" href="/">Back to all chapters</Link>
    </section>}

    {view === "resume" && saved && <section className="quiz-resume-prompt numbers-prompt" aria-labelledby="numbers-resume-title"><p className="eyebrow"><span className="eyebrow-line" />PRACTICE IN PROGRESS</p><h1 id="numbers-resume-title">Pick up where you left off?</h1><p>You’ve answered {saved.correct + saved.incorrect} question{saved.correct + saved.incorrect === 1 ? "" : "s"} in this numbers practice session. Continue from question {Math.min(saved.index + 1, saved.questionIds.length)} or start the selected categories over.</p><div><button type="button" className="button button-dark" onClick={() => begin(saved.categoryIds, saved.order, saved)}>Continue practice <ArrowRight size={15} /></button><button type="button" className="quiz-start-over" onClick={() => { removeNumbersPracticeSession(); setSaved(null); setView("setup"); }}>Start over <RotateCcw size={14} /></button></div></section>}

    {view === "quit" && <section className="quiz-resume-prompt numbers-prompt" aria-labelledby="numbers-quit-title"><p className="eyebrow"><span className="eyebrow-line" />LEAVE THIS SESSION?</p><h1 id="numbers-quit-title">Do you really want to quit?</h1><p>Your saved answers and progress in this practice session will be erased.</p><div><button type="button" className="button button-dark" onClick={() => setView("quiz")}>Keep practicing <ArrowRight size={15} /></button><button type="button" className="quiz-start-over" onClick={quit}>Quit and erase progress</button></div></section>}

    {view === "quiz" && question && <>
      <div className="session-progress"><span>{String(index + 1).padStart(2, "0")} <i>/</i> {String(questions.length).padStart(2, "0")}</span><div><i style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div><button type="button" disabled={checked !== null} onClick={skipQuestion}>Skip <ArrowRight size={13} /></button></div>
      <section className="numbers-question" key={question.id}>
        <div className="numbers-question-category">{numbersPracticeCategories.find((category) => category.id === question.category)?.title}</div>
        <div className="numbers-question-prompt" lang="ja">{question.promptParts ? renderJapaneseParts(question.promptParts) : question.prompt}</div>
        <p className="prompt-meaning">TYPE THE JAPANESE READING</p>
        <div className="quiz-answer-area numbers-answer-area">
          <label htmlFor="numbers-answer">YOUR ANSWER <span>ALT+1 HIRAGANA · ALT+2 KATAKANA</span></label>
          <div className={`answer-input-wrap ${checked === null ? "" : checked ? "input-correct" : "input-wrong"}`}><input ref={inputRef} id="numbers-answer" type="text" lang="ja" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={japaneseInputMode === "hiragana" ? "Type in hiragana or romaji…" : "Type in katakana or romaji…"} value={answer} readOnly={checked !== null} onChange={updateAnswer} onKeyDown={onInputKeyDown} onCompositionStart={() => setIsComposing(true)} onCompositionEnd={(event: CompositionEvent<HTMLInputElement>) => { setIsComposing(false); setAnswer(convertJapaneseInput(event.currentTarget.value, japaneseInputMode)); }} /><span>↵</span></div>
          <div className="japanese-input-modes numbers-input-modes" aria-label="Japanese input mode"><button type="button" tabIndex={-1} disabled={checked !== null} aria-pressed={japaneseInputMode === "hiragana"} onClick={() => selectJapaneseInputMode("hiragana")}>HIRAGANA <kbd>ALT+1</kbd></button><button type="button" tabIndex={-1} disabled={checked !== null} aria-pressed={japaneseInputMode === "katakana"} onClick={() => selectJapaneseInputMode("katakana")}>KATAKANA <kbd>ALT+2</kbd></button></div>
          {checked === null ? <button type="button" className="button button-dark check-button" disabled={!answer.trim()} onClick={submit}>Check answer <ArrowRight size={15} /></button> : <div className={`quiz-feedback ${checked ? "feedback-correct" : "feedback-wrong"}`}><div><strong>{checked ? "Correct." : "Not quite."}</strong><span>{question.reading}{(question.acceptedReadings ?? []).map((reading) => <span key={reading}> · {reading}</span>)}</span></div><button type="button" onClick={() => advance()}>Continue <ArrowRight size={15} /></button></div>}
          <p className="answer-hint">Enter kana or romaji. Answers are checked against accepted Japanese readings.</p>
        </div>
      </section>
      <div className="study-footer"><span>TAKE YOUR TIME · ACCURACY OVER SPEED</span><span>ENTER {checked !== null ? "TO CONTINUE" : "TO CHECK"}</span></div>
    </>}

    {view === "results" && <section className="results-view numbers-results"><p className="eyebrow"><span className="eyebrow-line" />PRACTICE COMPLETE</p><h1>A little more <em>Japanese.</em></h1><p className="results-copy">You practiced {questions.length} question{questions.length === 1 ? "" : "s"} across {selectedCategories.length} categor{selectedCategories.length === 1 ? "y" : "ies"}.</p><div className="results-score"><div><span>CORRECT</span><strong>{String(correct).padStart(2, "0")}</strong></div><div><span>MISSED</span><strong>{String(incorrect).padStart(2, "0")}</strong></div><div><span>SKIPPED</span><strong>{String(skipped).padStart(2, "0")}</strong></div><div><span>ACCURACY</span><strong>{correct + incorrect ? `${Math.round(correct / (correct + incorrect) * 100)}%` : "—"}</strong></div></div><div className="results-actions"><button type="button" className="button button-dark" onClick={() => setView("setup")}>Choose categories <ArrowRight size={15} /></button><button type="button" className="button button-outline" onClick={() => begin(selectedCategories, order)}>Practice again <RotateCcw size={14} /></button><Link href="/" className="back-link">Back to all chapters</Link></div></section>}
  </main>;
}
