"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Layers3 } from "lucide-react";
import type { Chapter } from "@/lib/chapters/schema";

export function ChapterExperience({ chapter }: { chapter: Chapter }) {
  return <main className="chapter-page wrap">
    <div className="crumbs"><Link href="/">COLLECTION</Link><span>/</span><span>CHAPTER {chapter.id}</span></div>
    <section className="chapter-hero"><div className="chapter-hero-copy"><p className="eyebrow"><span className="eyebrow-line" />CHAPTER {chapter.id} · YOUR STUDY PATH</p><h1>{chapter.title}<br /><em>{chapter.titleJapanese}</em></h1><p>{chapter.description}</p></div><div className="chapter-hero-mark"><span>章</span><small>STUDY<br />COLLECTION</small></div></section>
    <div className="chapter-divider"><span>CHOOSE A PATH</span><span>{String(chapter.vocabulary.length).padStart(2, "0")} WORDS <i>·</i> {String(chapter.kanji.length).padStart(2, "0")} KANJI</span></div>
    <div className="subject-grid">
      <Link className="subject-card" href={`/chapter/${chapter.id}/vocabulary`}><span className="subject-count">01 / WORDS</span><span className="subject-jp">ことば</span><h2>Vocabulary</h2><p>Build familiarity with the words that make everyday Japanese.</p><span className="subject-card-bottom"><span><BookOpen size={15} /> {chapter.vocabulary.length} entries</span><span className="circle-arrow"><ArrowUpRight size={18} /></span></span></Link>
      <Link className="subject-card subject-card-ink" href={`/chapter/${chapter.id}/kanji`}><span className="subject-count">02 / CHARACTERS</span><span className="subject-jp">漢字</span><h2>Kanji</h2><p>Meet each character through its meanings, readings, and words.</p><span className="subject-card-bottom"><span><Layers3 size={15} /> {chapter.kanji.length} characters</span><span className="circle-arrow"><ArrowUpRight size={18} /></span></span></Link>
    </div>
    <Link className="back-link" href="/"><ArrowLeft size={14} /> Back to all chapters</Link>
  </main>;
}

export function SubjectExperience({ chapter, subject }: { chapter: Chapter; subject: "vocabulary" | "kanji" }) {
  const vocabulary = subject === "vocabulary";
  const count = vocabulary ? chapter.vocabulary.length : chapter.kanji.reduce((sum, item) => sum + item.examples.length, 0);
  const subjectName = vocabulary ? "Vocabulary" : "Kanji";
  return <main className="chapter-page wrap">
    <div className="crumbs"><Link href="/">COLLECTION</Link><span>/</span><Link href={`/chapter/${chapter.id}`}>CHAPTER {chapter.id}</Link><span>/</span><span>{subjectName.toUpperCase()}</span></div>
    <section className="subject-hero"><div><p className="eyebrow"><span className="eyebrow-line" />CHAPTER {chapter.id} · {vocabulary ? "ことば" : "漢字"}</p><h1>{subjectName}<br /><em>{vocabulary ? "A living vocabulary." : "Read beyond the mark."}</em></h1><p>{vocabulary ? "Choose how you want to meet these words today." : "Explore readings through the words each character makes."}</p></div><div className="subject-hero-count">{String(count).padStart(2, "0")}<span>STUDY CARDS</span></div></section>
    <div className="mode-grid">
      <ModeCard href={`/chapter/${chapter.id}/study/${subject}/learn`} num="01" title="Learn" japanese="学ぶ" description={vocabulary ? "Browse, search, and listen to the chapter words." : "Explore characters, readings, and their examples."} count={`${count} cards`} />
      <ModeCard href={`/chapter/${chapter.id}/study/${subject}/flashcards`} num="02" title="Flashcards" japanese="カード" description="Recall first, reveal when you’re ready. Move at your own pace." count="SELF-PACED" />
      <ModeCard href={`/chapter/${chapter.id}/study/${subject}/quiz`} num="03" title="Reading quiz" japanese="読み方" description={vocabulary ? "Recall the Japanese word or its English meaning, depending on your chosen quiz direction." : "Enter each reading in Hiragana or Katakana; romaji converts as you type. Then enter its English meaning."} count="TYPE TO RECALL" />
    </div>
    <Link className="back-link" href={`/chapter/${chapter.id}`}><ArrowLeft size={14} /> Back to chapter</Link>
  </main>;
}

function ModeCard({ href, num, title, japanese, description, count }: { href: string; num: string; title: string; japanese: string; description: string; count: string }) {
  return <Link href={href} className="mode-card"><div className="mode-card-top"><span>{num} / STUDY MODE</span><ArrowUpRight size={16} /></div><span className="mode-jp">{japanese}</span><h2>{title}</h2><p>{description}</p><div className="mode-card-bottom"><span>{count}</span><ArrowRight size={15} /></div></Link>;
}
