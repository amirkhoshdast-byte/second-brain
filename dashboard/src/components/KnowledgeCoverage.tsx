"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";

type Intel = {
  ready: boolean; documents?: number; countries?: number; confidence?: number;
  entities?: { topic: number; person: number; org: number; event: number };
  countriesList?: Array<{ country: string; n: number }>;
  topics?: Array<{ topic: string; reports: number; countries: number }>;
  recentDocuments?: Array<{ title: string; country: string | null; region: string | null; ai_summary: string | null; confidence: number | null }>;
  entityList?: Array<{ etype: string; name: string; mentions: number }>;
};

const names: Record<string, string> = { person: "شخص", org: "سازمان", event: "رویداد", topic: "موضوع" };
const tones: Record<string, string> = { person: T.gold, org: T.sky, event: T.lavender, topic: T.mint };

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <section className="panel" style={{ padding: "16px 18px", borderRadius: T.rCard, ...style }}>{children}</section>;
}

export default function KnowledgeCoverage() {
  const [data, setData] = useState<Intel | null>(null);
  const [filter, setFilter] = useState<"all" | "person" | "org" | "event" | "topic">("all");
  useEffect(() => { fetch("/api/intel").then(r => r.json()).then(setData).catch(() => setData({ ready: false })); }, []);
  const entities = useMemo(() => (data?.entityList ?? []).filter(e => filter === "all" || e.etype === filter), [data, filter]);
  const total = data?.documents ?? 0;

  if (!data) return <div style={{ padding: 36, color: T.t3 }}>در حال خواندن پوشش دانش…</div>;
  if (!data.ready) return <div style={{ padding: 36, color: T.warn }}>خط لوله استخراج هنوز دادهٔ قابل نمایش تولید نکرده است.</div>;

  return <div style={{ padding: "18px 26px 26px", overflowY: "auto", height: "100%" }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, marginBottom: 16 }}>
      <div>
        <p style={{ color: T.gold, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", margin: 0 }}>KNOWLEDGE COVERAGE</p>
        <h1 style={{ color: T.t1, fontSize: 21, margin: "7px 0 5px", fontWeight: 700 }}>پوشش مقالات و موجودیت‌های سامانه</h1>
        <p style={{ color: T.t3, fontSize: 11.5, margin: 0 }}>نمای واقعی از مقالات استخراج‌شده و موجودیت‌های قابل تحلیل.</p>
      </div>
      <span style={{ fontSize: 10, color: T.ok, border: `1px solid ${T.ok}55`, background: `${T.ok}14`, borderRadius: T.rPill, padding: "5px 10px" }}>استخراج فعال · {total} مقاله</span>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
      {[
        [total, "مقالهٔ ساخت‌یافته", T.mint], [data.countries ?? 0, "کشور دارای مقاله", T.sky],
        [data.entities?.topic ?? 0, "موضوع", T.lavender], [data.entities?.person ?? 0, "شخص", T.gold],
        [(data.entities?.org ?? 0) + (data.entities?.event ?? 0), "سازمان و رویداد", T.warn],
      ].map(([v, label, tone]) => <Panel key={String(label)} style={{ padding: "12px 14px" }}>
        <div style={{ width: 3, height: 12, background: tone as string, borderRadius: 2 }} />
        <p style={{ color: T.t1, fontSize: 26, fontWeight: 400, margin: "8px 0 3px" }}>{v as number}</p>
        <p style={{ color: T.t3, fontSize: 10, margin: 0 }}>{label as string}</p>
      </Panel>)}
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(300px, .75fr)", gap: 12, marginBottom: 12 }}>
      <Panel>
        <h2 style={{ fontSize: 13, color: T.t1, margin: "0 0 13px" }}>کشورها و حجم مقالهٔ پردازش‌شده</h2>
        {(data.countriesList ?? []).map((r, i) => <div key={r.country} style={{ display: "grid", gridTemplateColumns: "110px 1fr 42px", gap: 10, alignItems: "center", marginBottom: 9 }}>
          <span style={{ color: T.t2, fontSize: 11 }}>{r.country}</span>
          <span style={{ height: 5, background: T.hair, borderRadius: 2, overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${Math.max(4, (r.n / Math.max(...(data.countriesList ?? [{ n: 1 }]).map(x => x.n))) * 100)}%`, background: i < 3 ? T.gold : T.sky }} /></span>
          <span style={{ color: T.t1, fontSize: 11, textAlign: "left" }}>{r.n}</span>
        </div>)}
      </Panel>
      <Panel>
        <h2 style={{ fontSize: 13, color: T.t1, margin: "0 0 13px" }}>موضوعات پُرتکرار</h2>
        {(data.topics ?? []).slice(0, 8).map(r => <div key={r.topic} style={{ display: "flex", justifyContent: "space-between", gap: 8, borderBottom: `1px solid ${T.hair}`, padding: "8px 0" }}>
          <span style={{ color: T.t2, fontSize: 10.5 }}>{r.topic}</span><span style={{ color: T.gold, fontSize: 10.5 }}>{r.reports} مقاله</span>
        </div>)}
      </Panel>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(300px, .75fr)", gap: 12 }}>
      <Panel>
        <h2 style={{ fontSize: 13, color: T.t1, margin: "0 0 12px" }}>آخرین مقالات استخراج‌شده</h2>
        {(data.recentDocuments ?? []).map(d => <article key={d.title} style={{ borderTop: `1px solid ${T.hair}`, padding: "10px 0" }}>
          <p style={{ color: T.t1, fontSize: 11.5, fontWeight: 600, margin: 0 }}>{d.title}</p>
          <p style={{ color: T.t3, fontSize: 9.5, margin: "4px 0 0" }}>{d.country ?? "کشور مشخص نشده"}{d.region ? ` · ${d.region}` : ""}</p>
          {d.ai_summary && <p style={{ color: T.t2, fontSize: 10, margin: "5px 0 0", lineHeight: 1.65 }}>{d.ai_summary.slice(0, 180)}…</p>}
        </article>)}
      </Panel>
      <Panel>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}><h2 style={{ fontSize: 13, color: T.t1, margin: 0 }}>موجودیت‌های شناخته‌شده</h2></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>{(["all", "person", "org", "event", "topic"] as const).map(k => <button key={k} onClick={() => setFilter(k)} style={{ borderRadius: T.rPill, padding: "3px 8px", cursor: "pointer", fontFamily: "YekanBakh, sans-serif", border: `1px solid ${filter === k ? T.goldLine : T.hair}`, background: filter === k ? T.goldDim : "transparent", color: filter === k ? T.gold : T.t3, fontSize: 9 }}>{k === "all" ? "همه" : names[k]}</button>)}</div>
        <div style={{ maxHeight: 500, overflowY: "auto" }}>{entities.map(e => <div key={`${e.etype}-${e.name}`} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 0", borderTop: `1px solid ${T.hair}` }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: tones[e.etype] ?? T.t3 }} /><span style={{ color: T.t2, fontSize: 10.5, flex: 1 }}>{e.name}</span><span style={{ color: T.t3, fontSize: 9 }}>{names[e.etype] ?? e.etype} · {e.mentions}</span></div>)}</div>
      </Panel>
    </div>
  </div>;
}
