export type NumbersPracticeCategoryId = "prices" | "ages" | "years" | "months" | "dates" | "time" | "weekdays";

export type NumbersPracticeQuestion = {
  id: string;
  category: NumbersPracticeCategoryId;
  prompt: string;
  reading: string;
  acceptedReadings?: string[];
  promptParts?: { text: string; reading?: string }[];
};

export const numbersPracticeCategories: { id: NumbersPracticeCategoryId; title: string; japanese: string; japaneseParts: { text: string; reading?: string }[]; description: string }[] = [
  { id: "prices", title: "Numbers & prices", japanese: "数字・円", japaneseParts: [{ text: "数", reading: "すう" }, { text: "字", reading: "じ" }, { text: "・" }, { text: "円", reading: "えん" }], description: "Say randomly generated amounts in yen." },
  { id: "ages", title: "Age", japanese: "年齢", japaneseParts: [{ text: "年", reading: "ねん" }, { text: "齢", reading: "れい" }], description: "Practice age counters and their irregular readings." },
  { id: "years", title: "Years", japanese: "年", japaneseParts: [{ text: "年", reading: "ねん" }], description: "Read randomly generated calendar years." },
  { id: "months", title: "Months", japanese: "月", japaneseParts: [{ text: "月", reading: "がつ" }], description: "Name randomly selected months." },
  { id: "dates", title: "Dates", japanese: "日", japaneseParts: [{ text: "日", reading: "にち" }], description: "Practice randomly selected days of the month." },
  { id: "time", title: "Time", japanese: "時刻", japaneseParts: [{ text: "時", reading: "じ" }, { text: "刻", reading: "こく" }], description: "Read random times with 午前 and 午後." },
  { id: "weekdays", title: "Days of the week", japanese: "曜日", japaneseParts: [{ text: "曜", reading: "よう" }, { text: "日", reading: "び" }], description: "Review all seven weekdays in random order." },
];

const MONTH_READINGS = ["いち", "に", "さん", "し", "ご", "ろく", "しち", "はち", "く", "じゅう", "じゅういち", "じゅうに"];
const DATE_READINGS = ["ついたち", "ふつか", "みっか", "よっか", "いつか", "むいか", "なのか", "ようか", "ここのか", "とおか", "じゅういちにち", "じゅうににち", "じゅうさんにち", "じゅうよっか", "じゅうごにち", "じゅうろくにち", "じゅうしちにち", "じゅうはちにち", "じゅうくにち", "はつか", "にじゅういちにち", "にじゅうににち", "にじゅうさんにち", "にじゅうよっか", "にじゅうごにち", "にじゅうろくにち", "にじゅうしちにち", "にじゅうはちにち", "にじゅうくにち", "さんじゅうにち", "さんじゅういちにち"];
const WEEKDAYS = [
  { id: "mon", prompt: "月曜日", reading: "げつようび" },
  { id: "tue", prompt: "火曜日", reading: "かようび" },
  { id: "wed", prompt: "水曜日", reading: "すいようび" },
  { id: "thu", prompt: "木曜日", reading: "もくようび" },
  { id: "fri", prompt: "金曜日", reading: "きんようび" },
  { id: "sat", prompt: "土曜日", reading: "どようび" },
  { id: "sun", prompt: "日曜日", reading: "にちようび" },
];

const DIGITS = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];

function underTenThousand(value: number) {
  let rest = value;
  let result = "";
  const thousands = Math.floor(rest / 1000);
  if (thousands) {
    result += thousands === 1 ? "せん" : thousands === 3 ? "さんぜん" : thousands === 8 ? "はっせん" : `${DIGITS[thousands]}せん`;
    rest %= 1000;
  }
  const hundreds = Math.floor(rest / 100);
  if (hundreds) {
    result += hundreds === 3 ? "さんびゃく" : hundreds === 6 ? "ろっぴゃく" : hundreds === 8 ? "はっぴゃく" : `${DIGITS[hundreds]}ひゃく`;
    rest %= 100;
  }
  const tens = Math.floor(rest / 10);
  if (tens) result += tens === 1 ? "じゅう" : `${DIGITS[tens]}じゅう`;
  const ones = rest % 10;
  if (ones) result += DIGITS[ones];
  return result;
}

function numberReading(value: number) {
  const tenThousands = Math.floor(value / 10000);
  const remainder = value % 10000;
  if (!tenThousands) return underTenThousand(value);
  return `${underTenThousand(tenThousands)}まん${remainder ? underTenThousand(remainder) : ""}`;
}

function ageReading(age: number) {
  if (age === 20) return { reading: "はたち", acceptedReadings: ["にじゅっさい", "にじっさい"] };
  let stem = numberReading(age);
  if (age === 10) stem = "じゅっ";
  else if (age % 10 === 0) stem = stem.replace(/じゅう$/, "じゅっ");
  else if (age % 10 === 1) stem = stem.replace(/いち$/, "いっ");
  else if (age % 10 === 8) stem = stem.replace(/はち$/, "はっ");
  const reading = `${stem}さい`;
  const acceptedReadings = age % 10 === 0 && age >= 30 ? [reading.replace("じゅっさい", "じっさい")] : age === 10 ? ["じっさい"] : [];
  return { reading, acceptedReadings };
}

function randomInteger(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickUnique<T>(values: T[], count: number) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = randomInteger(0, index);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result.slice(0, count);
}

function randomQuestions(category: NumbersPracticeCategoryId): NumbersPracticeQuestion[] {
  if (category === "prices") {
    return pickUnique(Array.from({ length: 999 }, (_, index) => (index + 1) * 100), 10).map((price) => ({
      id: `price-${price}`, category, prompt: `¥${price.toLocaleString("en-US")}`, reading: `${numberReading(price)}えん`, acceptedReadings: numberReading(price).startsWith("せん") ? [`いち${numberReading(price)}えん`] : [],
    }));
  }
  if (category === "ages") {
    return pickUnique(Array.from({ length: 99 }, (_, index) => index + 1), 10).map((age) => {
      const answer = ageReading(age);
      return { id: `age-${age}`, category, prompt: `${age}歳`, ...answer, promptParts: age === 20 ? undefined : [{ text: String(age) }, { text: "歳", reading: "さい" }] };
    });
  }
  if (category === "years") {
    return pickUnique(Array.from({ length: 66 }, (_, index) => index + 1980), 10).map((year) => {
      const cardinal = numberReading(year);
      const acceptedReadings = [
        ...(cardinal.endsWith("よん") ? [`${cardinal.slice(0, -2)}よねん`] : []),
        ...(cardinal.startsWith("せん") ? [`いち${cardinal}ねん`] : []),
      ];
      return { id: `year-${year}`, category, prompt: `${year}年`, reading: `${cardinal}ねん`, acceptedReadings, promptParts: [{ text: String(year) }, { text: "年", reading: "ねん" }] };
    });
  }
  if (category === "months") {
    return pickUnique(Array.from({ length: 12 }, (_, index) => index + 1), 8).map((month) => ({
      id: `month-${month}`, category, prompt: `${month}月`, reading: `${MONTH_READINGS[month - 1]}がつ`, promptParts: [{ text: String(month) }, { text: "月", reading: "がつ" }],
    }));
  }
  if (category === "dates") {
    return pickUnique(Array.from({ length: 31 }, (_, index) => index + 1), 10).map((date) => ({
      id: `date-${date}`, category, prompt: `${date}日`, reading: DATE_READINGS[date - 1],
    }));
  }
  if (category === "time") {
    const times = Array.from({ length: 12 * 59 * 2 }, (_, index) => {
      const minuteIndex = index % 59 + 1;
      const hourIndex = Math.floor(index / 59) % 12 + 1;
      const afternoon = Math.floor(index / (59 * 12)) === 1;
      return { hour: hourIndex, minute: minuteIndex, afternoon };
    });
    return pickUnique(times, 10).map(({ hour, minute, afternoon }) => {
      const hourReading = hour === 4 ? "よじ" : hour === 7 ? "しちじ" : hour === 9 ? "くじ" : `${numberReading(hour)}じ`;
      const minuteBase = numberReading(minute);
      const minuteReading = minute % 10 === 0 ? `${minuteBase.replace(/じゅう$/, "じゅっ")}ぷん` : minute % 10 === 1 ? `${minuteBase.replace(/いち$/, "いっ")}ぷん` : minute % 10 === 3 ? `${minuteBase}ぷん` : minute % 10 === 4 ? `${minuteBase}ぷん` : minute % 10 === 6 ? `${minuteBase.replace(/ろく$/, "ろっ")}ぷん` : minute % 10 === 8 ? `${minuteBase.replace(/はち$/, "はっ")}ぷん` : `${minuteBase}ふん`;
      const prefix = afternoon ? "ごご" : "ごぜん";
      const reading = `${prefix}${hourReading}${minuteReading}`;
      const minuteAlternatives = minute % 10 === 0 ? [`${prefix}${hourReading}${minuteBase.replace(/じゅう$/, "じっ")}ぷん`] : [];
      return {
        id: `time-${afternoon ? "pm" : "am"}-${hour}-${minute}`,
        category,
        prompt: `${afternoon ? "午後" : "午前"} ${hour}:${String(minute).padStart(2, "0")}`,
        reading,
        acceptedReadings: minuteAlternatives,
        promptParts: afternoon ? [{ text: "午", reading: "ご" }, { text: "後", reading: "ご" }, { text: ` ${hour}:${String(minute).padStart(2, "0")}` }] : [{ text: "午", reading: "ご" }, { text: "前", reading: "ぜん" }, { text: ` ${hour}:${String(minute).padStart(2, "0")}` }],
      };
    });
  }
  return pickUnique(WEEKDAYS, WEEKDAYS.length).map(({ id, prompt, reading }) => ({ id: `weekday-${id}`, category, prompt, reading }));
}

export function getNumbersPracticeQuestionCount(categoryIds: NumbersPracticeCategoryId[]) {
  return categoryIds.reduce((count, category) => count + (category === "months" ? 8 : category === "weekdays" ? 7 : 10), 0);
}

export function generateNumbersPracticeQuestions(categoryIds: NumbersPracticeCategoryId[]) {
  return categoryIds.flatMap((category) => randomQuestions(category));
}
