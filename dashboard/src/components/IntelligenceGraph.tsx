"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { T } from "@/lib/theme";

/**
 * گراف هوشمند سازمانی — فضای کاوش روابط در مغز دوم.
 *
 * این صفحه مکمل «دستیار هوشمند» است، نه تکرار آن: آنجا پاسخ می‌گیرید، اینجا
 * می‌بینید چه چیزی به چه چیزی وصل است و کجا باید کاوش کنید. به همین دلیل
 * کارت‌های KPI اینجا تکرار نشده‌اند — گراف خودش رابط کاربری است.
 *
 * پیام اصلی محصول: «گزارش‌های سازمانی به هوش بین‌المللی ساختارمند تبدیل می‌شوند.»
 * بنابراین ستون فقرات گراف این است:
 *
 *   منطقه → کشور → نمایندگی → گزارش → (موضوع، شخص، سازمان، رویداد، منبع)
 *   و سپس لایه‌ی استخراج هوش مصنوعی: روند → سیگنال → ریسک/فرصت → بینش
 *
 * ارزش اصلی، هوشِ میان‌گزارشی است: یک بینش از چند گزارش بیرون می‌آید، نه از یکی.
 * زنجیره‌ی اجرا (مسئله → تصمیم → مصوبه → اقدام → پروژه → نتیجه) هنوز هست اما
 * پیش‌فرض خاموش است تا نمای پیش‌فرض را از «دانش و رصد» منحرف نکند.
 */

/** تفکیک بصری دانشِ منبع از هوشِ استخراج‌شده */
type Origin = "source" | "ai";

/** نوع هستان‌شناختی گره — جدا از رده‌ی بصری، تا بازرس بتواند بر اساسش تصمیم بگیرد */
type EType =
  | "country" | "region" | "mission" | "report" | "source"
  | "topic" | "person" | "org" | "event" | "religion"
  | "trend" | "signal" | "risk" | "opportunity" | "insight"
  | "issue" | "decision" | "directive" | "action" | "project" | "result";

/** رده‌ی بصری: اندازه و وزن گره. گزارش عمداً رده‌ی خودش را دارد چون شهروند درجه‌یک است. */
type Kind = "center" | "primary" | "report" | "entity";

type Tone = "teal" | "gold" | "blue" | "ai" | "risk" | "done";
type System = "knowledge" | "execution";

type GNode = {
  id: string;
  label: string;
  kind: Kind;
  etype: EType;
  origin: Origin;
  tone: Tone;
  /** خوشه‌ی والد — برای فیلتر و نمایش زمینه در نوار فرمان */
  cluster?: string;
  x: number;
  y: number;
};

type GEdge = {
  from: string;
  to: string;
  system: System;
  /** برچسب رابطه — در بازرس و راهنمای هاور دیده می‌شود */
  rel: string;
  strong?: boolean;
};

const toneColor: Record<Tone, string> = {
  teal: T.mint,      // گزارش و منبع — دانش خام
  gold: T.gold,      // مرکز و انتخاب
  blue: T.sky,       // موجودیت استخراج‌شده از گزارش
  ai: T.lavender,    // هوش استخراجی
  risk: T.bad,
  done: T.ok,
};

/** برچسب فارسی هر نوع، برای بازرس */
const typeLabel: Record<EType, string> = {
  country: "کشور", region: "منطقه", mission: "نمایندگی فرهنگی",
  report: "گزارش", source: "منبع", topic: "موضوع", person: "شخص",
  org: "سازمان", event: "رویداد", religion: "دین / جریان فرهنگی",
  trend: "روند", signal: "سیگنال", risk: "ریسک", opportunity: "فرصت",
  insight: "بینش هوشمند", issue: "مسئله", decision: "تصمیم",
  directive: "مصوبه / دستور", action: "اقدام", project: "پروژه", result: "نتیجه",
};

// ─── چیدمان ───────────────────────────────────────────────────────────────────
const CX = 500;
const CY = 400;

/** زاویه بر حسب درجه، ساعتگرد از بالا */
function polar(deg: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

type Spec = {
  id: string; label: string; etype: EType; origin?: Origin;
  kind?: Kind; tone?: Tone; cluster?: string; deg: number; r: number;
};

/**
 * چیدمان روایت‌محور است نه تصادفی: زمینه‌ی ساختاری بالا، گزارش‌ها در کمان راست،
 * موجودیت‌های استخراج‌شده بیرون آن‌ها، و هوش استخراجی در کمان چپ جدا می‌نشیند
 * تا تفکیک «دانش منبع» از «استنتاج AI» در نگاه اول دیده شود.
 */
const SPECS: Spec[] = [
  // ── زمینه‌ی ساختاری ──
  { id: "region-sea",  label: "جنوب شرق آسیا",              etype: "region",  kind: "primary", tone: "blue", deg: 342, r: 178 },
  { id: "mission-jkt", label: "رایزنی فرهنگی ایران، جاکارتا", etype: "mission", kind: "primary", tone: "blue", deg: 200, r: 168 },
  { id: "src-icro",    label: "پایگاه جامعه و فرهنگ ملل",    etype: "source",  kind: "primary", tone: "teal", deg: 258, r: 186 },

  // ── گزارش‌ها: شهروند درجه‌یک، کمان بالا-راست ──
  { id: "rep-farsi", label: "گزارش وضعیت زبان فارسی",  etype: "report", kind: "report", tone: "teal", cluster: "گزارش‌ها", deg: 22,  r: 232 },
  { id: "rep-univ",  label: "گزارش دانشگاه‌های اندونزی", etype: "report", kind: "report", tone: "teal", cluster: "گزارش‌ها", deg: 56,  r: 240 },
  { id: "rep-cult",  label: "گزارش تحولات فرهنگی",     etype: "report", kind: "report", tone: "teal", cluster: "گزارش‌ها", deg: 90,  r: 232 },
  { id: "rep-faith", label: "گزارش گفت‌وگوی ادیان",     etype: "report", kind: "report", tone: "teal", cluster: "گزارش‌ها", deg: 124, r: 238 },

  // ── موضوعات استخراج‌شده ──
  { id: "top-farsi",  label: "زبان فارسی",       etype: "topic", tone: "blue", cluster: "موضوعات", deg: 8,   r: 352 },
  { id: "top-univ",   label: "همکاری دانشگاهی",  etype: "topic", tone: "blue", cluster: "موضوعات", deg: 44,  r: 366 },
  { id: "top-culdip", label: "دیپلماسی فرهنگی",  etype: "topic", tone: "blue", cluster: "موضوعات", deg: 96,  r: 358 },
  { id: "top-faith",  label: "گفت‌وگوی ادیان",   etype: "topic", tone: "blue", cluster: "موضوعات", deg: 132, r: 356 },

  // ── اشخاص و سازمان‌های استخراج‌شده ──
  { id: "per-omar",  label: "نصرالدین عمر",            etype: "person", tone: "blue", cluster: "اشخاص",     deg: 116, r: 424 },
  { id: "per-rayzan", label: "رایزن فرهنگی جاکارتا",   etype: "person", tone: "blue", cluster: "اشخاص",     deg: 176, r: 300 },
  { id: "org-religion", label: "وزارت امور دینی اندونزی", etype: "org", tone: "blue", cluster: "سازمان‌ها", deg: 146, r: 420 },
  { id: "org-univ-jkt", label: "دانشگاه اسلامی جاکارتا",  etype: "org", tone: "blue", cluster: "سازمان‌ها", deg: 62,  r: 436 },
  { id: "org-unesco",   label: "یونسکو",                 etype: "org", tone: "blue", cluster: "سازمان‌ها", deg: 30,  r: 430 },

  // ── رویدادها ──
  { id: "ev-week",    label: "هفته فرهنگی جاکارتا", etype: "event", tone: "blue", cluster: "رویدادها", deg: 158, r: 356 },
  { id: "ev-jakarta", label: "بیانیه جاکارتا",      etype: "event", tone: "blue", cluster: "رویدادها", deg: 78,  r: 440 },

  // ── لایه‌ی هوش استخراجی: کمان چپ، جدا از دانش منبع ──
  { id: "ai-trend-farsi", label: "افزایش تقاضای آموزش زبان فارسی", etype: "trend",       origin: "ai", tone: "ai",   cluster: "هوش استخراجی", deg: 236, r: 320 },
  { id: "ai-sig-univ",    label: "سیگنال رشد تعامل دانشگاهی",      etype: "signal",      origin: "ai", tone: "ai",   cluster: "هوش استخراجی", deg: 272, r: 330 },
  { id: "ai-opp-univ",    label: "فرصت همکاری دانشگاهی",           etype: "opportunity", origin: "ai", tone: "done", cluster: "هوش استخراجی", deg: 300, r: 300 },
  { id: "ai-risk-cover",  label: "ریسک کاهش پوشش آموزشی",          etype: "risk",        origin: "ai", tone: "risk", cluster: "هوش استخراجی", deg: 214, r: 320 },
  { id: "ai-ins-partner", label: "کاهش فعالیت شریک محلی",          etype: "insight",     origin: "ai", tone: "ai",   cluster: "هوش استخراجی", deg: 320, r: 296 },

  // ── زنجیره‌ی اجرا: پیش‌فرض خاموش ──
  { id: "ex-issue", label: "توسعه زبان فارسی در اندونزی", etype: "issue",     tone: "gold", cluster: "اجرا", deg: 188, r: 430 },
  { id: "ex-dec",   label: "مصوبه کرسی زبان فارسی",       etype: "directive", tone: "gold", cluster: "اجرا", deg: 206, r: 452 },
  { id: "ex-prj",   label: "کرسی‌های زبان فارسی",         etype: "project",   tone: "gold", cluster: "اجرا", deg: 228, r: 462 },
  { id: "ex-res",   label: "راه‌اندازی ۳ کرسی",           etype: "result",    tone: "done", cluster: "اجرا", deg: 250, r: 452 },
];

const NODES: GNode[] = [
  {
    id: "indonesia", label: "اندونزی", kind: "center", etype: "country",
    origin: "source", tone: "gold", x: CX, y: CY,
  },
  ...SPECS.map((s): GNode => {
    const p = polar(s.deg, s.r);
    return {
      id: s.id, label: s.label, kind: s.kind ?? "entity", etype: s.etype,
      origin: s.origin ?? "source", tone: s.tone ?? "blue",
      cluster: s.cluster, x: p.x, y: p.y,
    };
  }),
];

const EDGES: GEdge[] = [
  // زمینه‌ی ساختاری
  { from: "region-sea",  to: "indonesia",   system: "knowledge", rel: "شامل",           strong: true },
  { from: "mission-jkt", to: "indonesia",   system: "knowledge", rel: "نمایندگی در",    strong: true },

  // گزارش ← تولیدشده توسط → نمایندگی
  { from: "rep-farsi", to: "mission-jkt", system: "knowledge", rel: "تولیدشده توسط", strong: true },
  { from: "rep-univ",  to: "mission-jkt", system: "knowledge", rel: "تولیدشده توسط" },
  { from: "rep-cult",  to: "mission-jkt", system: "knowledge", rel: "تولیدشده توسط" },
  { from: "rep-faith", to: "mission-jkt", system: "knowledge", rel: "تولیدشده توسط" },

  // گزارش ← درباره → کشور
  { from: "rep-farsi", to: "indonesia", system: "knowledge", rel: "درباره", strong: true },
  { from: "rep-univ",  to: "indonesia", system: "knowledge", rel: "درباره", strong: true },
  { from: "rep-cult",  to: "indonesia", system: "knowledge", rel: "درباره" },
  { from: "rep-faith", to: "indonesia", system: "knowledge", rel: "درباره" },

  // گزارش ← منتشرشده در → منبع
  { from: "rep-cult",  to: "src-icro", system: "knowledge", rel: "منتشرشده در" },
  { from: "rep-faith", to: "src-icro", system: "knowledge", rel: "منتشرشده در" },

  // گزارش ← شامل → موضوع
  { from: "rep-farsi", to: "top-farsi",  system: "knowledge", rel: "شامل موضوع", strong: true },
  { from: "rep-univ",  to: "top-univ",   system: "knowledge", rel: "شامل موضوع", strong: true },
  { from: "rep-univ",  to: "top-farsi",  system: "knowledge", rel: "شامل موضوع" },
  { from: "rep-cult",  to: "top-culdip", system: "knowledge", rel: "شامل موضوع", strong: true },
  { from: "rep-faith", to: "top-faith",  system: "knowledge", rel: "شامل موضوع", strong: true },
  { from: "rep-faith", to: "top-culdip", system: "knowledge", rel: "شامل موضوع" },

  // گزارش ← اشاره به → شخص / سازمان
  { from: "rep-faith", to: "per-omar",     system: "knowledge", rel: "اشاره به" },
  { from: "rep-faith", to: "org-religion", system: "knowledge", rel: "اشاره به" },
  { from: "rep-univ",  to: "org-univ-jkt", system: "knowledge", rel: "اشاره به" },
  { from: "rep-cult",  to: "org-unesco",   system: "knowledge", rel: "اشاره به" },
  { from: "rep-farsi", to: "per-rayzan",   system: "knowledge", rel: "اشاره به" },

  // گزارش ← ثبت می‌کند → رویداد
  { from: "rep-cult",  to: "ev-week",    system: "knowledge", rel: "ثبت می‌کند" },
  { from: "rep-faith", to: "ev-jakarta", system: "knowledge", rel: "ثبت می‌کند" },

  // پیوند موجودیت‌ها
  { from: "per-omar",   to: "org-religion", system: "knowledge", rel: "وابسته به" },
  { from: "top-culdip", to: "org-unesco",   system: "knowledge", rel: "مرتبط با" },
  { from: "per-rayzan", to: "mission-jkt",  system: "knowledge", rel: "مسئول" },

  // ── لایه‌ی AI: چند گزارش ← نشان می‌دهند → روند ──
  { from: "rep-farsi", to: "ai-trend-farsi", system: "knowledge", rel: "نشان می‌دهد", strong: true },
  { from: "rep-univ",  to: "ai-trend-farsi", system: "knowledge", rel: "نشان می‌دهد", strong: true },

  // روند ← ایجاد می‌کند → سیگنال
  { from: "ai-trend-farsi", to: "ai-sig-univ", system: "knowledge", rel: "ایجاد می‌کند", strong: true },
  { from: "rep-univ",       to: "ai-sig-univ", system: "knowledge", rel: "پشتیبانی می‌کند" },

  // سیگنال ← نشان‌دهنده → فرصت / ریسک
  { from: "ai-sig-univ",    to: "ai-opp-univ",   system: "knowledge", rel: "نشان‌دهنده", strong: true },
  { from: "ai-trend-farsi", to: "ai-risk-cover", system: "knowledge", rel: "نشان‌دهنده", strong: true },

  // بینش ← استخراج‌شده از → چند گزارش
  { from: "rep-cult",  to: "ai-ins-partner", system: "knowledge", rel: "استخراج‌شده از" },
  { from: "rep-faith", to: "ai-ins-partner", system: "knowledge", rel: "استخراج‌شده از" },
  { from: "ai-ins-partner", to: "ai-risk-cover", system: "knowledge", rel: "تقویت می‌کند" },

  // اتصال هوش به موضوع
  { from: "ai-opp-univ", to: "top-univ", system: "knowledge", rel: "درباره" },

  // ── زنجیره‌ی اجرا ──
  { from: "ai-risk-cover", to: "ex-issue", system: "execution", rel: "منجر می‌شود به", strong: true },
  { from: "ex-issue", to: "ex-dec", system: "execution", rel: "تصمیم",  strong: true },
  { from: "ex-dec",   to: "ex-prj", system: "execution", rel: "اقدام",  strong: true },
  { from: "ex-prj",   to: "ex-res", system: "execution", rel: "نتیجه" },
  { from: "ex-prj",   to: "per-rayzan", system: "execution", rel: "مسئول" },
];

/** گزارش‌ها بزرگ‌تر از موجودیت‌های استخراج‌شده دیده می‌شوند */
function radiusOf(n: GNode) {
  return n.kind === "center" ? 34 : n.kind === "report" ? 13 : n.kind === "primary" ? 15 : 8.5;
}

/** کمان ملایم بین دو گره تا خطوط روی هم نیفتند */
function curve(a: GNode, b: GNode) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(30, len * 0.13);
  // عمود بر خط، برای انحنای یکنواخت
  const nx = -dy / len;
  const ny = dx / len;
  return `M ${a.x} ${a.y} Q ${mx + nx * bow} ${my + ny * bow} ${b.x} ${b.y}`;
}

/** خوشه‌های قابل فیلتر — جای دامنه‌های قبلی */
const CLUSTERS: Array<{ id: string; label: string; tone: Tone }> = [
  { id: "گزارش‌ها",     label: "گزارش‌ها",      tone: "teal" },
  { id: "موضوعات",      label: "موضوعات",       tone: "blue" },
  { id: "اشخاص",        label: "اشخاص",         tone: "blue" },
  { id: "سازمان‌ها",    label: "سازمان‌ها",     tone: "blue" },
  { id: "رویدادها",     label: "رویدادها",      tone: "blue" },
  { id: "هوش استخراجی", label: "هوش استخراجی",  tone: "ai" },
  { id: "اجرا",         label: "زنجیره اجرا",   tone: "gold" },
];

// ─── جزئیات پنل بازرسی ────────────────────────────────────────────────────────
type InspectorData = {
  status: string;
  priority: string;
  stats: Array<[string, string]>;
  ai: { summary: string; opportunity: string; risk: string; action: string };
};

/**
 * محتوای بازرس بر اساس نوع موجودیت فرق می‌کند — کشور، گزارش، موضوع و سیگنال
 * هرکدام سؤال متفاوتی در ذهن کاربر می‌سازند.
 */
const INSPECTOR: Record<string, InspectorData> = {
  indonesia: {
    status: "تحت رصد", priority: "بالا",
    stats: [
      ["گزارش ثبت‌شده", "۴۲"], ["موضوع فعال", "۹"],
      ["شخص کلیدی", "۱۷"], ["سازمان مرتبط", "۱۱"],
      ["سیگنال باز", "۳"], ["ریسک فعال", "۱"],
    ],
    ai: {
      summary: "چهار گزارش نمایندگی جاکارتا در شش ماه گذشته روی سه محور متمرکزند: زبان فارسی، همکاری دانشگاهی و گفت‌وگوی ادیان. تراکم ارجاع به نهادهای دانشگاهی نسبت به دوره‌ی قبل بیشتر شده.",
      opportunity: "هم‌زمانی رشد تقاضای زبان فارسی با گشایش دانشگاهی، پنجره‌ی کوتاهی برای تثبیت همکاری رسمی می‌سازد.",
      risk: "پوشش آموزشی به یک شریک محلی وابسته است که فعالیتش در دو گزارش اخیر کاهش نشان می‌دهد.",
      action: "تدوین گزارش تجمیعی از چهار سند و طرح آن در جلسه‌ی منطقه‌ای جنوب شرق آسیا.",
    },
  },
  "rep-farsi": {
    status: "تأییدشده", priority: "بالا",
    stats: [
      ["موضوع استخراجی", "۳"], ["شخص استخراجی", "۵"],
      ["سازمان استخراجی", "۴"], ["رویداد ثبت‌شده", "۲"],
      ["سیگنال استخراجی", "۲"], ["سطح اطمینان", "۹۱٪"],
    ],
    ai: {
      summary: "گزارش وضعیت زبان فارسی، رشد ثبت‌نام دوره‌های زبان در سه دانشگاه جاکارتا را ثبت کرده و کمبود مدرس بومی را عامل محدودکننده معرفی می‌کند.",
      opportunity: "دو دانشگاه آمادگی میزبانی کرسی رسمی را اعلام کرده‌اند.",
      risk: "بدون تأمین مدرس، رشد ثبت‌نام به ظرفیت واقعی تبدیل نمی‌شود.",
      action: "تطبیق این گزارش با گزارش دانشگاه‌ها برای برآورد شکاف مدرس.",
    },
  },
  "top-farsi": {
    status: "فعال", priority: "بالا",
    stats: [
      ["کشور مرتبط", "۶"], ["گزارش مرتبط", "۲۸"],
      ["شخص", "۱۲"], ["سازمان", "۷"],
      ["رویداد", "۵"], ["سیگنال مرتبط", "۲"],
    ],
    ai: {
      summary: "زبان فارسی در گزارش‌های اندونزی، تاجیکستان و پاکستان به‌عنوان محور مشترک دیپلماسی فرهنگی تکرار می‌شود؛ روند دوساله صعودی است.",
      opportunity: "الگوی موفق جاکارتا قابل تکرار در دو کشور دیگر منطقه است.",
      risk: "تمرکز بر یک موضوع، پوشش سایر محورهای فرهنگی را کم‌رنگ کرده.",
      action: "مقایسه‌ی روند این موضوع میان سه کشور در یک بینش تجمیعی.",
    },
  },
  "ai-sig-univ": {
    status: "فعال", priority: "متوسط",
    stats: [
      ["اهمیت", "متوسط"], ["اطمینان", "۷۶٪"],
      ["کشور", "۱"], ["گزارش پشتیبان", "۲"],
      ["تغییر مشاهده‌شده", "‎+۳۱٪"], ["پنجره زمانی", "۶ ماه"],
    ],
    ai: {
      summary: "دو گزارش مستقل، افزایش تفاهم‌نامه و بازدید دانشگاهی را ثبت کرده‌اند؛ الگو در هر دو یکسان است و تصادفی به نظر نمی‌رسد.",
      opportunity: "زمینه برای پیشنهاد همکاری رسمی دانشگاهی فراهم است.",
      risk: "اگر ظرف دو فصل اقدامی نشود، ابتکار به شریک رقیب منتقل می‌شود.",
      action: "تهیه‌ی پیش‌نویس تفاهم‌نامه‌ی دانشگاهی بر پایه‌ی دو گزارش پشتیبان.",
    },
  },
  "ai-risk-cover": {
    status: "نیازمند توجه", priority: "بالا",
    stats: [
      ["اهمیت", "بالا"], ["اطمینان", "۸۲٪"],
      ["گزارش پشتیبان", "۳"], ["کشور", "۱"],
      ["روند مرتبط", "۱"], ["پنجره زمانی", "۳ ماه"],
    ],
    ai: {
      summary: "کاهش فعالیت شریک محلی هم‌زمان با رشد تقاضا رخ داده؛ این ترکیب یعنی شکاف پوشش آموزشی در حال باز شدن است.",
      opportunity: "—",
      risk: "دوره‌های ترم آینده بدون جایگزین شریک، تعطیل می‌شوند.",
      action: "شناسایی شریک جایگزین و طرح مسئله در زنجیره‌ی اجرا.",
    },
  },
};

/** وقتی موجودیت ورودی اختصاصی ندارد، بازرس از خود ساختار گراف پر می‌شود */
const GENERIC_AI: InspectorData["ai"] = {
  summary: "برای این موجودیت هنوز تحلیل تجمیعی ساخته نشده است؛ روابط زیر از گراف استخراج شده‌اند.",
  opportunity: "—",
  risk: "—",
  action: "—",
};

// ─── کامپوننت ─────────────────────────────────────────────────────────────────
/** مختصات اولیه‌ی هر گره، جدا از تعریف ثابتش تا قابل جابه‌جایی بماند */
function initialPositions(): Record<string, { x: number; y: number }> {
  return Object.fromEntries(NODES.map((n) => [n.id, { x: n.x, y: n.y }]));
}

export default function IntelligenceGraph() {
  // پیش‌فرض روی خود کشور است تا نمای اول «دانش و رصد» را روایت کند، نه یک مسئله
  const [selected, setSelected] = useState<string | null>("indonesia");
  const [views, setViews] = // زنجیره‌ی اجرا پیش‌فرض خاموش است تا گراف پیش‌فرض را از رصد منحرف نکند
    useState<Record<System, boolean>>({ knowledge: true, execution: false });
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  /** موقعیت گره‌ها؛ کاربر می‌تواند با کشیدن ماوس تغییرشان دهد */
  const [pos, setPos] = useState(initialPositions);
  /** جابه‌جایی کل بوم با کشیدن فضای خالی */
  const [pan, setPan] = useState({ x: 0, y: 0 });
  /** گره زیر نشانگر — روابطش موقتاً روشن می‌شود */
  const [hover, setHover] = useState<string | null>(null);

  const zoomRef = useRef<SVGGElement>(null);
  /**
   * وضعیت کشیدن. در ref نگه داشته می‌شود نه state، چون در هر حرکت ماوس
   * تغییر می‌کند و نباید رندر اضافه بسازد.
   */
  const drag = useRef<{ id: string; moved: boolean } | null>(null);
  const panning = useRef<{ x: number; y: number; from: { x: number; y: number } } | null>(null);

  /** گره با مختصات جاری — یال‌ها و گره‌ها هر دو از این می‌خوانند */
  const byId = useMemo(
    () => Object.fromEntries(NODES.map((n) => [n.id, { ...n, ...pos[n.id] }])),
    [pos]
  );

  /**
   * تبدیل مختصات صفحه به فضای گروهِ zoom.
   *
   * از getScreenCTM خود گروه استفاده می‌شود تا هم viewBox و هم ترنسفورم
   * بزرگ‌نمایی یکجا معکوس شوند؛ محاسبه‌ی دستی این دو با هم خطاخیز است.
   */
  const toLocal = (clientX: number, clientY: number) => {
    const g = zoomRef.current;
    const m = g?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (panning.current) {
      // pan در فضای صفحه محاسبه می‌شود تا سرعتش با zoom تغییر نکند
      setPan({
        x: panning.current.from.x + (e.clientX - panning.current.x),
        y: panning.current.from.y + (e.clientY - panning.current.y),
      });
      return;
    }
    if (!drag.current) return;
    const p = toLocal(e.clientX, e.clientY);
    if (!p) return;
    drag.current.moved = true;
    const id = drag.current.id;
    setPos((prev) => ({ ...prev, [id]: { x: p.x, y: p.y } }));
  };

  const endDrag = () => {
    panning.current = null;
    const d = drag.current;
    drag.current = null;
    // کشیدن نباید انتخاب را عوض کند؛ فقط کلیکِ بدون حرکت انتخاب می‌کند
    if (d && !d.moved) setSelected((s) => (s === d.id ? null : d.id));
  };

  /** کشیدن فضای خالی = جابه‌جایی بوم */
  const startPan = (e: React.PointerEvent<SVGSVGElement>) => {
    panning.current = { x: e.clientX, y: e.clientY, from: pan };
  };

  /**
   * زوم با غلتک، لنگرانداخته به نشانگر.
   *
   * بدون جبران pan، نقطه‌ی زیر ماوس با هر زوم جابه‌جا می‌شود و کاوش شبکه
   * آزاردهنده می‌شود؛ فرمول pan را طوری تصحیح می‌کند که همان نقطه ثابت بماند.
   */
  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const p = toLocal(e.clientX, e.clientY);
    if (!p) return;
    const next = Math.min(2.4, Math.max(0.5, +(zoom * (e.deltaY < 0 ? 1.12 : 0.89)).toFixed(3)));
    if (next === zoom) return;
    setPan((prev) => ({
      x: prev.x + (p.x - CX) * (zoom - next),
      y: prev.y + (p.y - CY) * (zoom - next),
    }));
    setZoom(next);
  };

  /** گره‌های همسایه‌ی گره‌ای که ماوس رویش است */
  const hoverSet = useMemo(() => {
    if (!hover) return new Set<string>();
    const s = new Set<string>([hover]);
    for (const e of EDGES) {
      if (!views[e.system]) continue;
      if (e.from === hover) s.add(e.to);
      if (e.to === hover) s.add(e.from);
    }
    return s;
  }, [hover, views]);

  const visibleEdges = useMemo(
    () => EDGES.filter((e) => views[e.system]),
    [views]
  );

  /** گره‌هایی که با انتخاب فعلی رابطه‌ی مستقیم دارند */
  const neighbours = useMemo(() => {
    if (!selected) return new Set<string>();
    const s = new Set<string>([selected]);
    for (const e of visibleEdges) {
      if (e.from === selected) s.add(e.to);
      if (e.to === selected) s.add(e.from);
    }
    return s;
  }, [selected, visibleEdges]);

  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    return new Set(NODES.filter((n) => n.label.includes(q)).map((n) => n.id));
  }, [query]);

  const isDimmed = (id: string) => {
    if (matches) return !matches.has(id);
    // هاور بر انتخاب اولویت دارد تا بشود بدون از دست دادن انتخاب، شبکه را ردیابی کرد
    if (hover) return !hoverSet.has(id);
    if (!selected) return false;
    return !neighbours.has(id);
  };

  // Esc: ابتدا جستجو، بعد انتخاب را پاک می‌کند
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (query) setQuery("");
      else setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query]);

  const nodeHidden = (n: GNode) => {
    if (n.cluster && hidden.has(n.cluster)) return true;
    // زنجیره‌ی اجرا فقط در نمای «مسئله تا اجرا» دیده می‌شود
    if (n.cluster === "اجرا" && !views.execution) return true;
    return false;
  };

  const sel = selected ? byId[selected] : null;

  /**
   * روابط بازرس از خود گراف ساخته می‌شوند، نه از جدول جداگانه — وگرنه با هر
   * تغییر یال‌ها، پنل بی‌صدا از واقعیت گراف عقب می‌افتد.
   */
  const relations = useMemo(() => {
    if (!selected) return [];
    const out: Array<{ id: string; label: string; kind: string; tone: Tone }> = [];
    for (const e of EDGES) {
      if (!views[e.system]) continue;
      const other = e.from === selected ? e.to : e.to === selected ? e.from : null;
      if (!other) continue;
      const n = byId[other];
      if (!n || nodeHidden(n)) continue;
      out.push({ id: other, label: n.label, kind: e.rel, tone: n.tone });
    }
    return out.slice(0, 8);
  }, [selected, views, byId, hidden]);

  const info = (selected && INSPECTOR[selected]) || null;
  const selType = sel ? typeLabel[sel.etype] : "";

  const ctlStyle: React.CSSProperties = {
    background: "transparent", border: "none", color: T.t2,
    borderRadius: 7, padding: "5px 9px", fontSize: 11.5, cursor: "pointer",
    fontFamily: "YekanBakh, sans-serif", transition: "all 0.15s", whiteSpace: "nowrap",
  };

  return (
    <div style={{ position: "relative", flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
      {/* ── بوم گراف ── */}
      <div style={{ position: "relative", flex: 1, minWidth: 0, minHeight: 0 }}>
        {/*
          SVG مطلق است تا ارتفاعش از نسبت ابعاد viewBox نیاید؛ وگرنه بوم بلندتر
          از ویوپورت می‌شود و راهنما و نوار فرمان زیر خط دید می‌افتند.
        */}
        <svg viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid meet"
          onPointerDown={startPan}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={() => { endDrag(); setHover(null); }}
          onWheel={onWheel}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", display: "block",
            // حین کشیدن، انتخاب متن و اسکرول لمسی نباید دخالت کند
            touchAction: "none", userSelect: "none",
            cursor: panning.current ? "grabbing" : "default",
          }}>
          <defs>
            <radialGradient id="coreGlow">
              <stop offset="0%"   stopColor={T.gold}    stopOpacity="0.30" />
              <stop offset="55%"  stopColor={T.gold}    stopOpacity="0.07" />
              <stop offset="100%" stopColor={T.gold}    stopOpacity="0" />
            </radialGradient>
            <radialGradient id="coreBody">
              <stop offset="0%"   stopColor={T.goldHi} />
              <stop offset="45%"  stopColor={T.gold} />
              <stop offset="100%" stopColor="#7A6438" />
            </radialGradient>
            <radialGradient id="ambient">
              <stop offset="0%"   stopColor={T.mint} stopOpacity="0.06" />
              <stop offset="100%" stopColor={T.mint} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* نور محیطی برای عمق */}
          <ellipse cx={CX} cy={CY - 30} rx={430} ry={340} fill="url(#ambient)" />

          <g ref={zoomRef} transform={`translate(${pan.x} ${pan.y}) translate(${CX} ${CY}) scale(${zoom}) translate(${-CX} ${-CY})`}>
            {/* یال‌ها */}
            {visibleEdges.map((e, i) => {
              const a = byId[e.from];
              const b = byId[e.to];
              if (!a || !b || nodeHidden(a) || nodeHidden(b)) return null;
              // هاور موقتاً روابط را ردیابی می‌کند بدون آنکه انتخاب را عوض کند
              const onHover = hover ? e.from === hover || e.to === hover : false;
              const lit = onHover || (selected ? neighbours.has(e.from) && neighbours.has(e.to) : false);
              const dim = !lit && (selected !== null || hover !== null);
              const tone = e.system === "execution" ? T.gold : T.mint;
              return (
                <path
                  key={i}
                  d={curve(a, b)}
                  fill="none"
                  stroke={lit ? T.goldHi : tone}
                  strokeWidth={lit ? 1.5 : e.strong ? 1.1 : 0.7}
                  strokeOpacity={dim ? 0.09 : lit ? 0.8 : e.strong ? 0.32 : 0.17}
                  strokeLinecap="round"
                  style={{ transition: "stroke-opacity 0.18s, stroke 0.18s" }}
                />
              );
            })}

            {/* گره‌ها */}
            {NODES.map((base) => {
              const n = byId[base.id];
              if (nodeHidden(n)) return null;
              const isSel = n.id === selected;
              const dim = isDimmed(n.id);
              const r = radiusOf(n) * (isSel ? 1.22 : 1);
              const c = toneColor[n.tone];
              const labelOnLeft = n.x < CX;
              const isDragging = drag.current?.id === n.id;

              return (
                <g
                  key={n.id}
                  onPointerDown={(e) => {
                    // جلوی pan را می‌گیرد تا کشیدن روی گره، گره را ببرد نه بوم را
                    e.stopPropagation();
                    drag.current = { id: n.id, moved: false };
                  }}
                  onPointerEnter={() => setHover(n.id)}
                  onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
                  style={{
                    cursor: isDragging ? "grabbing" : "grab",
                    opacity: dim ? 0.42 : 1,
                    transition: "opacity 0.25s",
                  }}
                >
                  {n.kind === "center" ? (
                    <>
                      <circle cx={n.x} cy={n.y} r={120} fill="url(#coreGlow)" />
                      <circle cx={n.x} cy={n.y} r={r + 13} fill="none" stroke={T.goldLine} strokeWidth={0.7} />
                      <circle cx={n.x} cy={n.y} r={r} fill="url(#coreBody)" />
                    </>
                  ) : (
                    <>
                      {/* هاله‌ی ملایم */}
                      <circle cx={n.x} cy={n.y} r={r * 2.6} fill={c} opacity={dim ? 0 : 0.07} />
                      {/*
                        هوش استخراجی با حلقه‌ی نقطه‌چین از دانشِ منبع جدا می‌شود؛
                        رنگ به‌تنهایی کافی نیست چون رنگ‌ها معنای دیگری هم دارند.
                      */}
                      {n.origin === "ai" && (
                        <circle
                          cx={n.x} cy={n.y} r={r + 5} fill="none"
                          stroke={c} strokeWidth={0.8} strokeDasharray="2 3"
                          opacity={dim ? 0.25 : 0.7}
                        />
                      )}
                      <circle
                        cx={n.x} cy={n.y} r={r}
                        fill={n.kind === "primary" ? c : T.panelSolid}
                        stroke={c}
                        strokeWidth={n.kind === "primary" ? 0 : n.kind === "report" ? 2 : 1.4}
                        fillOpacity={n.kind === "primary" ? 0.85 : 1}
                      />
                    </>
                  )}

                  {/* حلقه‌ی طلایی انتخاب */}
                  {isSel && (
                    <circle cx={n.x} cy={n.y} r={r + 7} fill="none" stroke={T.gold} strokeWidth={1.1} />
                  )}

                  <text
                    x={labelOnLeft ? n.x - r - 8 : n.x + r + 8}
                    y={n.y + (n.kind === "center" ? 4 : 3.5)}
                    textAnchor={labelOnLeft ? "end" : "start"}
                    fill={isSel ? T.goldHi : n.kind === "entity" ? T.t2 : T.t1}
                    style={{
                      fontSize: n.kind === "center" ? 17 : n.kind === "primary" ? 12 : n.kind === "report" ? 11 : 10,
                      fontWeight: n.kind === "center" ? 700 : n.kind === "report" ? 600 : n.kind === "primary" ? 600 : 400,
                      fontFamily: "YekanBakh, sans-serif",
                      pointerEvents: "none",
                    }}
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* ── نوار کنترل شناور بالا ── */}
        <div className="panel" style={{
          position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: 4, padding: 5,
          borderRadius: T.rPill,
        }}>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو"
            style={{
              background: "transparent", border: "none", outline: "none",
              color: T.t1, fontSize: 11.5, width: 96, padding: "5px 10px",
              fontFamily: "YekanBakh, sans-serif",
            }}
          />
          <span style={{ width: 1, height: 16, background: T.hair }} />

          <button onClick={() => setShowFilter((v) => !v)} style={{
            ...ctlStyle,
            color: showFilter || hidden.size ? T.gold : T.t2,
            background: showFilter ? T.goldDim : "transparent",
          }}>فیلتر</button>

          <span style={{ width: 1, height: 16, background: T.hair }} />
          <button onClick={() => setZoom((z) => Math.min(2, +(z + 0.15).toFixed(2)))} style={ctlStyle}>بزرگ‌نمایی</button>
          <button onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))} style={ctlStyle}>کوچک‌نمایی</button>
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setSelected(null); setQuery(""); setPos(initialPositions()); }}
            title="بازگشت به چیدمان اولیه"
            style={ctlStyle}
          >مرکز گراف</button>

          <span style={{ width: 1, height: 16, background: T.hair }} />
          {([["knowledge", "دانش و رصد"], ["execution", "مسئله تا اجرا"]] as Array<[System, string]>).map(([k, label]) => {
            const on = views[k];
            return (
              <button key={k}
                onClick={() => setViews((v) => {
                  // دست‌کم یک نما باید روشن بماند وگرنه بوم خالی می‌شود
                  const next = { ...v, [k]: !v[k] };
                  return next.knowledge || next.execution ? next : v;
                })}
                style={{
                  ...ctlStyle,
                  color: on ? (k === "execution" ? T.gold : T.mint) : T.t3,
                  background: on ? (k === "execution" ? T.goldDim : "rgba(111,224,192,0.10)") : "transparent",
                  border: `1px solid ${on ? (k === "execution" ? T.goldLine : "rgba(111,224,192,0.28)") : "transparent"}`,
                  borderRadius: T.rPill,
                }}>{label}</button>
            );
          })}
        </div>

        {/* پانل فیلتر دامنه‌ها */}
        {showFilter && (
          <div className="panel anim-fadein" style={{
            position: "absolute", top: 64, left: "50%", transform: "translateX(-50%)",
            padding: "10px 12px", display: "flex", flexDirection: "column", gap: 3, minWidth: 168,
          }}>
            <p style={{ fontSize: 9.5, color: T.t3, margin: "0 0 4px" }}>نمایش خوشه‌ها</p>
            {CLUSTERS.map((d) => {
              const on = !hidden.has(d.id);
              return (
                <button key={d.id}
                  onClick={() => setHidden((h) => {
                    const n = new Set(h);
                    if (n.has(d.id)) n.delete(d.id); else n.add(d.id);
                    return n;
                  })}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "none", border: "none", cursor: "pointer", padding: "4px 2px",
                    color: on ? T.t2 : T.t3, fontSize: 11, fontFamily: "YekanBakh, sans-serif",
                  }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: on ? toneColor[d.tone] : "transparent",
                      border: `1px solid ${toneColor[d.tone]}`,
                    }} />
                    {d.label}
                  </span>
                  <span style={{ fontSize: 9, color: T.t3 }}>{on ? "نمایش" : "پنهان"}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── راهنمای رنگ، پایین‌چپ ── */}
        <div className="panel graph-legend" style={{
          position: "absolute", bottom: 18, left: 18, padding: "10px 13px",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {([
            ["گزارش و منبع",       T.mint,     false],
            ["موجودیت استخراجی",   T.sky,      false],
            ["هوش استخراجی AI",    T.lavender, true],
            ["ریسک",               T.bad,      true],
            ["فرصت و نتیجه",       T.ok,       true],
            ["موجودیت منتخب",      T.gold,     false],
          ] as Array<[string, string, boolean]>).map(([label, c, dashed]) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: T.t2 }}>
              {/* حلقه‌ی نقطه‌چین همان نشانه‌ی «استخراج AI» روی خود گراف است */}
              <span style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: dashed ? "transparent" : c,
                border: dashed ? `1px dashed ${c}` : "none",
              }} />
              {label}
            </span>
          ))}
        </div>

        {/* ── نوار فرمان هوشمند، پایین‌مرکز ── */}
        <div className="panel" style={{
          position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
          padding: 9, display: "flex", flexDirection: "column", gap: 8,
          // به عرض بوم مقید است، وگرنه در پنجره‌های باریک روی بازرس می‌افتد
          width: "min(430px, calc(100% - 36px))",
        }}>
          {sel && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 3px" }}>
              <span style={{ fontSize: 9, color: T.t3 }}>زمینه:</span>
              <span style={{ fontSize: 10, color: T.gold, fontWeight: 600 }}>
                {sel.id === "indonesia" ? "" : "اندونزی / "}{sel.label}
              </span>
            </div>
          )}
          <input
            placeholder="درباره این شبکه سؤال کنید..."
            style={{
              background: "transparent", border: "none", outline: "none",
              color: T.t1, fontSize: 12, padding: "4px 6px",
              fontFamily: "YekanBakh, sans-serif", caretColor: T.gold,
            }}
          />
          <div style={{ display: "flex", gap: 5, borderTop: `1px solid ${T.hair}`, paddingTop: 8 }}>
            {["منابع", "تحلیل شبکه", "ریسک‌ها", "پیشنهاد اقدام"].map((a) => (
              <button key={a} style={{
                fontSize: 10, color: T.t2, background: "transparent",
                border: `1px solid ${T.hair}`, borderRadius: T.rPill,
                padding: "3px 11px", cursor: "pointer", fontFamily: "YekanBakh, sans-serif",
                transition: "all 0.15s",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.goldLine; e.currentTarget.style.color = T.goldHi; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.hair; e.currentTarget.style.color = T.t2; }}
              >{a}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── بازرس زمینه‌ی هوشمند ── */}
      {sel && (
        <div className="panel anim-fadein" style={{
          width: "26%", minWidth: 236, maxWidth: 340, flexShrink: 0,
          margin: "16px 16px 16px 0", display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.hair}` }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: T.t1, margin: 0, lineHeight: 1.45 }}>{sel.label}</p>
              <button onClick={() => setSelected(null)} style={{
                background: "none", border: "none", color: T.t3, cursor: "pointer",
                fontSize: 16, padding: "0 2px", flexShrink: 0,
              }}>×</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 9 }}>
              <Tag text={selType} tone={T.gold} />
              {info && <Tag text={info.status} tone={T.ok} />}
              {info && <Tag text={`اولویت ${info.priority}`} tone={T.warn} />}
              {/* منشأ، صریح: کاربر باید بداند این داده‌ی منبع است یا استنتاج AI */}
              <Tag
                text={sel.origin === "ai" ? "استخراج AI" : "دانش منبع"}
                tone={sel.origin === "ai" ? T.lavender : T.mint}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
            {/* شاخص‌ها */}
            {info && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              {info.stats.map(([label, v]) => (
                <div key={label} style={{
                  background: "rgba(0,0,0,0.22)", border: `1px solid ${T.hair}`,
                  borderRadius: T.rCtl, padding: "9px 11px",
                }}>
                  <p style={{ fontSize: 17, fontWeight: 300, color: T.t1, margin: 0, lineHeight: 1 }}>{v}</p>
                  <p style={{ fontSize: 9, color: T.t3, margin: "5px 0 0" }}>{label}</p>
                </div>
              ))}
            </div>
            )}

            {/* روابط کلیدی — کلیک، همان گره را در گراف انتخاب می‌کند */}
            {relations.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: T.t1, fontWeight: 600, margin: "0 0 9px" }}>روابط کلیدی</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {relations.map((r) => (
                    <button key={r.id} onClick={() => setSelected(r.id)} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "7px 10px", borderRadius: T.rCtl, width: "100%",
                      background: "rgba(0,0,0,0.18)", border: `1px solid ${T.hair}`,
                      cursor: "pointer", fontFamily: "YekanBakh, sans-serif",
                      transition: "border-color 0.15s",
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.goldLine; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.hair; }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: toneColor[r.tone], flexShrink: 0,
                        }} />
                        <span style={{
                          fontSize: 10.5, color: T.t2, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{r.label}</span>
                      </span>
                      <span style={{ fontSize: 9, color: T.t3, flexShrink: 0 }}>{r.kind}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* تحلیل هوشمند */}
            <div>
              <p style={{
                fontSize: 11, color: T.t1, fontWeight: 600, margin: "0 0 9px",
                display: "flex", alignItems: "center", gap: 7,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", background: T.mint,
                  boxShadow: `0 0 7px ${T.mint}`,
                }} />
                تحلیل هوشمند
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {(() => {
                  const ai = info?.ai ?? GENERIC_AI;
                  return (
                    <>
                      <Insight label="خلاصه"          text={ai.summary}     tone={T.t2} />
                      <Insight label="فرصت"           text={ai.opportunity} tone={T.ok} />
                      <Insight label="ریسک"           text={ai.risk}        tone={T.bad} />
                      <Insight label="اقدام پیشنهادی" text={ai.action}      tone={T.gold} />
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          <div style={{ padding: 12, borderTop: `1px solid ${T.hair}` }}>
            <button style={{
              width: "100%", background: T.goldDim, border: `1px solid ${T.goldLine}`,
              color: T.gold, borderRadius: T.rCtl, padding: "9px 0",
              fontSize: 11.5, fontWeight: 600, cursor: "pointer",
              fontFamily: "YekanBakh, sans-serif",
            }}>مشاهده پرونده کامل</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ text, tone }: { text: string; tone: string }) {
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 600, color: tone,
      background: `${tone}18`, border: `1px solid ${tone}3A`,
      borderRadius: T.rPill, padding: "2px 9px", whiteSpace: "nowrap",
    }}>{text}</span>
  );
}

function Insight({ label, text, tone }: { label: string; text: string; tone: string }) {
  return (
    <div style={{ borderRight: `2px solid ${tone}`, paddingRight: 10 }}>
      <p style={{ fontSize: 9.5, color: tone, margin: "0 0 3px", fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 10.5, color: T.t2, margin: 0, lineHeight: 1.85 }}>{text}</p>
    </div>
  );
}
