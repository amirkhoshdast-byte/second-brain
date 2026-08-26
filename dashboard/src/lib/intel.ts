/**
 * لایه‌ی مشترک «هوشمندی موجودیت».
 *
 * قاعده‌ی محوری: سنجه‌ی گیج برای هر نوع موجودیت معنای متفاوتی دارد. یک عدد
 * واحد برای کشور و گزارش و سیگنال، عدد بی‌معناست — «۷۸٪» برای یک کشور یعنی
 * پوشش اطلاعاتی، برای یک گزارش یعنی ارزش اطلاعاتی، و برای یک ریسک یعنی شدت.
 * این فایل همان نگاشت را در یک جا نگه می‌دارد تا کارت و داشبورد از یک منبع
 * بخوانند و با هم واگرا نشوند.
 */

import { T } from "@/lib/theme";

export type IntelType =
  | "country" | "region" | "topic" | "report" | "person"
  | "org" | "event" | "signal" | "risk" | "opportunity"
  | "mission" | "source" | "trend" | "insight";

/** یک بُعد فرعی زیر گیج — سه‌تایی زیر هر سنجه */
export type Facet = { label: string; value: number; tone: string };

export type EntityIntel = {
  /** عنوان سنجه‌ی اصلی — با نوع عوض می‌شود */
  metricLabel: string;
  /** مقدار گیج، ۰ تا ۱۰۰ */
  value: number;
  /** واحد نمایش کنار عدد */
  unit: string;
  facets: Facet[];
  /** جفت‌های شاخص زیر گیج */
  metrics: Array<[string, string]>;
  confidence: number;
  trend: "up" | "down" | "flat";
};

export const typeFa: Record<IntelType, string> = {
  country: "کشور", region: "منطقه", topic: "موضوع", report: "گزارش",
  person: "شخص", org: "سازمان", event: "رویداد", signal: "سیگنال",
  risk: "ریسک", opportunity: "فرصت", mission: "نمایندگی فرهنگی",
  source: "منبع", trend: "روند", insight: "بینش هوشمند",
};

/** عنوان سنجه‌ی هر نوع — مرجع واحد، تا در کارت و داشبورد یکی باشد */
export const metricOf: Record<IntelType, string> = {
  country:     "شاخص هوشمندی کشور",
  region:      "شاخص پویایی منطقه",
  topic:       "قدرت روند",
  report:      "ارزش اطلاعاتی",
  person:      "اهمیت راهبردی",
  org:         "اهمیت راهبردی",
  event:       "میزان اثرگذاری",
  signal:      "سطح اطمینان",
  risk:        "شدت ریسک",
  opportunity: "ظرفیت فرصت",
  mission:     "شاخص فعالیت نمایندگی",
  source:      "اعتبار منبع",
  trend:       "قدرت روند",
  insight:     "استحکام بینش",
};

/** سه بُعد فرعی هر نوع، با تُن معنایی خودشان */
const facetSpec: Record<IntelType, Array<[string, string]>> = {
  country:     [["پوشش اطلاعاتی", T.mint], ["فرصت", T.ok], ["ریسک", T.bad]],
  region:      [["فعالیت", T.mint], ["فرصت", T.ok], ["ریسک", T.bad]],
  topic:       [["رشد", T.ok], ["ثبات", T.mint], ["ریسک", T.bad]],
  report:      [["ارتباط", T.mint], ["اطمینان", T.sky], ["تازگی", T.ok]],
  person:      [["نفوذ", T.mint], ["ارتباط", T.sky], ["اتصال شبکه‌ای", T.lavender]],
  org:         [["نفوذ", T.mint], ["فعالیت", T.sky], ["ارتباط", T.lavender]],
  event:       [["اثر", T.mint], ["دامنه", T.sky], ["ارتباط", T.lavender]],
  signal:      [["اثر", T.mint], ["فوریت", T.warn], ["روند", T.lavender]],
  risk:        [["احتمال", T.warn], ["اثر", T.bad], ["فوریت", T.warn]],
  opportunity: [["ظرفیت", T.ok], ["اطمینان", T.mint], ["زمان‌بندی", T.sky]],
  mission:     [["فعالیت", T.mint], ["پوشش", T.sky], ["تازگی", T.ok]],
  source:      [["اعتبار", T.mint], ["تازگی", T.ok], ["پوشش", T.sky]],
  trend:       [["رشد", T.ok], ["ثبات", T.mint], ["دامنه", T.sky]],
  insight:     [["پشتیبانی", T.mint], ["اطمینان", T.sky], ["تازگی", T.ok]],
};

/** شاخص‌های زیر گیج، بر اساس نوع */
const metricSpec: Record<IntelType, string[]> = {
  country: ["گزارش‌ها", "موضوعات", "اشخاص", "سازمان‌ها", "رویدادها", "سیگنال‌ها"],
  region:  ["کشورها", "گزارش‌ها", "نمایندگی‌ها", "موضوعات", "رویدادها", "سیگنال‌ها"],
  topic:   ["کشورها", "گزارش‌ها", "اشخاص", "سازمان‌ها", "رویدادها", "سیگنال‌ها"],
  report:  ["موضوعات استخراج‌شده", "اشخاص", "سازمان‌ها", "رویدادها", "سیگنال‌ها", "سطح اطمینان"],
  person:  ["گزارش‌ها", "سازمان‌ها", "رویدادها", "موضوعات", "کشورها", "اشاره‌ها"],
  org:     ["گزارش‌ها", "اشخاص", "رویدادها", "موضوعات", "کشورها", "اشاره‌ها"],
  event:   ["گزارش‌ها", "اشخاص", "سازمان‌ها", "کشورها", "موضوعات", "پوشش رسانه‌ای"],
  signal:  ["گزارش پشتیبان", "کشورها", "موضوع", "تغییر مشاهده‌شده", "پنجره زمانی", "اطمینان"],
  risk:    ["گزارش پشتیبان", "کشورها", "روند مرتبط", "پنجره زمانی", "اثر برآوردی", "اطمینان"],
  opportunity: ["گزارش پشتیبان", "کشورها", "موضوع", "پنجره اقدام", "ظرفیت برآوردی", "اطمینان"],
  mission: ["گزارش‌ها", "موضوعات", "رویدادها", "اشخاص", "سازمان‌ها", "سیگنال‌ها"],
  source:  ["گزارش‌ها", "کشورها", "موضوعات", "تازگی", "پوشش", "اعتبار"],
  trend:   ["گزارش پشتیبان", "کشورها", "موضوع", "پنجره زمانی", "شیب", "اطمینان"],
  insight: ["گزارش منبع", "کشورها", "موضوعات", "سیگنال مرتبط", "پنجره زمانی", "اطمینان"],
};

export function facetsFor(type: IntelType, values: [number, number, number]): Facet[] {
  return facetSpec[type].map(([label, tone], i) => ({ label, tone, value: values[i] }));
}

export function metricLabelsFor(type: IntelType): string[] {
  return metricSpec[type];
}

/**
 * داده‌ی نمونه.
 *
 * این اعداد ساختگی‌اند و جای خروجی خط لوله‌ی استخراج را نگه می‌دارند؛ آن خط
 * لوله هنوز ساخته نشده. تنها عددی که به داده‌ی واقعی وصل می‌شود شمار اسناد
 * نمایه‌شده است که داشبورد آن را از API می‌گیرد. هر جا این داده جای خروجی
 * واقعی را بگیرد، باید همین‌جا حذف شود نه اینکه کنارش بماند.
 */
export const SAMPLE: Record<string, EntityIntel> = {
  indonesia: {
    metricLabel: metricOf.country, value: 78, unit: "٪",
    facets: facetsFor("country", [78, 64, 31]),
    metrics: [["۴۲", "گزارش"], ["۹", "موضوع"], ["۱۷", "شخص"], ["۱۱", "سازمان"], ["۵", "رویداد"], ["۳", "سیگنال"]],
    confidence: 86, trend: "up",
  },
  "region-sea": {
    metricLabel: metricOf.region, value: 71, unit: "٪",
    facets: facetsFor("region", [71, 58, 34]),
    metrics: [["۸", "کشور"], ["۱۳۶", "گزارش"], ["۵", "نمایندگی"], ["۱۴", "موضوع"], ["۱۹", "رویداد"], ["۷", "سیگنال"]],
    confidence: 81, trend: "up",
  },
  "top-farsi": {
    metricLabel: metricOf.topic, value: 84, unit: "٪",
    facets: facetsFor("topic", [84, 62, 27]),
    metrics: [["۶", "کشور"], ["۲۸", "گزارش"], ["۱۲", "شخص"], ["۷", "سازمان"], ["۵", "رویداد"], ["۲", "سیگنال"]],
    confidence: 88, trend: "up",
  },
  "rep-farsi": {
    metricLabel: metricOf.report, value: 91, unit: "٪",
    facets: facetsFor("report", [93, 91, 74]),
    metrics: [["۳", "موضوع"], ["۵", "شخص"], ["۴", "سازمان"], ["۲", "رویداد"], ["۲", "سیگنال"], ["۹۱٪", "اطمینان"]],
    confidence: 91, trend: "flat",
  },
  "per-omar": {
    metricLabel: metricOf.person, value: 66, unit: "٪",
    facets: facetsFor("person", [72, 61, 58]),
    metrics: [["۶", "گزارش"], ["۳", "سازمان"], ["۴", "رویداد"], ["۵", "موضوع"], ["۲", "کشور"], ["۱۸", "اشاره"]],
    confidence: 74, trend: "up",
  },
  "org-unesco": {
    metricLabel: metricOf.org, value: 73, unit: "٪",
    facets: facetsFor("org", [81, 66, 69]),
    metrics: [["۱۹", "گزارش"], ["۸", "شخص"], ["۶", "رویداد"], ["۹", "موضوع"], ["۱۲", "کشور"], ["۴۱", "اشاره"]],
    confidence: 83, trend: "flat",
  },
  "ev-jakarta": {
    metricLabel: metricOf.event, value: 69, unit: "٪",
    facets: facetsFor("event", [74, 68, 61]),
    metrics: [["۵", "گزارش"], ["۹", "شخص"], ["۶", "سازمان"], ["۴", "کشور"], ["۳", "موضوع"], ["بالا", "پوشش"]],
    confidence: 79, trend: "up",
  },
  "ai-sig-univ": {
    metricLabel: metricOf.signal, value: 76, unit: "٪",
    facets: facetsFor("signal", [68, 54, 79]),
    metrics: [["۲", "گزارش"], ["۱", "کشور"], ["همکاری دانشگاهی", "موضوع"], ["‎+۳۱٪", "تغییر"], ["۶ ماه", "پنجره"], ["۷۶٪", "اطمینان"]],
    confidence: 76, trend: "up",
  },
  "ai-risk-cover": {
    metricLabel: metricOf.risk, value: 82, unit: "٪",
    facets: facetsFor("risk", [77, 86, 88]),
    metrics: [["۳", "گزارش"], ["۱", "کشور"], ["۱", "روند"], ["۳ ماه", "پنجره"], ["بالا", "اثر"], ["۸۲٪", "اطمینان"]],
    confidence: 82, trend: "up",
  },
  "ai-opp-univ": {
    metricLabel: metricOf.opportunity, value: 64, unit: "٪",
    facets: facetsFor("opportunity", [64, 71, 52]),
    metrics: [["۲", "گزارش"], ["۱", "کشور"], ["همکاری دانشگاهی", "موضوع"], ["۲ فصل", "پنجره"], ["متوسط", "ظرفیت"], ["۷۱٪", "اطمینان"]],
    confidence: 71, trend: "up",
  },
};

/** وقتی موجودیت ورودی نمونه ندارد، کارت از نوعش یک اسکلت صادق می‌سازد */
export function fallbackIntel(type: IntelType): EntityIntel {
  return {
    metricLabel: metricOf[type], value: 0, unit: "—",
    facets: facetsFor(type, [0, 0, 0]),
    metrics: metricLabelsFor(type).map((m) => ["—", m] as [string, string]),
    confidence: 0, trend: "flat",
  };
}
