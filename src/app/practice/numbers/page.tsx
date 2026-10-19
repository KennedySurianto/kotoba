import type { Metadata } from "next";
import { NumbersPractice } from "@/components/study/numbers-practice";

export const metadata: Metadata = {
  title: "Numbers & Everyday Japanese — Kotoba",
  description: "Practice Japanese numbers, prices, ages, dates, time, and weekdays.",
};

export default function NumbersPracticePage() {
  return <NumbersPractice />;
}
