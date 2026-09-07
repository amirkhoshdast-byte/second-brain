"use client";

import { useEffect, useState } from "react";
import { T } from "@/lib/theme";

type Signal = {
  id: string; stype: string; title: string; description: string;
  country: string | null; topic: string | null; importance: string | null;
  confidence: number; direction: string | null; evidence: number;
};
type Filter = { signals: Signal[]; countries: Array<{country:string;n:number}>; stypes: Array<{stype:string;n:number}> };

const STYPE_FA: Record<string,string> = { trend: "روند", signal: "سیگنال", insight: "بینش" };
const STYPE_COLOR: Record<string,string> = { trend: T.lavender, signal: T.mint, insight: T.sky };
const DIR_MARK: Record<string,string> = { up: "↑", down: "↓", flat: "→" };
const DIR_COLOR: Record<string,string> = { up: T.ok, down: T.bad, flat: T.t3 };

function ConfBar({ v }: { v: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ width: `${Math.round(v * 100)}%`, height: "100%", borderRadius: 2,
          background: v >= 0.8 ? T.ok : v >= 0.5 ? T.gold : T.bad }} />
      </div>
      <span style={{ fontSize: 9, color: T.t3, fontFamily: "YekanBakh, monospace", minWidth: 28, textAlign: "left" }}>
        {Math.round(v * 100)}٪
      </span>
    </div>
  );
}

export default function Signals() {
  const [data, setData]           = useState<Filter | null>(null);
  const [stype, setStype]         = useState<string>("all");
  const [country, setCountry]     = useState<string>("all");
  const [search, setSearch]       = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (stype !== "all")   params.set("stype", stype);
    if (country !== "all") params.set("country", country);
    setData(null);
    fetch(`/api/intel/signals?${params}`).then(r => r.json()).then(setData).catch(() => setData(null));
  }, [stype, country]);

  const filtered = data?.signals.filter(s =>
    !search || s.title.includes(search) || (s.description ?? "").includes(search)
  ) ?? [];

  const filterBtn = {
    padding: "3px 9px", borderRadius: T.rPill, cursor: "pointer", fontSize: 9.5,
    fontFamily: "YekanBakh, sans-serif", border: `1px solid ${T.hair}`,
    background: "transparent", color: T.t3, transition: "all 0.12s",
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column",
      padding: "18px 26px 0", overflow: "hidden", fontFamily: "YekanBakh, sans-serif" }}>

      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 14, flexShrink: 0 }}>
        <div>
          <p style={{ color: T.gold, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", margin: 0 }}>INTELLIGENCE SIGNALS</p>
          <h1 style={{ color: T.t1, fontSize: 20, margin: "6px 0 4px", fontWeight: 700 }}>سیگنال‌های هوشمند</h1>
          <p style={{ color: T.t3, fontSize: 11, margin: 0 }}>
            {data ? `${filtered.length} سیگنال` : "در حال بارگذاری…"}
            {data && ` · ${data.stypes.map(s => `${STYPE_FA[s.stype]??s.stype}: ${s.n}`).join(" · ")}`}
          </p>
        </div>

        {/* KPI */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {data?.stypes.map(s => (
            <div key={s.stype} onClick={() => setStype(stype === s.stype ? "all" : s.stype)}
              style={{ textAlign: "center", padding: "8px 14px", borderRadius: T.rCard, cursor: "pointer",
                border: `1px solid ${stype === s.stype ? STYPE_COLOR[s.stype] : T.hair}`,
                background: stype === s.stype ? `${STYPE_COLOR[s.stype]}15` : "rgba(255,255,255,0.02)",
              }}>
              <p style={{ color: STYPE_COLOR[s.stype] ?? T.t1, fontSize: 20, fontWeight: 400, margin: 0, fontVariantNumeric: "tabular-nums" }}>{s.n}</p>
              <p style={{ color: T.t3, fontSize: 9, margin: "3px 0 0" }}>{STYPE_FA[s.stype] ?? s.stype}</p>
            </div>
          ))}
        </div>
      </div>

      {/* filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="جستجو در سیگنال‌ها…"
          style={{ background: "rgba(0,0,0,0.25)", border: `1px solid ${T.hair}`,
            borderRadius: T.rCtl, padding: "5px 12px", color: T.t2,
            fontSize: 10.5, outline: "none", fontFamily: "YekanBakh, sans-serif", width: 200 }} />

        <select value={country} onChange={e => setCountry(e.target.value)}
          style={{ ...filterBtn, background: country !== "all" ? T.goldDim : "transparent",
            color: country !== "all" ? T.gold : T.t3, border: `1px solid ${country !== "all" ? T.goldLine : T.hair}` }}>
          <option value="all">همه کشورها</option>
          {data?.countries.map(c => (
            <option key={c.country} value={c.country}>{c.country} ({c.n})</option>
          ))}
        </select>

        {stype !== "all" && (
          <button onClick={() => setStype("all")} style={{ ...filterBtn, color: T.warn, borderColor: T.warn }}>
            × {STYPE_FA[stype] ?? stype}
          </button>
        )}
      </div>

      {/* list */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 18 }}>
        {!data && <p style={{ color: T.t3, fontSize: 12, padding: 8 }}>در حال بارگذاری…</p>}
        {filtered.length === 0 && data && (
          <p style={{ color: T.t3, fontSize: 12, padding: 8 }}>سیگنالی یافت نشد.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map(s => {
            const color = STYPE_COLOR[s.stype] ?? T.t3;
            return (
              <div key={s.id} style={{
                padding: "12px 16px", borderRadius: T.rCard,
                border: `1px solid ${T.hair}`,
                background: "rgba(255,255,255,0.018)",
                display: "grid", gridTemplateColumns: "1fr auto", gap: 12,
                transition: "background 0.12s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.032)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.018)"; }}
              >
                <div style={{ minWidth: 0 }}>
                  {/* row 1: type badge + title */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{
                      fontSize: 8.5, fontWeight: 700, borderRadius: T.rPill, padding: "2px 7px",
                      background: `${color}18`, border: `1px solid ${color}44`, color,
                    }}>{STYPE_FA[s.stype] ?? s.stype}</span>
                    {s.direction && (
                      <span style={{ fontSize: 10, color: DIR_COLOR[s.direction] ?? T.t3 }}>
                        {DIR_MARK[s.direction] ?? ""}
                      </span>
                    )}
                    <span style={{ fontSize: 11.5, color: T.t1, fontWeight: 600, flex: 1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.title}
                    </span>
                  </div>
                  {/* description */}
                  {s.description && (
                    <p style={{ color: T.t2, fontSize: 10.5, margin: "0 0 6px", lineHeight: 1.6 }}>
                      {s.description}
                    </p>
                  )}
                  {/* meta */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {s.country && (
                      <span style={{ fontSize: 9.5, color: T.sky, background: `${T.sky}10`,
                        border: `1px solid ${T.sky}30`, borderRadius: T.rPill, padding: "1px 8px" }}>
                        {s.country}
                      </span>
                    )}
                    {s.topic && (
                      <span style={{ fontSize: 9.5, color: T.mint, background: `${T.mint}10`,
                        border: `1px solid ${T.mint}30`, borderRadius: T.rPill, padding: "1px 8px" }}>
                        {s.topic}
                      </span>
                    )}
                    {s.importance && (
                      <span style={{ fontSize: 9, color: T.t3 }}>اهمیت: {s.importance}</span>
                    )}
                    <span style={{ fontSize: 9, color: T.t3 }}>{s.evidence} سند شاهد</span>
                  </div>
                </div>

                {/* confidence bar */}
                <div style={{ width: 90, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
                  <ConfBar v={s.confidence} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
