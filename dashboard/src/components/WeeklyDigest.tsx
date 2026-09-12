"use client";

import { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import { useBreakpoint } from "@/hooks/useBreakpoint";

type DigestData = {
  summary: string | null;
  newDocs: number;
  topCountries: Array<{ country: string; n: number }>;
  topSignals: Array<{ stype: string; title: string; description: string; country: string | null; confidence: number; direction: string | null }>;
  generatedAt: string;
};

const STYPE_FA: Record<string,string> = { trend:"روند", signal:"سیگنال", insight:"بینش" };
const STYPE_COLOR: Record<string,string> = { trend: T.lavender, signal: T.mint, insight: T.sky };
const DIR_MARK: Record<string,string> = { up:"↑", down:"↓", flat:"→" };
const DIR_COLOR: Record<string,string> = { up: T.ok, down: T.bad, flat: T.t3 };

export default function WeeklyDigest() {
  const { isMobile } = useBreakpoint();
  const [data, setData] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  function generate() {
    setLoading(true);
    setGenerated(true);
    fetch("/api/intel/weekly-digest")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { generate(); }, []);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column",
      padding: isMobile ? "12px 14px 0" : "18px 26px 0", overflow: "hidden", fontFamily: "YekanBakh, sans-serif" }}>

      {/* header */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "flex-start", justifyContent: "space-between", gap: isMobile ? 8 : 16, marginBottom: 18, flexShrink: 0 }}>
        <div>
          <p style={{ color: T.gold, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", margin: 0 }}>WEEKLY DIGEST</p>
          <h1 style={{ color: T.t1, fontSize: isMobile ? 16 : 20, margin: "6px 0 4px", fontWeight: 700 }}>خلاصه هفتگی هوشمند</h1>
          <p style={{ color: T.t3, fontSize: 11, margin: 0 }}>
            {data?.generatedAt ? `ساخته‌شده: ${new Date(data.generatedAt).toLocaleString("fa-IR")}` : "در حال تولید…"}
          </p>
        </div>
        <button onClick={generate} disabled={loading}
          style={{ padding: "6px 14px", borderRadius: T.rCtl, cursor: "pointer",
            background: T.goldDim, border: `1px solid ${T.goldLine}`, color: T.gold,
            fontSize: 10.5, fontFamily: "YekanBakh, sans-serif",
            opacity: loading ? 0.5 : 1, flexShrink: 0 }}>
          {loading ? "در حال تولید…" : "⟳ به‌روز‌رسانی"}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24 }}>
        {/* KPI row */}
        {data && (
          <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
            <div style={{ padding: "10px 16px", borderRadius: T.rCard,
              border: `1px solid ${T.mint}40`, background: `${T.mint}08`, textAlign: "center" }}>
              <p style={{ color: T.mint, fontSize: 22, fontWeight: 700, margin: 0 }}>{data.newDocs}</p>
              <p style={{ color: T.t3, fontSize: 9, margin: "3px 0 0" }}>سند جدید هفته</p>
            </div>
            <div style={{ padding: "10px 16px", borderRadius: T.rCard,
              border: `1px solid ${T.lavender}40`, background: `${T.lavender}08`, textAlign: "center" }}>
              <p style={{ color: T.lavender, fontSize: 22, fontWeight: 700, margin: 0 }}>{data.topSignals.length}</p>
              <p style={{ color: T.t3, fontSize: 9, margin: "3px 0 0" }}>سیگنال با اطمینان بالا</p>
            </div>
            {data.topCountries.length > 0 && (
              <div style={{ padding: "10px 16px", borderRadius: T.rCard,
                border: `1px solid ${T.sky}40`, background: `${T.sky}08`, textAlign: "center" }}>
                <p style={{ color: T.sky, fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.4 }}>
                  {data.topCountries[0].country}
                </p>
                <p style={{ color: T.t3, fontSize: 9, margin: "3px 0 0" }}>فعال‌ترین کشور</p>
              </div>
            )}
          </div>
        )}

        {/* AI summary */}
        {loading && (
          <div style={{ padding: "20px 18px", borderRadius: T.rCard,
            border: `1px solid ${T.hair}`, background: "rgba(255,255,255,0.02)", marginBottom: 18 }}>
            <p style={{ color: T.t3, fontSize: 11, margin: 0 }}>در حال تولید خلاصه با qwen3:8b…</p>
          </div>
        )}
        {!loading && data?.summary && (
          <div style={{ padding: "16px 18px", borderRadius: T.rCard,
            border: `1px solid ${T.gold}40`, background: `${T.gold}06`, marginBottom: 18 }}>
            <p style={{ color: T.gold, fontSize: 9, fontWeight: 700, letterSpacing: ".06em", margin: "0 0 8px" }}>
              خلاصه هوشمند
            </p>
            <p style={{ color: T.t1, fontSize: 12, lineHeight: 1.9, margin: 0 }}>{data.summary}</p>
          </div>
        )}
        {!loading && generated && data && !data.summary && (
          <div style={{ padding: "14px 18px", borderRadius: T.rCard,
            border: `1px solid ${T.hair}`, background: "rgba(255,255,255,0.02)", marginBottom: 18 }}>
            <p style={{ color: T.t3, fontSize: 11, margin: 0 }}>
              Ollama در دسترس نیست — داده‌ها بدون خلاصه متنی نمایش داده می‌شوند.
            </p>
          </div>
        )}

        {/* top signals */}
        {data && data.topSignals.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <p style={{ color: T.t3, fontSize: 9, fontWeight: 700, letterSpacing: ".06em",
              textTransform: "uppercase", margin: "0 0 10px", borderBottom: `1px solid ${T.hair}`, paddingBottom: 6 }}>
              سیگنال‌های برتر
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.topSignals.map((s, i) => {
                const color = STYPE_COLOR[s.stype] ?? T.t3;
                return (
                  <div key={i} style={{ padding: "10px 14px", borderRadius: T.rCard,
                    border: `1px solid ${T.hair}`, background: "rgba(255,255,255,0.018)",
                    display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontSize: 8.5, borderRadius: T.rPill, padding: "2px 7px", flexShrink: 0,
                      background: `${color}18`, border: `1px solid ${color}44`, color }}>
                      {STYPE_FA[s.stype] ?? s.stype}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        {s.direction && (
                          <span style={{ fontSize: 10, color: DIR_COLOR[s.direction] ?? T.t3 }}>
                            {DIR_MARK[s.direction] ?? ""}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: T.t1, fontWeight: 600 }}>{s.title}</span>
                        {s.country && (
                          <span style={{ fontSize: 9, color: T.sky, background: `${T.sky}10`,
                            border: `1px solid ${T.sky}30`, borderRadius: T.rPill, padding: "1px 7px" }}>
                            {s.country}
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <p style={{ fontSize: 10, color: T.t2, margin: 0, lineHeight: 1.5 }}>
                          {s.description.slice(0, 100)}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: T.t3, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                      {Math.round(s.confidence * 100)}٪
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* top countries */}
        {data && data.topCountries.length > 0 && (
          <div>
            <p style={{ color: T.t3, fontSize: 9, fontWeight: 700, letterSpacing: ".06em",
              textTransform: "uppercase", margin: "0 0 10px", borderBottom: `1px solid ${T.hair}`, paddingBottom: 6 }}>
              کشورهای فعال این هفته
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {data.topCountries.map(c => (
                <div key={c.country} style={{ padding: "6px 14px", borderRadius: T.rCard,
                  border: `1px solid ${T.hair}`, background: "rgba(255,255,255,0.025)",
                  display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: T.t1, fontSize: 11 }}>{c.country}</span>
                  <span style={{ color: T.t3, fontSize: 9 }}>{c.n} سند</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
