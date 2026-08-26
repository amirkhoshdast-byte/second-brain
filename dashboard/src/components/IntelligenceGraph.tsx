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
 * دو نظام رابطه در یک شبکه هم‌زیست‌اند:
 *   دانش   : کشور → موضوع → سازمان → شخص → گزارش → رویداد → شواهد
 *   اجرا   : مسئله → جلسه → تصمیم → مصوبه → مسئول → اقدام → پروژه → مانع → نتیجه
 */

type Tone = "teal" | "gold" | "blue" | "risk" | "done";
type Kind = "center" | "domain" | "entity";
type System = "knowledge" | "execution";

type GNode = {
  id: string;
  label: string;
  kind: Kind;
  tone: Tone;
  /** دامنه‌ی والد — برای خوشه‌بندی فضایی و فیلتر */
  domain?: string;
  x: number;
  y: number;
};

type GEdge = {
  from: string;
  to: string;
  system: System;
  /** روابط مهم پررنگ‌تر دیده می‌شوند */
  strong?: boolean;
};

const toneColor: Record<Tone, string> = {
  teal: T.mint,
  gold: T.gold,
  blue: T.sky,
  risk: T.bad,
  done: T.ok,
};

// ─── چیدمان ───────────────────────────────────────────────────────────────────
const CX = 500;
const CY = 400;
const R_DOMAIN = 186;
const R_ENTITY = 322;

/** زاویه بر حسب درجه، ساعتگرد از بالا */
function polar(deg: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

const DOMAINS: Array<{ id: string; label: string; deg: number; tone: Tone }> = [
  { id: "d-countries", label: "کشورها",    deg: 0,   tone: "blue" },
  { id: "d-topics",    label: "موضوعات",   deg: 40,  tone: "teal" },
  { id: "d-orgs",      label: "سازمان‌ها", deg: 80,  tone: "teal" },
  { id: "d-people",    label: "اشخاص",     deg: 120, tone: "teal" },
  { id: "d-reports",   label: "گزارش‌ها",  deg: 160, tone: "teal" },
  { id: "d-issues",    label: "مسائل",     deg: 200, tone: "gold" },
  { id: "d-decisions", label: "مصوبات",    deg: 240, tone: "gold" },
  { id: "d-projects",  label: "پروژه‌ها",  deg: 280, tone: "blue" },
  { id: "d-events",    label: "رویدادها",  deg: 320, tone: "teal" },
];

/** موجودیت‌های سطح دوم — عمداً نمونه‌ای، نه کل پایگاه دانش */
const ENTITIES: Array<{ id: string; label: string; domain: string; deg: number; r?: number; tone?: Tone }> = [
  { id: "e-indonesia",  label: "اندونزی",              domain: "d-countries", deg: -14 },
  { id: "e-turkey",     label: "ترکیه",                domain: "d-countries", deg: 12 },
  { id: "e-afg",        label: "افغانستان",            domain: "d-countries", deg: 34, r: 300 },

  { id: "e-farsi",      label: "توسعه زبان فارسی",     domain: "d-topics",    deg: 30 },
  { id: "e-culdip",     label: "دیپلماسی فرهنگی",      domain: "d-topics",    deg: 56 },

  { id: "e-unesco",     label: "یونسکو",               domain: "d-orgs",      deg: 72 },
  { id: "e-diyanet",    label: "دیانت ترکیه",          domain: "d-orgs",      deg: 96 },

  { id: "e-rayzan",     label: "رایزن فرهنگی جاکارتا", domain: "d-people",    deg: 120 },

  { id: "e-rep-heri",   label: "میراث فرهنگی پاکستان", domain: "d-reports",   deg: 150 },
  { id: "e-rep-afg",    label: "بحران بشری افغانستان", domain: "d-reports",   deg: 174, r: 300 },

  { id: "e-issue-farsi", label: "توسعه زبان فارسی در اندونزی", domain: "d-issues", deg: 202, r: 300, tone: "gold" },
  { id: "e-issue-heri",  label: "حفاظت میراث مشترک",           domain: "d-issues", deg: 224 },

  { id: "e-dec-chair",  label: "مصوبه کرسی زبان فارسی", domain: "d-decisions", deg: 246, tone: "gold" },

  { id: "e-prj-chair",  label: "کرسی‌های زبان فارسی",  domain: "d-projects",  deg: 274, tone: "blue" },
  { id: "e-risk-staff", label: "کمبود استاد اعزامی",   domain: "d-projects",  deg: 296, r: 300, tone: "risk" },
  { id: "e-res-three",  label: "راه‌اندازی ۳ کرسی",    domain: "d-projects",  deg: 258, r: 392, tone: "done" },

  { id: "e-ev-week",    label: "هفته فرهنگی جاکارتا",  domain: "d-events",    deg: 322 },
];

const NODES: GNode[] = [
  { id: "iran", label: "ایران", kind: "center", tone: "gold", x: CX, y: CY },
  ...DOMAINS.map((d) => {
    const p = polar(d.deg, R_DOMAIN);
    return { id: d.id, label: d.label, kind: "domain" as Kind, tone: d.tone, x: p.x, y: p.y };
  }),
  ...ENTITIES.map((e) => {
    const p = polar(e.deg, e.r ?? R_ENTITY);
    return {
      id: e.id, label: e.label, kind: "entity" as Kind,
      tone: e.tone ?? "teal", domain: e.domain, x: p.x, y: p.y,
    };
  }),
];

const EDGES: GEdge[] = [
  // ایران به دامنه‌ها
  ...DOMAINS.map((d) => ({ from: "iran", to: d.id, system: "knowledge" as System, strong: true })),

  // دامنه به موجودیت
  { from: "d-countries", to: "e-indonesia", system: "knowledge", strong: true },
  { from: "d-countries", to: "e-turkey",    system: "knowledge" },
  { from: "d-countries", to: "e-afg",       system: "knowledge" },
  { from: "d-topics",    to: "e-farsi",     system: "knowledge", strong: true },
  { from: "d-topics",    to: "e-culdip",    system: "knowledge" },
  { from: "d-orgs",      to: "e-unesco",    system: "knowledge" },
  { from: "d-orgs",      to: "e-diyanet",   system: "knowledge" },
  { from: "d-people",    to: "e-rayzan",    system: "knowledge" },
  { from: "d-reports",   to: "e-rep-heri",  system: "knowledge" },
  { from: "d-reports",   to: "e-rep-afg",   system: "knowledge" },
  { from: "d-issues",    to: "e-issue-farsi", system: "execution", strong: true },
  { from: "d-issues",    to: "e-issue-heri",  system: "execution" },
  { from: "d-decisions", to: "e-dec-chair",   system: "execution" },
  { from: "d-projects",  to: "e-prj-chair",   system: "execution" },
  { from: "d-events",    to: "e-ev-week",     system: "knowledge" },

  // زنجیره‌ی دانش: کشور → موضوع → سازمان/شخص → گزارش → رویداد
  { from: "e-indonesia", to: "e-farsi",    system: "knowledge", strong: true },
  { from: "e-farsi",     to: "e-rayzan",   system: "knowledge" },
  { from: "e-indonesia", to: "e-ev-week",  system: "knowledge" },
  { from: "e-turkey",    to: "e-diyanet",  system: "knowledge" },
  { from: "e-turkey",    to: "e-culdip",   system: "knowledge" },
  { from: "e-culdip",    to: "e-unesco",   system: "knowledge" },
  { from: "e-rep-heri",  to: "e-unesco",   system: "knowledge" },
  { from: "e-afg",       to: "e-rep-afg",  system: "knowledge" },

  // زنجیره‌ی اجرا: مسئله → مصوبه → مسئول → پروژه → مانع / نتیجه
  { from: "e-issue-farsi", to: "e-dec-chair",  system: "execution", strong: true },
  { from: "e-dec-chair",   to: "e-rayzan",     system: "execution" },
  { from: "e-dec-chair",   to: "e-prj-chair",  system: "execution", strong: true },
  { from: "e-prj-chair",   to: "e-risk-staff", system: "execution" },
  { from: "e-prj-chair",   to: "e-res-three",  system: "execution" },
  { from: "e-issue-farsi", to: "e-indonesia",  system: "execution" },
  { from: "e-issue-heri",  to: "e-rep-heri",   system: "execution" },
];

function radiusOf(n: GNode) {
  return n.kind === "center" ? 34 : n.kind === "domain" ? 15 : 9;
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

// ─── جزئیات پنل بازرسی ────────────────────────────────────────────────────────
const INSPECTOR: Record<string, {
  type: string; status: string; priority: string;
  stats: Array<[string, string]>;
  relations: Array<{ label: string; kind: string; tone: Tone }>;
  ai: { summary: string; opportunity: string; risk: string; action: string };
}> = {
  "e-issue-farsi": {
    type: "مسئله راهبردی",
    status: "فعال",
    priority: "بالا",
    stats: [
      ["گزارش مرتبط", "۲۸"],
      ["فرد کلیدی", "۱۷"],
      ["سازمان مرتبط", "۹"],
      ["تصمیم باز", "۴"],
      ["پیشرفت اجرا", "۶۸٪"],
      ["ریسک مهم", "۳"],
    ],
    relations: [
      { label: "اندونزی",               kind: "کشور",   tone: "blue" },
      { label: "مصوبه کرسی زبان فارسی", kind: "مصوبه",  tone: "gold" },
      { label: "کرسی‌های زبان فارسی",   kind: "پروژه",  tone: "blue" },
      { label: "رایزن فرهنگی جاکارتا",  kind: "مسئول",  tone: "teal" },
      { label: "کمبود استاد اعزامی",    kind: "مانع",   tone: "risk" },
      { label: "راه‌اندازی ۳ کرسی",     kind: "نتیجه",  tone: "done" },
    ],
    ai: {
      summary: "کرسی‌های زبان فارسی در سه دانشگاه اندونزی فعال شده‌اند و پوشش رسانه‌ای مثبت داشته‌اند، اما تأمین استاد اعزامی از ابتدای دوره عقب است.",
      opportunity: "علاقه‌ی دانشگاه‌های جاوه‌ی شرقی به گسترش دوره‌ها فرصت افزودن دو کرسی دیگر بدون هزینه‌ی زیرساخت جدید را فراهم می‌کند.",
      risk: "بدون جذب استاد تا پایان فصل، دوره‌های ترم آینده تعطیل می‌شوند و پیشرفت ۶۸٪ برگشت‌پذیر است.",
      action: "تخصیص دو استاد از ظرفیت داخلی و بازبینی مصوبه برای مجوز جذب محلی.",
    },
  },
};

const DEFAULT_INSPECTOR = {
  type: "موجودیت",
  status: "فعال",
  priority: "متوسط",
  stats: [["روابط مستقیم", "—"]] as Array<[string, string]>,
  relations: [] as Array<{ label: string; kind: string; tone: Tone }>,
  ai: {
    summary: "برای این موجودیت هنوز تحلیل ساخته نشده است.",
    opportunity: "—",
    risk: "—",
    action: "—",
  },
};

// ─── کامپوننت ─────────────────────────────────────────────────────────────────
/** مختصات اولیه‌ی هر گره، جدا از تعریف ثابتش تا قابل جابه‌جایی بماند */
function initialPositions(): Record<string, { x: number; y: number }> {
  return Object.fromEntries(NODES.map((n) => [n.id, { x: n.x, y: n.y }]));
}

export default function IntelligenceGraph() {
  const [selected, setSelected] = useState<string | null>("e-issue-farsi");
  const [views, setViews] = useState<Record<System, boolean>>({ knowledge: true, execution: true });
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

  const nodeHidden = (n: GNode) => n.domain !== undefined && hidden.has(n.domain);

  const sel = selected ? byId[selected] : null;
  const info = (selected && INSPECTOR[selected]) || DEFAULT_INSPECTOR;

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
                      <circle
                        cx={n.x} cy={n.y} r={r}
                        fill={n.kind === "domain" ? c : T.panelSolid}
                        stroke={c}
                        strokeWidth={n.kind === "domain" ? 0 : 1.4}
                        fillOpacity={n.kind === "domain" ? 0.85 : 1}
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
                      fontSize: n.kind === "center" ? 17 : n.kind === "domain" ? 12.5 : 10.5,
                      fontWeight: n.kind === "center" ? 700 : n.kind === "domain" ? 600 : 400,
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
          {([["knowledge", "دانش"], ["execution", "مسئله تا اجرا"]] as Array<[System, string]>).map(([k, label]) => {
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
            <p style={{ fontSize: 9.5, color: T.t3, margin: "0 0 4px" }}>نمایش دامنه‌ها</p>
            {DOMAINS.map((d) => {
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
            ["دانش و داده", T.mint],
            ["موجودیت منتخب", T.gold],
            ["کشور و پروژه", T.sky],
            ["ریسک و مانع", T.bad],
            ["نتیجه محقق‌شده", T.ok],
          ] as Array<[string, string]>).map(([label, c]) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: T.t2 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, flexShrink: 0 }} />
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
                {sel.domain ? `${DOMAINS.find((d) => d.id === sel.domain)?.label} / ` : ""}{sel.label}
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
              <Tag text={info.type} tone={T.gold} />
              <Tag text={info.status} tone={T.ok} />
              <Tag text={`اولویت ${info.priority}`} tone={T.warn} />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
            {/* شاخص‌ها */}
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

            {/* روابط کلیدی */}
            {info.relations.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: T.t1, fontWeight: 600, margin: "0 0 9px" }}>روابط کلیدی</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {info.relations.map((r) => (
                    <div key={r.label} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "7px 10px", borderRadius: T.rCtl,
                      background: "rgba(0,0,0,0.18)", border: `1px solid ${T.hair}`,
                    }}>
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
                    </div>
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
                <Insight label="خلاصه"          text={info.ai.summary}     tone={T.t2} />
                <Insight label="فرصت"           text={info.ai.opportunity} tone={T.ok} />
                <Insight label="ریسک"           text={info.ai.risk}        tone={T.bad} />
                <Insight label="اقدام پیشنهادی" text={info.ai.action}      tone={T.gold} />
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
