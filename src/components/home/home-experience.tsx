"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, CirclePlay, Download, RotateCcw, Upload } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Chapter } from "@/lib/chapters/schema";
import { exportProgress, importProgress, loadProgress, type ProgressStore } from "@/lib/storage/progress";

gsap.registerPlugin(ScrollTrigger);

const methodSteps = [
  { title: "Start with a chapter", description: "Choose a focused set of words and characters for each study session." },
  { title: "Meet words in context", description: "Study vocabulary and kanji together, with readings and meanings side by side." },
  { title: "Recall before you reveal", description: "Use quizzes to bring a reading or meaning to mind from memory." },
  { title: "Return to mistakes", description: "Review missed answers in a focused session, one fresh attempt at a time." },
  { title: "Come back over time", description: "Your browser saves progress and brings cards back when they are due." },
];

export function HomeExperience({ chapters }: { chapters: Chapter[] }) {
  const [progress, setProgress] = useState<ProgressStore>({ cards: {}, updatedAt: "" });
  const [activeMethodStep, setActiveMethodStep] = useState(0);
  const activeMethodStepRef = useRef(0);
  const pageRef = useRef<HTMLElement>(null);
  const methodStepRefs = useRef<Array<HTMLElement | null>>([]);
  const backupInput = useRef<HTMLInputElement>(null);
  const [backupMessage, setBackupMessage] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setProgress(loadProgress()), 0);
    return () => window.clearTimeout(timer);
  }, []);
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
  const values = Object.values(progress.cards);
  const totalAnswers = values.reduce((sum, item) => sum + item.correct + item.incorrect, 0);
  const mastered = values.filter((item) => item.mastered).length;
  const due = values.filter((item) => item.nextReview && new Date(item.nextReview) <= new Date()).length;
  const firstChapter = chapters[0];
  const dueEntries = Object.entries(progress.cards).filter(([, item]) => item.nextReview && new Date(item.nextReview) <= new Date());
  const firstDue = dueEntries.find(([key]) => chapters.some((chapter) => key.startsWith(`${chapter.id}:`)))?.[0];
  const [dueChapterId, dueType] = firstDue?.split(":") ?? [];
  const dueSubject = dueType === "k" ? "kanji" : "vocabulary";
  const dueInCollection = dueChapterId && dueType ? dueEntries.filter(([key]) => key.startsWith(`${dueChapterId}:${dueType}:`)).length : 0;
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
      <div className="hero-art" aria-label="Decorative Japanese character 一">
        <span className="hero-art-orbit orbit-a" /><span className="hero-art-orbit orbit-b" />
        <div className="hero-kanji">一</div>
        <span className="hero-art-caption">一 — one<br />the beginning of everything</span>
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

    <section className="practice-section wrap"><div className="practice-heading"><p className="eyebrow"><span className="eyebrow-line" />A PRACTICE THAT REMEMBERS</p><h2>Progress, at <em>your pace.</em></h2></div><div className="stats-grid"><div className="stat-cell"><span className="stat-label"><BookOpen size={13} /> STUDY SESSIONS</span><strong>{String(totalAnswers).padStart(2, "0")}</strong><span className="stat-foot">answers practiced</span></div><div className="stat-cell"><span className="stat-label"><CirclePlay size={13} /> WORDS MASTERED</span><strong>{String(mastered).padStart(2, "0")}</strong><span className="stat-foot">ready to recall</span></div><div className="stat-cell"><span className="stat-label"><RotateCcw size={13} /> REVIEW DUE</span><strong>{String(due).padStart(2, "0")}</strong><span className="stat-foot">waiting for another look</span></div><div className="continue-cell">{firstChapter ? <><span className="stat-label">PICK UP WHERE YOU LEFT OFF</span><p>{firstChapter.titleJapanese}<br /><strong>{firstChapter.title}</strong></p><Link className="text-link" href={`/chapter/${firstChapter.id}`}>Continue learning <ArrowRight size={15} /></Link>{dueChapterId && <Link className="text-link due-link" href={`/chapter/${dueChapterId}/study/${dueSubject}/flashcards?review=due`}>Review due cards ({dueInCollection}) <ArrowRight size={15} /></Link>}</> : <span className="stat-foot">Your next study session will appear here.</span>}</div></div><div className="progress-backup"><span>YOUR PRACTICE LIVES IN THIS BROWSER.</span><div><button onClick={downloadBackup}><Download size={13} /> Export backup</button><button onClick={() => backupInput.current?.click()}><Upload size={13} /> Import backup</button><input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={(event) => restoreBackup(event.target.files?.[0])} /></div></div><p className="backup-message" role="status">{backupMessage}</p><p className="local-note">Your progress is saved in this browser, on this device.</p></section>

    <footer className="site-footer"><div className="wrap footer-inner"><span className="brand"><span className="brand-mark">言</span>KOTOBA<span className="brand-dot">.</span></span><span>日本語を、少しずつ。 <i>—</i> Japanese, little by little.</span><span>MADE FOR THE LONG WAY <b>↗</b></span></div></footer>
  </main>;
}
