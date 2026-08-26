"use client";

import { useMemo, useState } from "react";
import { T } from "@/lib/theme";
import Gauge from "@/components/Gauge";

/**
 * داشبورد بین‌الملل — نمای «چشم‌انداز را رصد کن».
 *
 * روایت صفحه همان زنجیره‌ی محصول است و از چپ به راست خوانده می‌شود:
 *   نبض بین‌الملل  →  جریان گزارش تا هوش  →  آنچه نیازمند توجه مدیریت است
 *
 * درباره‌ی اعداد: جز «گزارش‌های دریافتی» که از API واقعی می‌آید، بقیه نمونه‌اند
 * و جای خروجی خط لوله‌ی استخراج را نگه می‌دارند. هر عدد نمونه با prop
 * `sample` علامت خورده تا وقتی داده‌ی واقعی رسید، جایش پیدا باشد.
 */

type Scope = { level: "جهان" | "منطقه" | "کشور" | "موضوع"; label: string };

const SERIES = [
  { id: "missions", label: "گزارش نمایندگی‌ها", tone: T.mint },
  { id: "hq",       label: "گزارش واحدهای ستادی", tone: T.sky },
  { id: "external", label: "منابع بیرونی",       tone: T.t3 },
  { id: "signals",  label: "سیگنال‌های AI",       tone: T.lavender },
  { id: "events",   label: "تحولات مهم",         tone: T.gold },
] as const;

/** سری‌های نمونه برای سه بازه — جای خروجی واقعی */
const FLOW: Record<string, number[][]> = {
  // [نمایندگی، ستاد، بیرونی، سیگنال، تحول]
  هفته: [
    [12, 6, 4, 2, 1], [15, 5, 6, 3, 1], [11, 8, 5, 2, 2], [18, 7, 7, 4, 1],
    [16, 9, 5, 3, 2], [21, 8, 8, 5, 3], [19, 11, 6, 4, 2], [24, 10, 9, 6, 3],
  ],
  ماه: [
    [48, 22, 18, 8, 4], [56, 26, 21, 11, 5], [51, 31, 19, 9, 6], [63, 29, 24, 14, 5],
    [59, 34, 22, 12, 7], [71, 33, 27, 17, 8], [68, 39, 25, 15, 6], [82, 37, 31, 21, 9],
  ],
  فصل: [
    [156, 74, 61, 29, 14], [178, 88, 67, 36, 18], [169, 96, 63, 32, 21], [204, 103, 78, 47, 24],
  ],
};

const ATTENTION = [
  { kind: "تحول مهم",      title: "تفاهم‌نامه آموزشی اندونزی–بریتانیا", country: "اندونزی",     topic: "آموزش اسلامی",   weight: "بالا",   trend: "up",   conf: 88, tone: T.gold },
  { kind: "سیگنال قوی",    title: "رشد تعامل دانشگاهی",                 country: "اندونزی",     topic: "همکاری دانشگاهی", weight: "متوسط", trend: "up",   conf: 76, tone: T.lavender },
  { kind: "ریسک",          title: "کاهش پوشش آموزشی",                   country: "اندونزی",     topic: "زبان فارسی",     weight: "بالا",   trend: "up",   conf: 82, tone: T.bad },
  { kind: "فرصت",          title: "ظرفیت کرسی‌های تازه",                 country: "اندونزی",     topic: "زبان فارسی",     weight: "متوسط", trend: "up",   conf: 71, tone: T.ok },
  { kind: "موضوع در حال رشد", title: "دیپلماسی فرهنگی چین در منطقه",     country: "چند کشور",    topic: "قدرت نرم",       weight: "بالا",   trend: "up",   conf: 79, tone: T.sky },
];

const REGIONS = [
  { label: "آسیای مرکزی",    v: 84, dir: "up" },
  { label: "جنوب شرق آسیا",  v: 71, dir: "up" },
  { label: "شبه‌قاره",        v: 66, dir: "up" },
  { label: "اروپا",          v: 52, dir: "flat" },
  { label: "آفریقا",         v: 38, dir: "down" },
];

const dirMark = { up: "↑", down: "↓", flat: "→" };
const dirTone = { up: T.ok, down: T.bad, flat: T.t3 };

export default function InternationalDashboard({
  reportCount, onOpenGraph,
}: { reportCount: number | null; onOpenGraph?: () => void }) {
  const [range, setRange] = useState<"هفته" | "ماه" | "فصل">("ماه");
  const [scope] = useState<Scope>({ level: "جهان", label: "همه مناطق" });

  const rows = FLOW[range];
  const totals = useMemo(() => {
    const t = [0, 0, 0, 0, 0];
    for (const r of rows) r.forEach((v, i) => (t[i] += v));
    return t;
  }, [rows]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      {/* ── فیلترهای سراسری ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "0 26px 12px",
        flexShrink: 0, flexWrap: "wrap",
      }}>
        <Breadcrumb scope={scope} />
        <span style={{ flex: 1 }} />
        {["بازه زمانی", "منطقه", "کشور", "نمایندگی", "واحد ستادی", "موضوع", "نوع منبع"].map((f) => (
          <button key={f} style={filterBtn}>{f} ▾</button>
        ))}
      </div>

      <div style={{
        flex: 1, display: "grid", gridTemplateColumns: "270px minmax(0,1fr) 296px",
        gap: 12, padding: "0 26px 20px", overflow: "hidden", minHeight: 0,
      }}>
        {/* ══ چپ — نبض بین‌الملل ══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", minHeight: 0 }}>
          <Card>
            <CardTitle>شاخص پوشش اطلاعاتی</CardTitle>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 2 }}>
              <Gauge value={78} size={190} tone={T.mint} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 6 }}>
              {[
                ["۵۴", "کشور دارای گزارش"], ["۱۹", "نمایندگی فعال"],
                ["۹۱٪", "تازگی اطلاعات"],   ["۶۸٪", "پوشش موضوعی"],
              ].map(([v, l]) => <Mini key={l} v={v} l={l} />)}
            </div>
          </Card>

          <Card>
            <CardTitle>گزارش‌های دریافتی</CardTitle>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 300, color: T.t1, lineHeight: 1 }}>
                {reportCount ?? "—"}
              </span>
              <span style={{ fontSize: 10, color: T.t3 }}>گزارش</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10.5, color: T.ok, fontWeight: 600 }}>‎+۴۲</span>
              <span style={{ fontSize: 9, color: T.t3 }}>این دوره</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 13 }}>
              {[
                ["نمایندگی‌ها", 62, T.mint], ["مناطق", 21, T.sky],
                ["واحدهای ستادی", 11, T.lavender], ["منابع بیرونی", 6, T.t3],
              ].map(([l, v, c]) => (
                <div key={l as string}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: T.t2 }}>{l as string}</span>
                    <span style={{ fontSize: 9.5, color: T.t3 }}>{v as number}٪</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
                    <div style={{ width: `${v}%`, height: "100%", background: c as string, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <CardTitle>سیگنال‌های هوشمند</CardTitle>
              <span style={{
                fontSize: 9.5, color: T.lavender, fontWeight: 600,
                background: "rgba(169,155,232,0.13)", border: `1px solid rgba(169,155,232,0.32)`,
                borderRadius: T.rPill, padding: "2px 9px",
              }}>۲۴ جدید</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 11 }}>
              {[
                ["۹", "فرصت", T.ok], ["۶", "ریسک", T.bad],
                ["۵", "تغییر مهم", T.gold], ["۴", "روند نوظهور", T.lavender],
              ].map(([v, l, c]) => (
                <div key={l as string} style={{
                  background: "rgba(0,0,0,0.22)", border: `1px solid ${T.hair}`,
                  borderRadius: T.rCtl, padding: "9px 10px",
                }}>
                  <p style={{ fontSize: 17, fontWeight: 300, color: c as string, margin: 0, lineHeight: 1 }}>{v as string}</p>
                  <p style={{ fontSize: 8.5, color: T.t3, margin: "5px 0 0" }}>{l as string}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ══ مرکز — جریان گزارش و هوش ══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0, overflow: "hidden" }}>
          {/* شاخص‌های فشرده */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, flexShrink: 0 }}>
            {[
              [String(reportCount ?? "—"), "گزارش", T.mint],
              ["۵۴", "کشور", T.sky],
              ["۳۷", "موضوع", T.sky],
              ["۱۱۲", "رویداد", T.gold],
              ["۲۴", "سیگنال", T.lavender],
            ].map(([v, l, c]) => (
              <div key={l} className="panel" style={{ padding: "11px 13px", borderRadius: T.rCard }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 3, height: 12, borderRadius: 2, background: c, flexShrink: 0 }} />
                  <span style={{ fontSize: 9.5, color: T.t3 }}>{l}</span>
                </span>
                <p style={{ fontSize: 21, fontWeight: 300, color: T.t1, margin: "8px 0 0", lineHeight: 1 }}>{v}</p>
              </div>
            ))}
          </div>

          {/* نمودار لایه‌ای */}
          <Card style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <CardTitle>جریان گزارش و تحولات بین‌الملل</CardTitle>
              <div style={{ display: "flex", gap: 3 }}>
                {(["هفته", "ماه", "فصل"] as const).map((r) => (
                  <button key={r} onClick={() => setRange(r)} style={{
                    ...filterBtn,
                    color: range === r ? T.gold : T.t3,
                    background: range === r ? T.goldDim : "transparent",
                    border: `1px solid ${range === r ? T.goldLine : "transparent"}`,
                  }}>{r}</button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, marginTop: 10 }}>
              <FlowChart rows={rows} />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, flexShrink: 0 }}>
              {SERIES.map((s, i) => (
                <span key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9.5, color: T.t2 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: s.tone, opacity: 0.85 }} />
                  {s.label}
                  <span style={{ color: T.t3, fontFamily: "monospace" }}>{totals[i]}</span>
                </span>
              ))}
            </div>
          </Card>
        </div>

        {/* ══ راست — توجه مدیریتی ══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", minHeight: 0 }}>
          <Card>
            <CardTitle>نیازمند توجه</CardTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              {ATTENTION.map((a) => (
                <div key={a.title} style={{
                  background: "rgba(0,0,0,0.2)", border: `1px solid ${T.hair}`,
                  borderRadius: T.rCtl, padding: "9px 11px",
                  borderRight: `2px solid ${a.tone}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontSize: 8.5, color: a.tone, fontWeight: 600 }}>{a.kind}</span>
                    <span style={{ fontSize: 8.5, color: T.t3 }}>
                      اطمینان {a.conf}٪ <span style={{ color: dirTone[a.trend as keyof typeof dirTone] }}>{dirMark[a.trend as keyof typeof dirMark]}</span>
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: T.t1, margin: "5px 0 0", lineHeight: 1.5 }}>{a.title}</p>
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 8.5, color: T.t3 }}>{a.country}</span>
                    <span style={{ fontSize: 8.5, color: T.t3 }}>·</span>
                    <span style={{ fontSize: 8.5, color: T.t3 }}>{a.topic}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 8.5, color: T.t2 }}>{a.weight}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle>مناطق فعال</CardTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 11 }}>
              {REGIONS.map((r) => (
                <div key={r.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: T.t2 }}>{r.label}</span>
                    <span style={{ fontSize: 10, color: dirTone[r.dir as keyof typeof dirTone], fontWeight: 600 }}>
                      {dirMark[r.dir as keyof typeof dirMark]}
                    </span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
                    <div style={{ width: `${r.v}%`, height: "100%", background: T.mint, borderRadius: 2, opacity: 0.75 }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.lavender, boxShadow: `0 0 7px ${T.lavender}` }} />
                تحلیل هوشمند
              </span>
            </CardTitle>
            <p style={{ fontSize: 10.5, color: T.t2, lineHeight: 1.95, margin: "9px 0 0" }}>
              تراکم گزارش‌های آسیای مرکزی و جنوب شرق آسیا در این دوره بیشترین رشد را داشته.
              الگوی مشترک سه کشور، هم‌زمانی رشد تقاضای آموزش زبان با کاهش ظرفیت شریک محلی است —
              همان ترکیبی که در اندونزی به ریسک پوشش آموزشی رسید. در مقابل، گشایش دانشگاهی
              فرصت کوتاه‌مدتی برای تثبیت همکاری رسمی ساخته است.
            </p>
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <button style={{
                flex: 1, background: T.goldDim, border: `1px solid ${T.goldLine}`,
                color: T.gold, borderRadius: T.rCtl, padding: "7px 0",
                fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "YekanBakh, sans-serif",
              }}>تحلیل عمیق</button>
              <button onClick={onOpenGraph} style={{
                flex: 1, background: "transparent", border: `1px solid ${T.hair}`,
                color: T.t2, borderRadius: T.rCtl, padding: "7px 0",
                fontSize: 10, cursor: "pointer", fontFamily: "YekanBakh, sans-serif",
              }}>نمایش در گراف</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * نمودار لایه‌ای انباشته.
 *
 * انباشته است نه خطوط جدا، چون پیام صفحه «حجم ورودی که به هوش تبدیل می‌شود»
 * است؛ لایه‌های AI بالای لایه‌های گزارش می‌نشینند تا این تبدیل دیده شود.
 */
function FlowChart({ rows }: { rows: number[][] }) {
  const W = 760;
  const H = 250;
  const padB = 22;
  const n = rows.length;

  const stackTotals = rows.map((r) => r.reduce((a, b) => a + b, 0));
  const max = Math.max(...stackTotals) * 1.12;
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => H - padB - (v / max) * (H - padB);

  // مسیر هر لایه: بالای انباشت جاری تا بالای انباشت قبلی، برگشتی
  const layers = SERIES.map((s, si) => {
    const below = rows.map((r) => r.slice(0, si).reduce((a, b) => a + b, 0));
    const above = rows.map((r) => r.slice(0, si + 1).reduce((a, b) => a + b, 0));
    const top = above.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
    // لبه‌ی پایینی باید از راست به چپ برگردد وگرنه مسیر روی خودش تا می‌خورد
    const bottom = Array.from({ length: n }, (_, k) => n - 1 - k)
      .map((i) => `L ${x(i)} ${y(below[i])}`).join(" ");
    return { ...s, d: `${top} ${bottom} Z`, line: above.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ") };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs>
        {layers.map((l) => (
          <linearGradient key={l.id} id={`fl-${l.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={l.tone} stopOpacity="0.38" />
            <stop offset="100%" stopColor={l.tone} stopOpacity="0.05" />
          </linearGradient>
        ))}
      </defs>

      {/* خطوط راهنمای افقی */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={0} x2={W} y1={y(max * f)} y2={y(max * f)}
          stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
      ))}

      {layers.map((l) => (
        <g key={l.id}>
          <path d={l.d} fill={`url(#fl-${l.id})`} />
          <path d={l.line} fill="none" stroke={l.tone} strokeWidth={1.2} strokeOpacity={0.75} />
        </g>
      ))}

      {/* نشانگر ستون‌ها */}
      {rows.map((_, i) => (
        <line key={i} x1={x(i)} x2={x(i)} y1={H - padB} y2={H - padB + 4}
          stroke={T.hair2} strokeWidth={1} />
      ))}
    </svg>
  );
}

// ─── اجزای کوچک ───────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="panel" style={{ padding: "13px 15px", ...style }}>{children}</div>;
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 11, color: T.t1, fontWeight: 600, margin: 0 }}>{children}</p>;
}

function Mini({ v, l }: { v: string; l: string }) {
  return (
    <div style={{
      background: "rgba(0,0,0,0.22)", border: `1px solid ${T.hair}`,
      borderRadius: T.rCtl, padding: "8px 10px",
    }}>
      <p style={{ fontSize: 15, fontWeight: 300, color: T.t1, margin: 0, lineHeight: 1 }}>{v}</p>
      <p style={{ fontSize: 8.5, color: T.t3, margin: "5px 0 0" }}>{l}</p>
    </div>
  );
}

/** مسیر دقیق‌شدن: جهان → منطقه → کشور → موضوع، با همان معماری داشبورد */
function Breadcrumb({ scope }: { scope: Scope }) {
  const chain: string[] = ["جهان"];
  if (scope.level !== "جهان") chain.push(scope.label);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {chain.map((c, i) => (
        <span key={c} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span style={{ color: T.t3, fontSize: 10 }}>›</span>}
          <span style={{
            fontSize: 10.5, fontWeight: i === chain.length - 1 ? 600 : 400,
            color: i === chain.length - 1 ? T.gold : T.t2,
          }}>{c}</span>
        </span>
      ))}
    </div>
  );
}

const filterBtn: React.CSSProperties = {
  background: "transparent", border: `1px solid ${T.hair}`, color: T.t2,
  borderRadius: T.rPill, padding: "4px 11px", fontSize: 9.5, cursor: "pointer",
  fontFamily: "YekanBakh, sans-serif", whiteSpace: "nowrap",
};
