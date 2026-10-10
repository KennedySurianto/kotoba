import { expect, test } from "@playwright/test";
import { matchesReading, normalizeReading, romaji } from "../src/lib/japanese";

test("normalizes compatibility forms and Katakana to Hiragana", () => {
  expect(normalizeReading("　カタカナ　")).toBe("かたかな");
  expect(matchesReading("　カタカナ　", ["かたかな"])).toBe(true);
  expect(matchesReading("か たかな", ["かたかな"])).toBe(false);
});

test("accepts explicit alternative readings and rejects unconfigured readings", () => {
  expect(matchesReading("いちにち", ["ついたち", "いちにち"])).toBe(true);
  expect(matchesReading("ついたち", ["ついたち", "いちにち"])).toBe(true);
  expect(matchesReading("いっちにち", ["いちにち"])).toBe(false);
});

test("keeps small kana, gemination, and vowel length significant", () => {
  expect(matchesReading("きようび", ["きょうび"])).toBe(false);
  expect(matchesReading("きょおび", ["きょうび"])).toBe(false);
  expect(matchesReading("かった", ["かた"])).toBe(false);
  expect(matchesReading("かた", ["かった"])).toBe(false);
});

test("converts readings to romaji for answer feedback", () => {
  expect(romaji("きょう")).toBe("kyou");
});
