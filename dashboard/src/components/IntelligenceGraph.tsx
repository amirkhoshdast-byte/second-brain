"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { T } from "@/lib/theme";
import EntityIntelCard from "@/components/EntityIntelCard";
import type { IntelType } from "@/lib/intel";

type Origin = "source" | "ai";

type EType =
  | "country" | "region" | "mission" | "report" | "source"
  | "topic" | "person" | "org" | "event" | "religion"
  | "trend" | "signal" | "risk" | "opportunity" | "insight"
  | "issue" | "decision" | "directive" | "action" | "project" | "result";

type Kind = "center" | "primary" | "report" | "entity";
type Tone = "teal" | "gold" | "blue" | "ai" | "risk" | "done";
type System = "knowledge" | "execution";

type GNode = {
  id: string; label: string; kind: Kind; etype: EType;
  origin: Origin; tone: Tone; cluster?: string; x: number; y: number;
};

type GEdge = {
  from: string; to: string; system: System; rel: string; strong?: boolean;
};

// ─── داده‌ی API گراف ──────────────────────────────────────────────────────────
type GraphData = {
  ready: boolean;
  countries?: Array<{ country: string; n: number }>;
  entities?: Array<{ id: string; etype: string; name: string; mentions: number }>;
  cooccur?: Array<{ a: string; b: string; w: number }>;
  signals?: Array<{ id: string; stype: string; title: string; country: string | null; topic: string | null; confidence: number }>;
};

const toneColor: Record<Tone, string> = {
  teal: T.mint, gold: T.gold, blue: T.sky, ai: T.lavender, risk: T.bad, done: T.ok,
};

const typeLabel: Record<EType, string> = {
  country: "کشور", region: "منطقه", mission: "نمایندگی فرهنگی",
  report: "گزارش", source: "منبع", topic: "موضوع", person: "شخص",
  org: "سازمان", event: "رویداد", religion: "دین / جریان فرهنگی",
  trend: "روند", signal: "سیگنال", risk: "ریسک", opportunity: "فرصت",
  insight: "بینش هوشمند", issue: "مسئله", decision: "تصمیم",
  directive: "مصوبه / دستور", action: "اقدام", project: "پروژه", result: "نتیجه",
};

const CX = 500;
const CY = 400;

function polar(deg: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

// ─── داده‌ی نمونه — fallback وقتی DB در دسترس نیست ──────────────────────────
type Spec = {
  id: string; label: string; etype: EType; origin?: Origin;
  kind?: Kind; tone?: Tone; cluster?: string; deg: number; r: number;
};

const SPECS: Spec[] = [
  { id: "region-sea",  label: "جنوب شرق آسیا",              etype: "region",  kind: "primary", tone: "blue", deg: 342, r: 178 },
  { id: "mission-jkt", label: "رایزنی فرهنگی ایران، جاکارتا", etype: "mission", kind: "primary", tone: "blue", deg: 200, r: 168 },
  { id: "src-icro",    label: "پایگاه جامعه و فرهنگ ملل",    etype: "source",  kind: "primary", tone: "teal", deg: 258, r: 186 },
  { id: "rep-farsi", label: "گزارش وضعیت زبان فارسی",  etype: "report", kind: "report", tone: "teal", cluster: "گزارش‌ها", deg: 22,  r: 232 },
  { id: "rep-univ",  label: "گزارش دانشگاه‌های اندونزی", etype: "report", kind: "report", tone: "teal", cluster: "گزارش‌ها", deg: 56,  r: 240 },
  { id: "rep-cult",  label: "گزارش تحولات فرهنگی",     etype: "report", kind: "report", tone: "teal", cluster: "گزارش‌ها", deg: 90,  r: 232 },
  { id: "rep-faith", label: "گزارش گفت‌وگوی ادیان",     etype: "report", kind: "report", tone: "teal", cluster: "گزارش‌ها", deg: 124, r: 238 },
  { id: "top-farsi",  label: "زبان فارسی",       etype: "topic", tone: "blue", cluster: "موضوعات", deg: 8,   r: 352 },
  { id: "top-univ",   label: "همکاری دانشگاهی",  etype: "topic", tone: "blue", cluster: "موضوعات", deg: 44,  r: 366 },
  { id: "top-culdip", label: "دیپلماسی فرهنگی",  etype: "topic", tone: "blue", cluster: "موضوعات", deg: 96,  r: 358 },
  { id: "top-faith",  label: "گفت‌وگوی ادیان",   etype: "topic", tone: "blue", cluster: "موضوعات", deg: 132, r: 356 },
  { id: "per-omar",    label: "نصرالدین عمر",            etype: "person", tone: "blue", cluster: "اشخاص",     deg: 116, r: 424 },
  { id: "per-rayzan",  label: "رایزن فرهنگی جاکارتا",   etype: "person", tone: "blue", cluster: "اشخاص",     deg: 176, r: 300 },
  { id: "org-religion", label: "وزارت امور دینی اندونزی", etype: "org", tone: "blue", cluster: "سازمان‌ها", deg: 146, r: 420 },
  { id: "org-univ-jkt", label: "دانشگاه اسلامی جاکارتا",  etype: "org", tone: "blue", cluster: "سازمان‌ها", deg: 62,  r: 436 },
  { id: "org-unesco",   label: "یونسکو",                 etype: "org", tone: "blue", cluster: "سازمان‌ها", deg: 30,  r: 430 },
  { id: "ev-week",    label: "هفته فرهنگی جاکارتا", etype: "event", tone: "blue", cluster: "رویدادها", deg: 158, r: 356 },
  { id: "ev-jakarta", label: "بیانیه جاکارتا",      etype: "event", tone: "blue", cluster: "رویدادها", deg: 78,  r: 440 },
  { id: "ai-trend-farsi", label: "افزایش تقاضای آموزش زبان فارسی", etype: "trend",       origin: "ai", tone: "ai",   cluster: "هوش استخراجی", deg: 236, r: 320 },
  { id: "ai-sig-univ",    label: "سیگنال رشد تعامل دانشگاهی",      etype: "signal",      origin: "ai", tone: "ai",   cluster: "هوش استخراجی", deg: 272, r: 330 },
  { id: "ai-opp-univ",    label: "فرصت همکاری دانشگاهی",           etype: "opportunity", origin: "ai", tone: "done", cluster: "هوش استخراجی", deg: 300, r: 300 },
  { id: "ai-risk-cover",  label: "ریسک کاهش پوشش آموزشی",          etype: "risk",        origin: "ai", tone: "risk", cluster: "هوش استخراجی", deg: 214, r: 320 },
  { id: "ai-ins-partner", label: "کاهش فعالیت شریک محلی",          etype: "insight",     origin: "ai", tone: "ai",   cluster: "هوش استخراجی", deg: 320, r: 296 },
  { id: "ex-issue", label: "توسعه زبان فارسی در اندونزی", etype: "issue",     tone: "gold", cluster: "اجرا", deg: 188, r: 430 },
  { id: "ex-dec",   label: "مصوبه کرسی زبان فارسی",       etype: "directive", tone: "gold", cluster: "اجرا", deg: 206, r: 452 },
  { id: "ex-prj",   label: "کرسی‌های زبان فارسی",         etype: "project",   tone: "gold", cluster: "اجرا", deg: 228, r: 462 },
  { id: "ex-res",   label: "راه‌اندازی ۳ کرسی",           etype: "result",    tone: "done", cluster: "اجرا", deg: 250, r: 452 },
];

const SAMPLE_NODES: GNode[] = [
  { id: "indonesia", label: "اندونزی", kind: "center", etype: "country", origin: "source", tone: "gold", x: CX, y: CY },
  ...SPECS.map((s): GNode => {
    const p = polar(s.deg, s.r);
    return { id: s.id, label: s.label, kind: s.kind ?? "entity", etype: s.etype, origin: s.origin ?? "source", tone: s.tone ?? "blue", cluster: s.cluster, x: p.x, y: p.y };
  }),
];

const SAMPLE_EDGES: GEdge[] = [
  { from: "region-sea",  to: "indonesia",   system: "knowledge", rel: "شامل",           strong: true },
  { from: "mission-jkt", to: "indonesia",   system: "knowledge", rel: "نمایندگی در",    strong: true },
  { from: "rep-farsi", to: "mission-jkt", system: "knowledge", rel: "تولیدشده توسط", strong: true },
  { from: "rep-univ",  to: "mission-jkt", system: "knowledge", rel: "تولیدشده توسط" },
  { from: "rep-cult",  to: "mission-jkt", system: "knowledge", rel: "تولیدشده توسط" },
  { from: "rep-faith", to: "mission-jkt", system: "knowledge", rel: "تولیدشده توسط" },
  { from: "rep-farsi", to: "indonesia", system: "knowledge", rel: "درباره", strong: true },
  { from: "rep-univ",  to: "indonesia", system: "knowledge", rel: "درباره", strong: true },
  { from: "rep-cult",  to: "indonesia", system: "knowledge", rel: "درباره" },
  { from: "rep-faith", to: "indonesia", system: "knowledge", rel: "درباره" },
  { from: "rep-cult",  to: "src-icro", system: "knowledge", rel: "منتشرشده در" },
  { from: "rep-faith", to: "src-icro", system: "knowledge", rel: "منتشرشده در" },
  { from: "rep-farsi", to: "top-farsi",  system: "knowledge", rel: "شامل موضوع", strong: true },
  { from: "rep-univ",  to: "top-univ",   system: "knowledge", rel: "شامل موضوع", strong: true },
  { from: "rep-univ",  to: "top-farsi",  system: "knowledge", rel: "شامل موضوع" },
  { from: "rep-cult",  to: "top-culdip", system: "knowledge", rel: "شامل موضوع", strong: true },
  { from: "rep-faith", to: "top-faith",  system: "knowledge", rel: "شامل موضوع", strong: true },
  { from: "rep-faith", to: "top-culdip", system: "knowledge", rel: "شامل موضوع" },
  { from: "rep-faith", to: "per-omar",     system: "knowledge", rel: "اشاره به" },
  { from: "rep-faith", to: "org-religion", system: "knowledge", rel: "اشاره به" },
  { from: "rep-univ",  to: "org-univ-jkt", system: "knowledge", rel: "اشاره به" },
  { from: "rep-cult",  to: "org-unesco",   system: "knowledge", rel: "اشاره به" },
  { from: "rep-farsi", to: "per-rayzan",   system: "knowledge", rel: "اشاره به" },
  { from: "rep-cult",  to: "ev-week",    system: "knowledge", rel: "ثبت می‌کند" },
  { from: "rep-faith", to: "ev-jakarta", system: "knowledge", rel: "ثبت می‌کند" },
  { from: "per-omar",   to: "org-religion", system: "knowledge", rel: "وابسته به" },
  { from: "top-culdip", to: "org-unesco",   system: "knowledge", rel: "مرتبط با" },
  { from: "per-rayzan", to: "mission-jkt",  system: "knowledge", rel: "مسئول" },
  { from: "rep-farsi", to: "ai-trend-farsi", system: "knowledge", rel: "نشان می‌دهد", strong: true },
  { from: "rep-univ",  to: "ai-trend-farsi", system: "knowledge", rel: "نشان می‌دهد", strong: true },
  { from: "ai-trend-farsi", to: "ai-sig-univ", system: "knowledge", rel: "ایجاد می‌کند", strong: true },
  { from: "rep-univ",       to: "ai-sig-univ", system: "knowledge", rel: "پشتیبانی می‌کند" },
  { from: "ai-sig-univ",    to: "ai-opp-univ",   system: "knowledge", rel: "نشان‌دهنده", strong: true },
  { from: "ai-trend-farsi", to: "ai-risk-cover", system: "knowledge", rel: "نشان‌دهنده", strong: true },
  { from: "rep-cult",  to: "ai-ins-partner", system: "knowledge", rel: "استخراج‌شده از" },
  { from: "rep-faith", to: "ai-ins-partner", system: "knowledge", rel: "استخراج‌شده از" },
  { from: "ai-ins-partner", to: "ai-risk-cover", system: "knowledge", rel: "تقویت می‌کند" },
  { from: "ai-opp-univ", to: "top-univ", system: "knowledge", rel: "درباره" },
  { from: "ai-risk-cover", to: "ex-issue", system: "execution", rel: "منجر می‌شود به", strong: true },
  { from: "ex-issue", to: "ex-dec", system: "execution", rel: "تصمیم",  strong: true },
  { from: "ex-dec",   to: "ex-prj", system: "execution", rel: "اقدام",  strong: true },
  { from: "ex-prj",   to: "ex-res", system: "execution", rel: "نتیجه" },
  { from: "ex-prj",   to: "per-rayzan", system: "execution", rel: "مسئول" },
];

// ─── ساخت گراف از داده‌ی زنده ─────────────────────────────────────────────────
const SIGNAL_ETYPE: Record<string, EType> = {
  trend: "trend", signal: "signal", insight: "insight", risk: "risk", opportunity: "opportunity",
};
const SIGNAL_TONE: Record<string, Tone> = {
  trend: "ai", signal: "ai", insight: "ai", risk: "risk", opportunity: "done",
};

function truncLabel(s: string, max = 18) {
  if (s.length <= max) return s;
  const cut = s.lastIndexOf(" ", max);
  return (cut > max - 7 ? s.slice(0, cut) : s.slice(0, max)) + "…";
}

function buildGraph(data: GraphData): { nodes: GNode[]; edges: GEdge[] } {
  if (!data.ready || !data.countries?.length) return { nodes: SAMPLE_NODES, edges: SAMPLE_EDGES };

  const nodes: GNode[] = [];
  const edges: GEdge[] = [];

  // ── مرکز: کشور با بیشترین گزارش ──
  const center = data.countries[0];
  const centerId = `c_${center.country}`;
  nodes.push({ id: centerId, label: center.country, kind: "center", etype: "country", origin: "source", tone: "gold", x: CX, y: CY });

  // ── حلقه‌ی کشورها — کمان بالا ──
  data.countries.slice(1, 7).forEach((c, i) => {
    const deg = 300 + i * 22;
    const p = polar(deg, 180);
    const id = `c_${c.country}`;
    nodes.push({ id, label: c.country, kind: "primary", etype: "country", origin: "source", tone: "blue", x: p.x, y: p.y });
    edges.push({ from: centerId, to: id, system: "knowledge", rel: "هم‌پیکره", strong: c.n > 5 });
  });

  const byType = (etype: string, limit: number) =>
    (data.entities ?? []).filter(e => e.etype === etype).slice(0, limit);

  const topics  = byType("topic",  6);
  const persons = byType("person", 5);
  const orgs    = byType("org",    5);
  const events  = byType("event",  3);

  // ── موضوعات — کمان راست ──
  topics.forEach((e, i) => {
    const p = polar(15 + i * 20, 350 + (i % 2) * 18);
    nodes.push({ id: `e_${e.id}`, label: e.name, kind: "entity", etype: "topic", origin: "source", tone: "blue", cluster: "موضوعات", x: p.x, y: p.y });
    edges.push({ from: centerId, to: `e_${e.id}`, system: "knowledge", rel: "موضوع فعال", strong: e.mentions > 10 });
  });

  // ── اشخاص — کمان پایین‌راست ──
  persons.forEach((e, i) => {
    const p = polar(140 + i * 14, 420 + (i % 2) * 20);
    nodes.push({ id: `e_${e.id}`, label: truncLabel(e.name), kind: "entity", etype: "person", origin: "source", tone: "blue", cluster: "اشخاص", x: p.x, y: p.y });
  });

  // ── سازمان‌ها — کمان پایین ──
  orgs.forEach((e, i) => {
    const p = polar(205 + i * 12, 420 + (i % 2) * 15);
    nodes.push({ id: `e_${e.id}`, label: truncLabel(e.name), kind: "entity", etype: "org", origin: "source", tone: "blue", cluster: "سازمان‌ها", x: p.x, y: p.y });
  });

  // ── رویدادها ──
  events.forEach((e, i) => {
    const p = polar(60 + i * 20, 445);
    nodes.push({ id: `e_${e.id}`, label: truncLabel(e.name), kind: "entity", etype: "event", origin: "source", tone: "blue", cluster: "رویدادها", x: p.x, y: p.y });
  });

  // ── لبه‌های هم‌ذکری ──
  const nodeIdSet = new Set(nodes.map(n => n.id));
  (data.cooccur ?? []).forEach(({ a, b, w }) => {
    const nA = `e_${a}`, nB = `e_${b}`;
    if (nodeIdSet.has(nA) && nodeIdSet.has(nB)) {
      edges.push({ from: nA, to: nB, system: "knowledge", rel: "هم‌ذکر", strong: w >= 5 });
    }
  });

  // ── سیگنال‌های AI — کمان چپ ──
  (data.signals ?? []).slice(0, 7).forEach((s, i) => {
    const p = polar(220 + i * 14, 300 + (i % 2) * 22);
    const id = `s_${s.id}`;
    const etype = SIGNAL_ETYPE[s.stype] ?? "signal" as EType;
    nodes.push({ id, label: truncLabel(s.title), kind: "entity", etype, origin: "ai", tone: SIGNAL_TONE[s.stype] ?? "ai", cluster: "هوش استخراجی", x: p.x, y: p.y });

    // اتصال به کشور مرتبط یا مرکز
    const targetCountry = s.country ? nodes.find(n => n.label === s.country) : null;
    edges.push({ from: id, to: targetCountry?.id ?? centerId, system: "knowledge", rel: "سیگنال از", strong: s.confidence > 0.8 });

    // اتصال به موضوع مرتبط
    if (s.topic) {
      const topicNode = nodes.find(n => n.etype === "topic" && n.label === s.topic);
      if (topicNode) edges.push({ from: id, to: topicNode.id, system: "knowledge", rel: "درباره موضوع" });
    }
  });

  return { nodes, edges };
}

// ─── بازرس — داده‌ی ثابت برای نمونه ──────────────────────────────────────────
type InspectorData = {
  status: string; priority: string;
  stats: Array<[string, string]>;
  ai: { summary: string; opportunity: string; risk: string; action: string };
};

const INSPECTOR: Record<string, InspectorData> = {
  indonesia: {
    status: "تحت رصد", priority: "بالا",
    stats: [["گزارش ثبت‌شده","۴۲"],["موضوع فعال","۹"],["شخص کلیدی","۱۷"],["سازمان مرتبط","۱۱"],["سیگنال باز","۳"],["ریسک فعال","۱"]],
    ai: { summary: "چهار گزارش نمایندگی جاکارتا در شش ماه گذشته روی سه محور متمرکزند: زبان فارسی، همکاری دانشگاهی و گفت‌وگوی ادیان.", opportunity: "هم‌زمانی رشد تقاضای زبان فارسی با گشایش دانشگاهی، پنجره‌ی کوتاهی برای تثبیت همکاری رسمی می‌سازد.", risk: "پوشش آموزشی به یک شریک محلی وابسته است که فعالیتش در دو گزارش اخیر کاهش نشان می‌دهد.", action: "تدوین گزارش تجمیعی از چهار سند و طرح آن در جلسه‌ی منطقه‌ای جنوب شرق آسیا." },
  },
};

const GENERIC_AI: InspectorData["ai"] = {
  summary: "برای این موجودیت هنوز تحلیل تجمیعی ساخته نشده است؛ روابط زیر از گراف استخراج شده‌اند.",
  opportunity: "—", risk: "—", action: "—",
};

// ─── کامپوننت ─────────────────────────────────────────────────────────────────
const CLUSTERS = [
  { id: "موضوعات",      label: "موضوعات",       tone: "blue" as Tone },
  { id: "اشخاص",        label: "اشخاص",         tone: "blue" as Tone },
  { id: "سازمان‌ها",    label: "سازمان‌ها",     tone: "blue" as Tone },
  { id: "رویدادها",     label: "رویدادها",      tone: "blue" as Tone },
  { id: "هوش استخراجی", label: "هوش استخراجی",  tone: "ai"   as Tone },
  { id: "اجرا",         label: "زنجیره اجرا",   tone: "gold" as Tone },
];

function radiusOf(n: GNode) {
  return n.kind === "center" ? 34 : n.kind === "report" ? 13 : n.kind === "primary" ? 15 : 8.5;
}

function curve(a: GNode, b: GNode) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(30, len * 0.13);
  const nx = -dy / len, ny = dx / len;
  return `M ${a.x} ${a.y} Q ${mx + nx * bow} ${my + ny * bow} ${b.x} ${b.y}`;
}

function intelTypeOf(e: EType): IntelType | null {
  const ok: IntelType[] = ["country","region","topic","report","person","org","event","signal","risk","opportunity","mission","source","trend","insight"];
  return (ok as string[]).includes(e) ? (e as IntelType) : null;
}

export default function IntelligenceGraph() {
  const [nodes, setNodes] = useState<GNode[]>(SAMPLE_NODES);
  const [edges, setEdges] = useState<GEdge[]>(SAMPLE_EDGES);
  const [isLive, setIsLive] = useState(false);

  // بارگذاری داده‌ی زنده از API
  useEffect(() => {
    fetch("/api/intel/graph")
      .then(r => r.json())
      .then((data: GraphData) => {
        const { nodes: n, edges: e } = buildGraph(data);
        if (data.ready && n !== SAMPLE_NODES) {
          setNodes(n);
          setEdges(e);
          setPos(Object.fromEntries(n.map(nd => [nd.id, { x: nd.x, y: nd.y }])));
          setSelected(n[0]?.id ?? null);
          setIsLive(true);
        }
      })
      .catch(() => {}); // fallback to sample data silently
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selected, setSelected] = useState<string | null>("indonesia");
  const [views, setViews] = useState<Record<System, boolean>>({ knowledge: true, execution: false });
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>(() =>
    Object.fromEntries(SAMPLE_NODES.map(n => [n.id, { x: n.x, y: n.y }]))
  );
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);

  const zoomRef = useRef<SVGGElement>(null);
  const drag = useRef<{ id: string; moved: boolean } | null>(null);
  const panning = useRef<{ x: number; y: number; from: { x: number; y: number } } | null>(null);

  const byId = useMemo(
    () => Object.fromEntries(nodes.map(n => [n.id, { ...n, ...(pos[n.id] ?? { x: n.x, y: n.y }) }])),
    [nodes, pos]
  );

  const toLocal = (clientX: number, clientY: number) => {
    const g = zoomRef.current;
    const m = g?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (panning.current) {
      setPan({ x: panning.current.from.x + (e.clientX - panning.current.x), y: panning.current.from.y + (e.clientY - panning.current.y) });
      return;
    }
    if (!drag.current) return;
    const p = toLocal(e.clientX, e.clientY);
    if (!p) return;
    drag.current.moved = true;
    setPos(prev => ({ ...prev, [drag.current!.id]: { x: p.x, y: p.y } }));
  };

  const endDrag = () => {
    panning.current = null;
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) { setCardOpen(false); setSelected(s => s === d.id ? null : d.id); }
  };

  const startPan = (e: React.PointerEvent<SVGSVGElement>) => {
    panning.current = { x: e.clientX, y: e.clientY, from: pan };
  };

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const p = toLocal(e.clientX, e.clientY);
    if (!p) return;
    const next = Math.min(2.4, Math.max(0.5, +(zoom * (e.deltaY < 0 ? 1.12 : 0.89)).toFixed(3)));
    if (next === zoom) return;
    setPan(prev => ({ x: prev.x + (p.x - CX) * (zoom - next), y: prev.y + (p.y - CY) * (zoom - next) }));
    setZoom(next);
  };

  const hoverSet = useMemo(() => {
    if (!hover) return new Set<string>();
    const s = new Set<string>([hover]);
    for (const e of edges) {
      if (!views[e.system]) continue;
      if (e.from === hover) s.add(e.to);
      if (e.to === hover) s.add(e.from);
    }
    return s;
  }, [hover, views, edges]);

  const visibleEdges = useMemo(() => edges.filter(e => views[e.system]), [views, edges]);

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
    return new Set(nodes.filter(n => n.label.includes(q)).map(n => n.id));
  }, [query, nodes]);

  const isDimmed = (id: string) => {
    if (matches) return !matches.has(id);
    if (hover) return !hoverSet.has(id);
    if (!selected) return false;
    return !neighbours.has(id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (query) setQuery(""); else setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query]);

  const nodeHidden = (n: GNode) => {
    if (n.cluster && hidden.has(n.cluster)) return true;
    if (n.cluster === "اجرا" && !views.execution) return true;
    return false;
  };

  const sel = selected ? byId[selected] : null;

  const relations = useMemo(() => {
    if (!selected) return [];
    const out: Array<{ id: string; label: string; kind: string; tone: Tone }> = [];
    for (const e of edges) {
      if (!views[e.system]) continue;
      const other = e.from === selected ? e.to : e.to === selected ? e.from : null;
      if (!other) continue;
      const n = byId[other];
      if (!n || nodeHidden(n)) continue;
      out.push({ id: other, label: n.label, kind: e.rel, tone: n.tone });
    }
    return out.slice(0, 8);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, views, byId, hidden, edges]);

  const info = (selected && INSPECTOR[selected]) || null;
  const selType = sel ? typeLabel[sel.etype] : "";
  const centerNode = nodes.find(n => n.kind === "center");

  const ctlStyle: React.CSSProperties = {
    background: "transparent", border: "none", color: T.t2,
    borderRadius: 7, padding: "5px 9px", fontSize: 11.5, cursor: "pointer",
    fontFamily: "YekanBakh, sans-serif", transition: "all 0.15s", whiteSpace: "nowrap",
  };

  return (
    <div style={{ position: "relative", flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
      <div style={{ position: "relative", flex: 1, minWidth: 0, minHeight: 0 }}>
        <svg viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid meet"
          onPointerDown={startPan} onPointerMove={onPointerMove} onPointerUp={endDrag}
          onPointerLeave={() => { endDrag(); setHover(null); }} onWheel={onWheel}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", touchAction: "none", userSelect: "none", cursor: panning.current ? "grabbing" : "default" }}>
          <defs>
            <radialGradient id="coreGlow">
              <stop offset="0%"   stopColor={T.gold} stopOpacity="0.30" />
              <stop offset="55%"  stopColor={T.gold} stopOpacity="0.07" />
              <stop offset="100%" stopColor={T.gold} stopOpacity="0" />
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

          <ellipse cx={CX} cy={CY - 30} rx={430} ry={340} fill="url(#ambient)" />

          <g ref={zoomRef} transform={`translate(${pan.x} ${pan.y}) translate(${CX} ${CY}) scale(${zoom}) translate(${-CX} ${-CY})`}>
            {/* یال‌ها */}
            {visibleEdges.map((e, i) => {
              const a = byId[e.from], b = byId[e.to];
              if (!a || !b || nodeHidden(a) || nodeHidden(b)) return null;
              const onHover = hover ? e.from === hover || e.to === hover : false;
              const lit = onHover || (selected ? neighbours.has(e.from) && neighbours.has(e.to) : false);
              const dim = !lit && (selected !== null || hover !== null);
              const tone = e.system === "execution" ? T.gold : T.mint;
              return (
                <path key={i} d={curve(a, b)} fill="none"
                  stroke={lit ? T.goldHi : tone}
                  strokeWidth={lit ? 1.5 : e.strong ? 1.1 : 0.7}
                  strokeOpacity={dim ? 0.09 : lit ? 0.8 : e.strong ? 0.32 : 0.17}
                  strokeLinecap="round"
                  style={{ transition: "stroke-opacity 0.18s, stroke 0.18s" }}
                />
              );
            })}

            {/* گره‌ها */}
            {nodes.map((base) => {
              const n = byId[base.id];
              if (!n || nodeHidden(n)) return null;
              const isSel = n.id === selected;
              const dim = isDimmed(n.id);
              const r = radiusOf(n) * (isSel ? 1.22 : 1);
              const c = toneColor[n.tone];
              const labelOnLeft = n.x < CX;

              return (
                <g key={n.id}
                  onPointerDown={e => { e.stopPropagation(); drag.current = { id: n.id, moved: false }; }}
                  onPointerEnter={() => setHover(n.id)}
                  onPointerLeave={() => setHover(h => h === n.id ? null : h)}
                  style={{ cursor: drag.current?.id === n.id ? "grabbing" : "grab", opacity: dim ? 0.42 : 1, transition: "opacity 0.25s" }}
                >
                  {n.kind === "center" ? (
                    <>
                      <circle cx={n.x} cy={n.y} r={120} fill="url(#coreGlow)" />
                      <circle cx={n.x} cy={n.y} r={r + 13} fill="none" stroke={T.goldLine} strokeWidth={0.7} />
                      <circle cx={n.x} cy={n.y} r={r} fill="url(#coreBody)" />
                    </>
                  ) : (
                    <>
                      <circle cx={n.x} cy={n.y} r={r * 2.6} fill={c} opacity={dim ? 0 : 0.07} />
                      {n.origin === "ai" && (
                        <circle cx={n.x} cy={n.y} r={r + 5} fill="none" stroke={c} strokeWidth={0.8} strokeDasharray="2 3" opacity={dim ? 0.25 : 0.7} />
                      )}
                      <circle cx={n.x} cy={n.y} r={r}
                        fill={n.kind === "primary" ? c : T.panelSolid}
                        stroke={c}
                        strokeWidth={n.kind === "primary" ? 0 : n.kind === "report" ? 2 : 1.4}
                        fillOpacity={n.kind === "primary" ? 0.85 : 1}
                      />
                    </>
                  )}
                  {isSel && <circle cx={n.x} cy={n.y} r={r + 7} fill="none" stroke={T.gold} strokeWidth={1.1} />}
                  <text
                    x={labelOnLeft ? n.x - r - 8 : n.x + r + 8} y={n.y + (n.kind === "center" ? 4 : 3.5)}
                    textAnchor={labelOnLeft ? "end" : "start"}
                    fill={isSel ? T.goldHi : n.kind === "entity" ? T.t2 : T.t1}
                    style={{ fontSize: n.kind === "center" ? 17 : n.kind === "primary" ? 12 : n.kind === "report" ? 11 : 10, fontWeight: n.kind === "center" ? 700 : n.kind === "report" ? 600 : n.kind === "primary" ? 600 : 400, fontFamily: "YekanBakh, sans-serif", pointerEvents: "none" }}
                  >{n.label}</text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* نوار کنترل */}
        <div className="panel" style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 4, padding: 5, borderRadius: T.rPill }}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="جستجو"
            style={{ background: "transparent", border: "none", outline: "none", color: T.t1, fontSize: 11.5, width: 96, padding: "5px 10px", fontFamily: "YekanBakh, sans-serif" }} />
          <span style={{ width: 1, height: 16, background: T.hair }} />
          <button onClick={() => setShowFilter(v => !v)} style={{ ...ctlStyle, color: showFilter || hidden.size ? T.gold : T.t2, background: showFilter ? T.goldDim : "transparent" }}>فیلتر</button>
          <span style={{ width: 1, height: 16, background: T.hair }} />
          <button onClick={() => setZoom(z => Math.min(2, +(z + 0.15).toFixed(2)))} style={ctlStyle}>بزرگ‌نمایی</button>
          <button onClick={() => setZoom(z => Math.max(0.6, +(z - 0.15).toFixed(2)))} style={ctlStyle}>کوچک‌نمایی</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setSelected(nodes[0]?.id ?? null); setQuery(""); setPos(Object.fromEntries(nodes.map(nd => [nd.id, { x: nd.x, y: nd.y }]))); }} style={ctlStyle}>مرکز گراف</button>
          <span style={{ width: 1, height: 16, background: T.hair }} />
          {([["knowledge", "دانش و رصد"], ["execution", "مسئله تا اجرا"]] as Array<[System, string]>).map(([k, label]) => {
            const on = views[k];
            return (
              <button key={k} onClick={() => setViews(v => { const next = { ...v, [k]: !v[k] }; return next.knowledge || next.execution ? next : v; })}
                style={{ ...ctlStyle, color: on ? (k === "execution" ? T.gold : T.mint) : T.t3, background: on ? (k === "execution" ? T.goldDim : "rgba(111,224,192,0.10)") : "transparent", border: `1px solid ${on ? (k === "execution" ? T.goldLine : "rgba(111,224,192,0.28)") : "transparent"}`, borderRadius: T.rPill }}>{label}</button>
            );
          })}
          {/* نشانگر داده‌ی زنده */}
          <span style={{ width: 1, height: 16, background: T.hair }} />
          <span style={{ fontSize: 9, padding: "3px 9px", borderRadius: T.rPill, color: isLive ? T.ok : T.t3, background: isLive ? "rgba(74,222,156,0.10)" : "rgba(255,255,255,0.05)", border: `1px solid ${isLive ? "rgba(74,222,156,0.3)" : T.hair}` }}>
            {isLive ? "داده‌ی زنده" : "داده‌ی نمونه"}
          </span>
        </div>

        {/* پانل فیلتر */}
        {showFilter && (
          <div className="panel anim-fadein" style={{ position: "absolute", top: 64, left: "50%", transform: "translateX(-50%)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 3, minWidth: 168 }}>
            <p style={{ fontSize: 9.5, color: T.t3, margin: "0 0 4px" }}>نمایش خوشه‌ها</p>
            {CLUSTERS.map(d => {
              const on = !hidden.has(d.id);
              return (
                <button key={d.id} onClick={() => setHidden(h => { const n = new Set(h); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: "4px 2px", color: on ? T.t2 : T.t3, fontSize: 11, fontFamily: "YekanBakh, sans-serif" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: on ? toneColor[d.tone] : "transparent", border: `1px solid ${toneColor[d.tone]}` }} />
                    {d.label}
                  </span>
                  <span style={{ fontSize: 9, color: T.t3 }}>{on ? "نمایش" : "پنهان"}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* راهنمای رنگ */}
        <div className="panel graph-legend" style={{ position: "absolute", bottom: 18, left: 18, padding: "10px 13px", display: "flex", flexDirection: "column", gap: 6 }}>
          {([
            ["گزارش و منبع", T.mint, false], ["موجودیت استخراجی", T.sky, false],
            ["هوش استخراجی AI", T.lavender, true], ["ریسک", T.bad, true],
            ["فرصت و نتیجه", T.ok, true], ["موجودیت منتخب", T.gold, false],
          ] as Array<[string, string, boolean]>).map(([label, c, dashed]) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: T.t2 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: dashed ? "transparent" : c, border: dashed ? `1px dashed ${c}` : "none" }} />
              {label}
            </span>
          ))}
        </div>

        {/* نوار فرمان */}
        <div className="panel" style={{ position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)", padding: 9, display: "flex", flexDirection: "column", gap: 8, width: "min(430px, calc(100% - 36px))" }}>
          {sel && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 3px" }}>
              <span style={{ fontSize: 9, color: T.t3 }}>زمینه:</span>
              <span style={{ fontSize: 10, color: T.gold, fontWeight: 600 }}>
                {sel.kind === "center" ? sel.label : `${centerNode?.label ?? ""} / ${sel.label}`}
              </span>
            </div>
          )}
          <input placeholder="درباره این شبکه سؤال کنید..."
            style={{ background: "transparent", border: "none", outline: "none", color: T.t1, fontSize: 12, padding: "4px 6px", fontFamily: "YekanBakh, sans-serif", caretColor: T.gold }} />
          <div style={{ display: "flex", gap: 5, borderTop: `1px solid ${T.hair}`, paddingTop: 8 }}>
            {["منابع", "تحلیل شبکه", "ریسک‌ها", "پیشنهاد اقدام"].map(a => (
              <button key={a} style={{ fontSize: 10, color: T.t2, background: "transparent", border: `1px solid ${T.hair}`, borderRadius: T.rPill, padding: "3px 11px", cursor: "pointer", fontFamily: "YekanBakh, sans-serif", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.goldLine; e.currentTarget.style.color = T.goldHi; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.hair; e.currentTarget.style.color = T.t2; }}
              >{a}</button>
            ))}
          </div>
        </div>
      </div>

      {/* بازرس */}
      {sel && (
        <div className="panel anim-fadein" style={{ width: "26%", minWidth: 236, maxWidth: 340, flexShrink: 0, margin: "16px 16px 16px 0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.hair}` }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: T.t1, margin: 0, lineHeight: 1.45 }}>{sel.label}</p>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: T.t3, cursor: "pointer", fontSize: 16, padding: "0 2px", flexShrink: 0 }}>×</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 9 }}>
              <Tag text={selType} tone={T.gold} />
              {info && <Tag text={info.status} tone={T.ok} />}
              {info && <Tag text={`اولویت ${info.priority}`} tone={T.warn} />}
              <Tag text={sel.origin === "ai" ? "استخراج AI" : "دانش منبع"} tone={sel.origin === "ai" ? T.lavender : T.mint} />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
            {info && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                {info.stats.map(([label, v]) => (
                  <div key={label} style={{ background: "rgba(0,0,0,0.22)", border: `1px solid ${T.hair}`, borderRadius: T.rCtl, padding: "9px 11px" }}>
                    <p style={{ fontSize: 17, fontWeight: 300, color: T.t1, margin: 0, lineHeight: 1 }}>{v}</p>
                    <p style={{ fontSize: 9, color: T.t3, margin: "5px 0 0" }}>{label}</p>
                  </div>
                ))}
              </div>
            )}

            {relations.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: T.t1, fontWeight: 600, margin: "0 0 9px" }}>روابط کلیدی</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {relations.map(r => (
                    <button key={r.id} onClick={() => setSelected(r.id)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: T.rCtl, width: "100%", background: "rgba(0,0,0,0.18)", border: `1px solid ${T.hair}`, cursor: "pointer", fontFamily: "YekanBakh, sans-serif", transition: "border-color 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = T.goldLine; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = T.hair; }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: toneColor[r.tone], flexShrink: 0 }} />
                        <span style={{ fontSize: 10.5, color: T.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                      </span>
                      <span style={{ fontSize: 9, color: T.t3, flexShrink: 0 }}>{r.kind}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p style={{ fontSize: 11, color: T.t1, fontWeight: 600, margin: "0 0 9px", display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.mint, boxShadow: `0 0 7px ${T.mint}` }} />
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
            <button onClick={() => setCardOpen(true)}
              disabled={!intelTypeOf(sel.etype)}
              style={{ width: "100%", background: T.goldDim, border: `1px solid ${T.goldLine}`, color: T.gold, borderRadius: T.rCtl, padding: "9px 0", fontSize: 11.5, fontWeight: 600, cursor: intelTypeOf(sel.etype) ? "pointer" : "default", opacity: intelTypeOf(sel.etype) ? 1 : 0.4, fontFamily: "YekanBakh, sans-serif" }}>
              مشاهده پرونده کامل
            </button>
          </div>
        </div>
      )}

      {/* کارت هوشمندی */}
      {cardOpen && sel && intelTypeOf(sel.etype) && (
        <div style={{ position: "absolute", inset: 0, zIndex: 5, background: "rgba(3,9,7,0.55)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setCardOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ maxHeight: "100%", display: "flex" }}>
            <EntityIntelCard id={sel.id} title={sel.label} type={intelTypeOf(sel.etype)!} onClose={() => setCardOpen(false)} onShowInGraph={() => setCardOpen(false)}
              related={relations.slice(0, 5).map(r => ({ label: r.label, kind: r.kind, tone: toneColor[r.tone] }))} />
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ text, tone }: { text: string; tone: string }) {
  return <span style={{ fontSize: 9.5, fontWeight: 600, color: tone, background: `${tone}18`, border: `1px solid ${tone}3A`, borderRadius: T.rPill, padding: "2px 9px", whiteSpace: "nowrap" }}>{text}</span>;
}

function Insight({ label, text, tone }: { label: string; text: string; tone: string }) {
  return (
    <div style={{ borderRight: `2px solid ${tone}`, paddingRight: 10 }}>
      <p style={{ fontSize: 9.5, color: tone, margin: "0 0 3px", fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 10.5, color: T.t2, margin: 0, lineHeight: 1.85 }}>{text}</p>
    </div>
  );
}
