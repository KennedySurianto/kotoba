"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { SoundToggle } from "@/components/layout/sound-effects";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function SiteHeader() {
  const pathname = usePathname();
  const focus = pathname.includes("/study/");
  return <header className={`site-header ${focus ? "site-header-focus" : ""}`}>
    <Link className="brand" href="/" aria-label="Kotoba home"><span className="brand-mark">言</span><span>KOTOBA<span className="brand-dot">.</span></span></Link>
    <div className="header-tools"><SoundToggle /><ThemeToggle />{!focus && <><nav className="top-nav" aria-label="Main navigation"><Link href="/#chapters">Chapters</Link><Link href="/#method">The method</Link></nav><Link href="/#chapters" className="header-cta">Begin a session <ArrowUpRight size={14} /></Link></>}</div>
  </header>;
}
