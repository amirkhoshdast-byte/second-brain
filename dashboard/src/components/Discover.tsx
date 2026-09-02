"use client";

import { useEffect, useState } from "react";
import { T } from "@/lib/theme";

/* ─── types ─────────────────────────────────────────────── */
type DocCard = {
  id: number; title: string; country: string | null; region: string | null;
  ai_summary: string | null; confidence: number | null;
  extracted_at?: string; entity_count?: number; source_url?: string | null;
};
type EntityTrend = { name: string; etype: string; recent_mentions: number };
type Signal = { id: number; stype: string; title: string; country: string | null; importance: number | null; confidence: number | null };
type Underserved = { country: string; count: number; latest: string | null };
type Stats = { total: number; this_week: number; countries: number };

type DiscoverData = {
  stats: Stats;
  trending: DocCard[];
  underserved: Underserved[];
  spotlight: DocCard[];
  entityTrends: EntityTrend[];
  recentSignals: Signal[];
};

/* ─── constants ─────────────────────────────────────────── */
const ETYPE_COLOR: Record<string, string> = { person: T.gold, org: T.sky, event: T.lavender };
const STYPE_COLOR: Record<string, string> = { trend: T.mint, signal: T.sky, insight: T.lavender, geo_concentration: T.gold };
const CONF_COLOR = (c: number | null) => !c ? T.t3 : c > 0.8 ? T.ok : c > 0.6 ? T.warn : T.bad;

/* ─── sub-components ────────────────────────────────────── */
function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 12, display: "flex", alignItems: "baseline", gap: 10 }}>
      <h2 style={{ color: T.t1, fontSize: 14, fontWeight: 700, margin: 0 }}>{label}</h2>
      {sub && <span style={{ color: T.t3, fontSize: 10 }}>{sub}</span>}
    </div>
  );
}

function ArticleCard({ doc, accent }: { doc: DocCard; accent?: string }) {
  const color = accent ?? T.sky;
  const conf = doc.confidence ?? 0;
  return (
    <div style={{
      borderRadius: T.rCard, border: `1px solid ${T.hair}`,
      background: "rgba(255,255,255,0.015)", padding: "12px 14px",
      display: "flex", flexDirection: "column", gap: 6,
      transition: "border-color 0.15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}44`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.hair; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <p style={{ color: T.t1, fontSize: 11.5, fontWeight: 600, margin: 0, lineHeight: 1.45, flex: 1 }}>
          {doc.title}
        </p>
        {doc.entity_count !== undefined && (
          <span style={{ fontSize: 9, color: color, border: `1px solid ${color}44`, borderRadius: T.rPill, padding: "1px 6px", whiteSpace: "nowrap", flexShrink: 0 }}>
            {doc.entity_count} موجودیت
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {doc.country && <span style={{ fontSize: 9.5, color: T.t3 }}>{doc.country}</span>}
        {doc.region && <span style={{ fontSize: 9, color: T.t3, opacity: 0.6 }}>· {doc.region}</span>}
        <span style={{ marginRight: "auto", fontSize: 9, color: CONF_COLOR(conf) }}>
          {Math.round(conf * 100)}٪
        </span>
      </div>
      {doc.ai_summary && (
        <p style={{ color: T.t2, fontSize: 10, margin: 0, lineHeight: 1.6 }}>
          {doc.ai_summary.slice(0, 140)}{doc.ai_summary.length > 140 ? "…" : ""}
        </p>
      )}
      {doc.source_url && (
        <a href={doc.source_url} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 9, color: T.t3, textDecoration: "none", borderBottom: `1px solid ${T.hair}`, alignSelf: "flex-start" }}>
          ↗ منبع اصلی
        </a>
      )}
    </div>
  );
}

/* ─── main ───────────────────────────────────────────────── */
export default function Discover() {
  const [data, setData] = useState<DiscoverData | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/discover")
      .then(r => r.json())
      .then(setData)
      .catch(() => setErr(true));
  }, []);

  if (err) return <div style={{ padding: 36, color: T.bad, fontFamily: "YekanBakh, sans-serif" }}>خطا در بارگذاری داده.</div>;
  if (!data) return <div style={{ padding: 36, color: T.t3, fontFamily: "YekanBakh, sans-serif" }}>در حال بارگذاری…</div>;

  const { stats, trending, underserved, spotlight, entityTrends, recentSignals } = data;

  return (
    <div style={{
      height: "100%", overflowY: "auto", padding: "18px 26px 32px",
      fontFamily: "YekanBakh, sans-serif",
    }}>

      {/* header */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ color: T.gold, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", margin: 0 }}>DISCOVERY</p>
        <h1 style={{ color: T.t1, fontSize: 21, margin: "6px 0 4px", fontWeight: 700 }}>کشف محتوا</h1>
        <p style={{ color: T.t3, fontSize: 11, margin: 0 }}>مقالات جدید، شکاف‌های دانش، و موجودیت‌های داغ</p>
      </div>

      {/* KPI strip */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {[
          [stats.total, "کل اسناد", T.mint],
          [stats.this_week, "این هفته", T.sky],
          [stats.countries, "کشور", T.lavender],
          [underserved.length, "کشور کم‌پوشش", T.warn],
        ].map(([v, label, tone]) => (
          <div key={String(label)} style={{
            flex: 1, padding: "10px 14px", borderRadius: T.rCard,
            border: `1px solid ${T.hair}`, background: `${tone as string}0a`,
          }}>
            <p style={{ color: tone as string, fontSize: 22, fontWeight: 400, margin: 0, fontVariantNumeric: "tabular-nums" }}>{v as number}</p>
            <p style={{ color: T.t3, fontSize: 9, margin: "4px 0 0" }}>{label as string}</p>
          </div>
        ))}
      </div>

      {/* body grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>

        {/* main column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

          {/* داغ این هفته */}
          {trending.length > 0 && (
            <section>
              <SectionHeader label="🔥 داغ این هفته" sub="مقالات اخیر با بیشترین موجودیت استخراج‌شده" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                {trending.map(d => <ArticleCard key={d.id} doc={d} accent={T.mint} />)}
              </div>
            </section>
          )}

          {/* اکتشاف تصادفی */}
          {spotlight.length > 0 && (
            <section>
              <SectionHeader label="✦ اکتشاف — مقالات با اعتماد بالا" sub="از کشورهای مختلف، انتخاب تصادفی" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                {spotlight.map(d => <ArticleCard key={d.id} doc={d} accent={T.lavender} />)}
              </div>
            </section>
          )}

        </div>

        {/* sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* موجودیت‌های داغ */}
          {entityTrends.length > 0 && (
            <div style={{ borderRadius: T.rCard, border: `1px solid ${T.hair}`, padding: "14px 14px", background: "rgba(255,255,255,0.015)" }}>
              <SectionHeader label="نام‌های داغ اخیر" sub="۱۴ روز گذشته" />
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {entityTrends.map((e, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: i > 0 ? `1px solid ${T.hair}` : "none" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: ETYPE_COLOR[e.etype] ?? T.t3, flexShrink: 0 }} />
                    <span style={{ color: T.t2, fontSize: 10.5, flex: 1 }}>{e.name}</span>
                    <span style={{ fontSize: 9, color: T.t3, fontFamily: "monospace" }}>{e.recent_mentions}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* آخرین سیگنال‌ها */}
          {recentSignals.length > 0 && (
            <div style={{ borderRadius: T.rCard, border: `1px solid ${T.hair}`, padding: "14px 14px", background: "rgba(255,255,255,0.015)" }}>
              <SectionHeader label="آخرین سیگنال‌ها" />
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {recentSignals.map((s, i) => {
                  const color = STYPE_COLOR[s.stype] ?? T.t3;
                  return (
                    <div key={s.id} style={{ padding: "8px 0", borderTop: i > 0 ? `1px solid ${T.hair}` : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 8, color, border: `1px solid ${color}44`, borderRadius: T.rPill, padding: "1px 5px" }}>{s.stype}</span>
                        {s.country && <span style={{ fontSize: 9, color: T.t3 }}>{s.country}</span>}
                      </div>
                      <p style={{ color: T.t2, fontSize: 10.5, margin: 0, lineHeight: 1.4 }}>{s.title}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* کشورهای کم‌پوشش */}
          {underserved.length > 0 && (
            <div style={{ borderRadius: T.rCard, border: `1px solid ${T.warn}33`, padding: "14px 14px", background: `${T.warn}08` }}>
              <SectionHeader label="⚠ شکاف‌های دانش" sub="کشورهایی با کمتر از ۵ مقاله" />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {underserved.map(u => (
                  <span key={u.country} style={{
                    fontSize: 10, color: T.warn, border: `1px solid ${T.warn}44`,
                    borderRadius: T.rPill, padding: "3px 8px",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    {u.country}
                    <span style={{ fontSize: 8, opacity: 0.7 }}>{u.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
