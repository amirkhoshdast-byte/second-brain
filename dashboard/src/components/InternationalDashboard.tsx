"use client";

import { useEffect, useMemo, useState } from "react";
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

type IntelData = {
  ready: boolean;
  documents?: number; recent?: number; countries?: number; confidence?: number;
  entities?: { topic: number; person: number; org: number; event: number };
  signals?: Array<{ id: number; stype: string; title: string; description: string;
                    country: string | null; topic: string | null;
                    importance: string | null; confidence: number;
                    direction: string | null; evidence: number }>;
  regions?: Array<{ region: string; n: number }>;
  flow?: Array<{ m: string; n: number }>;
  datedDocuments?: number;
  undatedDocuments?: number;
  sources?: Array<{ src: string; n: number }>;
};

const stypeTone: Record<string, string> = {
  trend: T.lavender, signal: T.lavender, insight: T.sky,
  risk: T.bad, opportunity: T.ok,
};
const stypeFa: Record<string, string> = {
  trend: "روند", signal: "سیگنال", insight: "بینش",
  risk: "ریسک", opportunity: "فرصت",
};

export default function InternationalDashboard({
  reportCount, onOpenGraph, onOpenChat,
}: { reportCount: number | null; onOpenGraph?: () => void; onOpenChat?: () => void }) {
  const [range, setRange] = useState<"هفته" | "ماه" | "فصل">("ماه");
  const [scope] = useState<Scope>({ level: "جهان", label: "همه مناطق" });
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  /**
   * خروجی خط لوله. تا وقتی استخراج اجرا نشده، ready=false می‌ماند و صفحه
   * به‌جای نمایش عدد نمونه، صریح می‌گوید محاسبه نشده.
   */
  const [intel, setIntel] = useState<IntelData | null>(null);
  useEffect(() => {
    fetch("/api/intel").then((r) => r.json()).then(setIntel).catch(() => setIntel({ ready: false }));
  }, []);
  const live = intel?.ready ? intel : null;

  /**
   * پوشش تاریخ واقعی.
   *
   * در آزمایش با پیکره‌ی کامل، فقط ۲ از ۴۹۲ سند تاریخ گزارش داشتند — بقیه
   * هیچ تاریخی در frontmatter یا بخش Source ندارند. با پوشش زیر ۱۰٪ رسم
   * نمودار جریان زمانی گمراه‌کننده است (حتی با محور واقعی، چند نقطه‌ی پراکنده
   * چیزی نشان نمی‌دهد)، پس به‌جایش پیام صریح + توزیع واقعی دیگر (منبع) نشان
   * داده می‌شود.
   */
  const dateCoverage = live && live.documents
    ? (live.datedDocuments ?? 0) / live.documents
    : 0;
  const hasReliableFlow = dateCoverage >= 0.1;

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
        {/* وضعیت خط لوله صریح اعلام می‌شود؛ «صفر» و «محاسبه نشده» یکی نیستند */}
        <span style={{
          fontSize: 9, borderRadius: T.rPill, padding: "3px 10px",
          color: live ? T.ok : T.warn,
          background: live ? "rgba(74,222,156,0.10)" : "rgba(232,180,74,0.10)",
          border: `1px solid ${live ? "rgba(74,222,156,0.3)" : "rgba(232,180,74,0.3)"}`,
        }}>
          {live ? `استخراج فعال · ${live.documents} سند` : "خط لوله اجرا نشده — اعداد نمونه"}
        </span>
        <span style={{ flex: 1 }} />
        {["بازه زمانی", "منطقه", "کشور", "نمایندگی", "واحد ستادی", "موضوع", "نوع منبع"].map((f) => (
          <button key={f} onClick={() => setActiveFilter(v => v === f ? null : f)}
            style={{ ...filterBtn, color: activeFilter === f ? T.gold : undefined, borderColor: activeFilter === f ? T.goldLine : undefined }}>
            {f} ▾
            {activeFilter === f && (
              <span style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: T.panelSolid, border: `1px solid ${T.hair}`, borderRadius: 8, padding: "8px 14px", whiteSpace: "nowrap", fontSize: 10, color: T.t3, zIndex: 10 }}>
                این فیلتر در نسخه‌ی بعدی فعال می‌شود
              </span>
            )}
          </button>
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
              <Gauge value={live ? Math.round((live.confidence ?? 0) * 100) : 78} size={190} tone={T.mint} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 6 }}>
              {[
                [String(live?.countries ?? "۵۴"), "کشور دارای گزارش"],
                [String(live?.entities?.org ?? "۱۹"), "سازمان شناسایی‌شده"],
                [String(live?.entities?.person ?? "۹۱"), "شخص شناسایی‌شده"],
                [String(live?.entities?.topic ?? "۶۸"), "موضوع فعال"],
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
              }}>{live ? `${live.signals?.length ?? 0} یافته` : "۲۴ جدید"}</span>
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
              [String(live?.documents ?? reportCount ?? "—"), "گزارش", T.mint],
              [String(live?.countries ?? "۵۴"), "کشور", T.sky],
              [String(live?.entities?.topic ?? "۳۷"), "موضوع", T.sky],
              [String(live?.entities?.event ?? "۱۱۲"), "رویداد", T.gold],
              [String(live?.signals?.length ?? "۲۴"), "سیگنال", T.lavender],
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

          {/* نمودار لایه‌ای — فقط وقتی پوشش تاریخ واقعی کافی است */}
          <Card style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            {!live || hasReliableFlow ? (
              <>
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
              </>
            ) : (
              /*
                پوشش تاریخ واقعی زیر ۱۰٪ است (در آزمایش: ۲ از ۴۹۲ سند). رسم
                نمودار زمانی با این داده گمراه‌کننده است — چه با fallback
                نادرست (که همه را در یک روز جمع می‌کرد) چه با محور واقعی
                (که فقط دو نقطه‌ی پراکنده نشان می‌دهد). به‌جایش توزیع واقعی
                دیگری (منبع گزارش) که از داده‌ی کامل ساخته می‌شود نشان
                داده می‌شود.
              */
              <>
                <CardTitle>جریان گزارش و تحولات بین‌الملل</CardTitle>
                <div style={{
                  marginTop: 8, padding: "8px 11px", borderRadius: T.rCtl,
                  background: "rgba(232,180,74,0.08)", border: `1px solid rgba(232,180,74,0.25)`,
                }}>
                  <p style={{ fontSize: 10, color: T.warn, margin: 0, lineHeight: 1.7 }}>
                    فقط {live.datedDocuments ?? 0} از {live.documents} سند تاریخ گزارش دارند؛
                    نمودار روند زمانی با این پوشش قابل‌اتکا نیست. به‌جایش توزیع اسناد
                    بر اساس منبع نمایش داده می‌شود.
                  </p>
                </div>
                <div style={{ flex: 1, minHeight: 0, marginTop: 12, overflowY: "auto" }}>
                  <SourceBars sources={live.sources ?? []} />
                </div>
              </>
            )}
          </Card>
        </div>

        {/* ══ راست — توجه مدیریتی ══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", minHeight: 0 }}>
          <Card>
            <CardTitle>نیازمند توجه</CardTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              {(live?.signals?.length
                ? live.signals.slice(0, 6).map((s) => ({
                    kind: stypeFa[s.stype] ?? s.stype,
                    title: s.title,
                    country: s.country ?? "چند کشور",
                    topic: s.topic ?? `${s.evidence} سند شاهد`,
                    weight: s.importance ?? "متوسط",
                    trend: s.direction ?? "flat",
                    conf: Math.round(s.confidence * 100),
                    tone: stypeTone[s.stype] ?? T.lavender,
                  }))
                : ATTENTION
              ).map((a) => (
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
              {(live?.regions?.length
                ? (() => {
                    const max = Math.max(...live.regions.map((x) => x.n));
                    return live.regions.map((x) => ({
                      label: x.region,
                      v: Math.round((x.n / max) * 100),
                      dir: "flat",
                    }));
                  })()
                : REGIONS
              ).map((r) => (
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
              <button onClick={onOpenChat} style={{
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

/** توزیع واقعی اسناد بر اساس منبع — جایگزین صادقانه وقتی پوشش تاریخ ناکافی است */
function SourceBars({ sources }: { sources: Array<{ src: string; n: number }> }) {
  if (sources.length === 0) {
    return <p style={{ fontSize: 11, color: T.t3, textAlign: "center", marginTop: 30 }}>داده‌ای برای نمایش نیست</p>;
  }
  const max = Math.max(...sources.map((s) => s.n));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sources.map((s) => (
        <div key={s.src}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10.5, color: T.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{s.src}</span>
            <span style={{ fontSize: 10, color: T.t3, fontFamily: "monospace" }}>{s.n}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
            <div style={{ width: `${(s.n / max) * 100}%`, height: "100%", background: T.mint, borderRadius: 3, opacity: 0.75 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * نمودار لایه‌ای انباشته.
 *
 * انباشته است نه خطوط جدا، چون پیام صفحه «حجم ورودی که به هوش تبدیل می‌شود»
 * است؛ لایه‌های AI بالای لایه‌های گزارش می‌نشینند تا این تبدیل دیده شود.
 *
 * توجه: این نمودار همیشه با داده‌ی نمونه (FLOW) رسم می‌شود، نه خروجی واقعی
 * خط لوله — چون در محصول فعلی هیچ ستون schema بین «گزارش نمایندگی/ستادی/
 * بیرونی» تفکیک نمی‌کند. با پوشش تاریخ ناکافی (حالت رایج فعلی)، این کامپوننت
 * اصلاً رندر نمی‌شود؛ به‌جایش SourceBars با داده‌ی واقعی نشان داده می‌شود.
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
  fontFamily: "YekanBakh, sans-serif", whiteSpace: "nowrap", position: "relative",
};
