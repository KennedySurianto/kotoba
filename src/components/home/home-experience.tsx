"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, CirclePlay, Download, Upload } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Chapter } from "@/lib/chapters/schema";
import { exportProgress, importProgress, loadProgress, type ProgressStore } from "@/lib/storage/progress";
import { getLatestQuizSession, type SavedQuizSession } from "@/lib/storage/quiz-sessions";
import { getLastStudyActivity, type StudyActivity } from "@/lib/storage/study-activity";
import { getNumbersPracticeSession, type SavedNumbersPractice } from "@/lib/storage/numbers-practice";

gsap.registerPlugin(ScrollTrigger);

const methodSteps = [
  { title: "Start with a chapter", description: "Choose a focused set of words and characters for each study session." },
  { title: "Meet words in context", description: "Study vocabulary and kanji together, with readings and meanings side by side." },
  { title: "Recall before you reveal", description: "Use quizzes to bring a reading or meaning to mind from memory." },
  { title: "Return to mistakes", description: "Review missed answers in a focused session, one fresh attempt at a time." },
  { title: "Come back over time", description: "Your browser saves progress and brings cards back when they are due." },
];
export function HomeExperience({ chapters }: { chapters: Chapter[] }) {
  const [progress, setProgress] = useState<ProgressStore>({ cards: {}, quizStats: { completedRuns: 0, correctAnswers: 0, completedRunIds: [] }, updatedAt: "" });
  const [ongoingQuiz, setOngoingQuiz] = useState<SavedQuizSession | null>(null);
  const [ongoingNumbersPractice, setOngoingNumbersPractice] = useState<SavedNumbersPractice | null>(null);
  const [lastStudyActivity, setLastStudyActivity] = useState<StudyActivity | null>(null);
  const [activeMethodStep, setActiveMethodStep] = useState(0);
  const activeMethodStepRef = useRef(0);
  const pageRef = useRef<HTMLElement>(null);
  const methodStepRefs = useRef<Array<HTMLElement | null>>([]);
  const backupInput = useRef<HTMLInputElement>(null);
  const [backupMessage, setBackupMessage] = useState("");
  const heroFigures = useMemo(() => {
    const figures = new Map<string, string>();
    chapters.forEach((chapter) => chapter.kanji.forEach((kanji) => {
      if (!figures.has(kanji.character)) figures.set(kanji.character, kanji.meanings[0] ?? "Japanese character");
    }));
    return Array.from(figures, ([character, meaning]) => ({ character, meaning }));
  }, [chapters]);
  const [heroFigure, setHeroFigure] = useState<{ character: string; meaning: string } | null>(null);
  useEffect(() => {
    const refreshLocalState = () => { setProgress(loadProgress()); setOngoingQuiz(getLatestQuizSession()); setOngoingNumbersPractice(getNumbersPracticeSession()); setLastStudyActivity(getLastStudyActivity()); };
    const timer = window.setTimeout(refreshLocalState, 0);
    window.addEventListener("storage", refreshLocalState);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", refreshLocalState); };
  }, []);
  useEffect(() => {
    if (heroFigures.length === 0) return;
    const randomIndex = Math.floor(Math.random() * heroFigures.length);
    setHeroFigure(heroFigures[randomIndex] ?? null);
  }, [heroFigures]);
  useEffect(() => {
    const updateActiveStep = () => {
      const readingLine = window.innerHeight * 0.42;
      let nearestIndex = activeMethodStepRef.current;
      let nearestDistance = Number.POSITIVE_INFINITY;
      methodStepRefs.current.forEach((step, index) => {
        if (!step) return;
        const bounds = step.getBoundingClientRect();
        if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) return;
        const distance = Math.abs(bounds.top + bounds.height * 0.45 - readingLine);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      if (activeMethodStepRef.current !== nearestIndex) {
        activeMethodStepRef.current = nearestIndex;
        setActiveMethodStep(nearestIndex);
      }
    };
    updateActiveStep();
    window.addEventListener("scroll", updateActiveStep, { passive: true });
    window.addEventListener("resize", updateActiveStep);
    return () => {
      window.removeEventListener("scroll", updateActiveStep);
      window.removeEventListener("resize", updateActiveStep);
    };
  }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.from("#method > *", { y: 18, autoAlpha: 0, stagger: 0.13, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: "#method", start: "top 82%" } });
      gsap.from(".chapter-row", { y: 16, autoAlpha: 0, stagger: 0.09, duration: 0.7, ease: "power3.out", scrollTrigger: { trigger: ".chapter-list", start: "top 78%" } });
      gsap.from(".practice-section .stat-cell, .practice-section .continue-cell", { y: 15, autoAlpha: 0, stagger: 0.1, duration: 0.65, ease: "power3.out", scrollTrigger: { trigger: ".stats-grid", start: "top 84%" } });
    }, pageRef);
    return () => context.revert();
  }, [chapters.length]);
  const firstChapter = chapters[0];
  const mostRecentAnsweredCard = Object.entries(progress.cards)
    .filter(([, card]) => card.lastStudied)
    .sort(([, a], [, b]) => (b.lastStudied ?? "").localeCompare(a.lastStudied ?? ""))[0];
  const answeredChapterId = mostRecentAnsweredCard?.[0].split(":")[0];
  const answeredChapter = chapters.find((chapter) => chapter.id === answeredChapterId);
  const activityChapter = chapters.find((chapter) => chapter.id === lastStudyActivity?.chapterId);
  const answeredAt = mostRecentAnsweredCard?.[1].lastStudied ?? "";
  const activityIsNewer = Boolean(activityChapter && lastStudyActivity && lastStudyActivity.updatedAt >= answeredAt);
  const lastChapter = activityIsNewer ? activityChapter : answeredChapter ?? activityChapter ?? firstChapter;
  const resumeNumbersPractice = Boolean(ongoingNumbersPractice && (!ongoingQuiz || ongoingNumbersPractice.updatedAt > ongoingQuiz.updatedAt));
  const downloadBackup = () => {
    const url = URL.createObjectURL(new Blob([exportProgress()], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "kotoba-progress.json"; anchor.click(); URL.revokeObjectURL(url);
    setBackupMessage("Progress backup downloaded.");
  };
  const restoreBackup = async (file?: File) => {
    if (!file) return;
    try { setProgress(importProgress(await file.text())); setBackupMessage("Progress restored in this browser."); }
    catch { setBackupMessage("That file is not a valid Kotoba backup."); }
  };

  return <main ref={pageRef}>
    <section className="hero wrap">
      <div className="hero-copy">
        <p className="eyebrow"><span className="eyebrow-line" />A quieter way to learn Japanese <span className="eyebrow-jp">日本語を学ぶ</span></p>
        <h1>Small words.<br /><em>Whole worlds.</em></h1>
        <p className="hero-intro">A thoughtful space to build a lasting relationship with Japanese — one chapter, one word, one small moment at a time.</p>
        <div className="hero-actions"><Link className="button button-dark" href="#chapters">Explore the chapters <ArrowRight size={16} /></Link><span className="hero-note">A personal study practice<br />made for your own pace.</span></div>
      </div>
      <div className="hero-art" role={heroFigure ? "img" : undefined} aria-label={heroFigure ? `Decorative Japanese character ${heroFigure.character}, meaning ${heroFigure.meaning}` : undefined}>
        <span className="hero-art-orbit orbit-a" /><span className="hero-art-orbit orbit-b" />
        {heroFigure && <><div className="hero-kanji">{heroFigure.character}</div><span className="hero-art-caption">{heroFigure.character} — {heroFigure.meaning.toLowerCase()}<br />one mark from your study path</span></>}
        <span className="hero-art-index">FIG. 01<br />THE FIRST MARK</span>
      </div>
      <div className="hero-bottom"><span>LESS, LEARNED DEEPLY</span><a href="#chapters">Scroll to begin <ArrowDown size={13} /></a><span>START WHERE YOU ARE</span></div>
    </section>

    <section className="method-section wrap" id="method">
      <div className="method-layout">
        <div className="method-overview">
          <div className="method-heading">
            <div><p className="eyebrow"><span className="eyebrow-line" />A PRACTICE IN FIVE STEPS</p><h2>Learn a little.<br /><em>Remember more.</em></h2></div>
            <p>Learning Japanese takes more than collecting answers. Build a steady rhythm: notice patterns, recall what you know, and meet each word again.</p>
          </div>
          <div className="method-progress" aria-live="polite">
            <span className="method-progress-count">{String(activeMethodStep + 1).padStart(2, "0")} <i>/ 05</i></span>
            <strong>{methodSteps[activeMethodStep].title}</strong>
            <span className="method-progress-track"><i style={{ width: `${((activeMethodStep + 1) / methodSteps.length) * 100}%` }} /></span>
          </div>
        </div>
        <div className="method-steps">{methodSteps.map((step, index) => <article className="method-step" key={step.title} ref={(element) => { methodStepRefs.current[index] = element; }}><span>{String(index + 1).padStart(2, "0")} <i>/ 05</i></span><h3>{step.title}</h3><p>{step.description}</p></article>)}</div>
      </div>
      <div className="method-note"><span>ことばは、出会いの積み重ね。</span><span>NOTICE · RECALL · RETURN</span></div>
    </section>

    <section className="chapters-section" id="chapters"><div className="wrap">
      <div className="section-head"><div><p className="eyebrow"><span className="eyebrow-line" />YOUR STUDY PATH</p><h2>Begin with a <em>chapter.</em></h2></div><p className="section-aside">Each chapter brings vocabulary and kanji<br />together, just as they live in language.</p></div>
      {chapters.length === 0 ? <div className="empty-state"><div className="empty-kanji">頁</div><p className="eyebrow">A BLANK PAGE, FULL OF POSSIBILITY</p><h3>Your first chapter is waiting.</h3><p>Add a numbered JSON file to <code>chapters/</code> to begin your library.</p></div> : <div className="chapter-list">
        {chapters.map((chapter) => {
          const count = chapter.vocabulary.length + chapter.kanji.reduce((sum, item) => sum + item.examples.length, 0);
          const chapterProgress = Object.entries(progress.cards).filter(([key]) => key.startsWith(`${chapter.id}:`)).map(([, item]) => item);
          const done = chapterProgress.filter((item) => item.mastered).length;
          const pct = count ? Math.round(done / count * 100) : 0;
          return <Link className="chapter-row" href={`/chapter/${chapter.id}`} key={chapter.id}>
            <span className="chapter-number">{chapter.id}<sup>—</sup></span><span className="chapter-title"><strong>{chapter.title}</strong><span>{chapter.titleJapanese} <i>·</i> {chapter.description}</span></span><span className="chapter-meta"><span>{String(chapter.vocabulary.length).padStart(2, "0")} WORDS</span><span>{String(chapter.kanji.length).padStart(2, "0")} KANJI</span></span><span className="chapter-progress"><span className="progress-track"><i style={{ width: `${pct}%` }} /></span><small>{pct}%</small></span><span className="chapter-arrow"><ArrowUpRight size={17} /></span><span className="chapter-hover-jp">{chapter.titleJapanese}</span>
          </Link>;
        })}
      </div>}
      <div className="collection-foot"><span>{String(chapters.length).padStart(2, "0")} CHAPTERS IN YOUR COLLECTION</span><span>ADDED AT YOUR OWN PACE <span className="red-dot">●</span></span></div>
    </div></section>

    <section className="numbers-practice-promo wrap"><div><p className="eyebrow"><span className="eyebrow-line" />A LITTLE EXTRA PRACTICE</p><h2>Numbers in <em>everyday life.</em></h2><p>Practice prices, age, dates, time, and the days of the week.</p></div><Link className="button button-dark" href="/practice/numbers">Explore number practice <ArrowUpRight size={15} /></Link></section>

    <section className="practice-section wrap">
      <div className="practice-heading"><p className="eyebrow"><span className="eyebrow-line" />A PRACTICE THAT REMEMBERS</p><h2>Progress, at <em>your pace.</em></h2></div>
      <div className="stats-grid">
        <div className="stat-cell"><span className="stat-label"><CirclePlay size={13} /> QUIZ SESSIONS</span><strong>{String(progress.quizStats.completedRuns).padStart(2, "0")}</strong><span className="stat-foot">quizzes completed</span></div>
        <div className="stat-cell"><span className="stat-label"><CirclePlay size={13} /> CORRECT QUIZ ANSWERS</span><strong>{String(progress.quizStats.correctAnswers).padStart(2, "0")}</strong><span className="stat-foot">answered correctly</span></div>
        <div className="continue-cell">
          {resumeNumbersPractice && ongoingNumbersPractice ? <><span className="stat-label">QUIZ IN PROGRESS</span><p>Numbers & everyday Japanese<br /><strong>{ongoingNumbersPractice.categoryIds.length} categories</strong></p><Link className="text-link" href="/practice/numbers">Resume practice · {Math.min(ongoingNumbersPractice.index + 1, ongoingNumbersPractice.questionIds.length)}/{ongoingNumbersPractice.questionIds.length} <ArrowRight size={15} /></Link></> : ongoingQuiz ? <><span className="stat-label">QUIZ IN PROGRESS</span><p>{ongoingQuiz.chapterTitle}<br /><strong>{ongoingQuiz.subject} · {ongoingQuiz.chapterId}</strong></p><Link className="text-link" href={ongoingQuiz.href}>Resume quiz · {Math.min(ongoingQuiz.index + 1, ongoingQuiz.itemKeys.length)}/{ongoingQuiz.itemKeys.length} <ArrowRight size={15} /></Link></> : lastChapter ? <><span className="stat-label">{activityChapter || answeredChapter ? "PICK UP WHERE YOU LEFT OFF" : "START WHERE YOU ARE"}</span><p>{lastChapter.titleJapanese}<br /><strong>{lastChapter.title}</strong></p><Link className="text-link" href={`/chapter/${lastChapter.id}`}>Choose a study mode <ArrowRight size={15} /></Link></> : <span className="stat-foot">Your next study session will appear here.</span>}
        </div>
      </div>
      <div className="progress-backup"><span>YOUR PRACTICE LIVES IN THIS BROWSER.</span><div><button onClick={downloadBackup}><Download size={13} /> Export backup</button><button onClick={() => backupInput.current?.click()}><Upload size={13} /> Import backup</button><input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={(event) => restoreBackup(event.target.files?.[0])} /></div></div>
      <p className="backup-message" role="status">{backupMessage}</p><p className="local-note">Your progress is saved in this browser, on this device.</p>
    </section>

    <footer className="site-footer"><div className="wrap footer-inner"><span className="brand"><span className="brand-mark">言</span>KOTOBA<span className="brand-dot">.</span></span><span>日本語を、少しずつ。 <i>—</i> Japanese, little by little.</span><span>MADE FOR THE LONG WAY <b>↗</b></span></div></footer>
  </main>;
}
