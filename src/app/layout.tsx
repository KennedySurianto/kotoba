import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SmoothScroll } from "@/components/layout/smooth-scroll";
import { SoundEffects } from "@/components/layout/sound-effects";

export const metadata: Metadata = {
  title: "Kotoba — Japanese, one word at a time",
  description: "A quiet, thoughtful space to study Japanese vocabulary and kanji.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `try { document.documentElement.dataset.theme = localStorage.getItem("kotoba-theme") === "dark" ? "dark" : "light"; } catch { document.documentElement.dataset.theme = "light"; }` }} /></head><body><SmoothScroll><SoundEffects /><SiteHeader />{children}</SmoothScroll></body></html>;
}
