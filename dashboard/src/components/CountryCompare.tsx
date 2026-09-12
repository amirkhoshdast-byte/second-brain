"use client";

import { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import { useBreakpoint } from "@/hooks/useBreakpoint";

type CountryData = {
  country: string;
  docs: { n: number; dated: number };
  entities: Array<{ name: string; etype: string; n: number }>;
  signals: Array<{ stype: string; n: number; avg_conf: number }>;
  flow: Array<{ m: string; n: number }>;
  topics: Array<{ topic: string; n: number }>;
};

type CompareResult = {
  countries: string[];
  a: CountryData;
  b: CountryData;
};

const STYPE_FA: Record<string, string> = { trend: "روند", signal: "سیگنال", insight: "بینش" };
const STYPE_COLOR: Record<string, string> = { trend: T.lavender, signal: T.mint, insight: T.sky };
const ETYPE_COLOR: Record<string, string> = { person: T.gold, org: T.lavender, location: T.sky, topic: T.mint };

const MONTH_FA: Record<string, string> = {
  "01":"فر","02":"ار","03":"خر","04":"تی","05":"مر","06":"شه",
  "07":"مه","08":"آب","09":"آذ","10":"دی","11":"به","12":"اس",
};

function FlowChart({ flow, color }: { flow: Array<{m:string;n:number}>; color: string }) {
  if (!flow.length) return <p style={{ color: T.t3, fontSize: 10 }}>داده‌ای موجود نیست</p>;
  const max = Math.max(...flow.map(f => f.n), 1);
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 50 }}>
      {flow.map(f => {
        const mm = f.m.slice(5, 7);
        const h = Math.max(4, Math.round((f.n / max) * 46));
        return (
          <div key={f.m} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1 }}>
            <div style={{ width: "100%", height: h, borderRadius: "2px 2px 0 0",
              background: color, opacity: 0.8, minWidth: 4 }} />
            <span style={{ fontSize: 7, color: T.t3, fontFamily: "YekanBakh, monospace" }}>
              {MONTH_FA[mm] ?? mm}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ textAlign: "center", padding: "8px 12px", borderRadius: T.rCard,
      border: `1px solid ${color}30`, background: `${color}08` }}>
      <p style={{ color, fontSize: 22, fontWeight: 700, margin: 0, fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <p style={{ color: T.t3, fontSize: 9, margin: "3px 0 0" }}>{label}</p>
    </div>
  );
}

function Side({ d, color }: { d: CountryData; color: string }) {
  const totalSigs = d.signals.reduce((s, r) => s + r.n, 0);
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* headline */}
      <div style={{ padding: "14px 16px", borderRadius: T.rCard,
        border: `1px solid ${color}40`, background: `${color}08` }}>
        <p style={{ color, fontSize: 22, fontWeight: 700, margin: "0 0 2px", fontFamily: "YekanBakh, sans-serif" }}>
          {d.country}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <StatBox label="سند" value={d.docs.n} color={color} />
          <StatBox label="سیگنال" value={totalSigs} color={color} />
          <StatBox label="موجودیت" value={d.entities.reduce((s,e)=>s+e.n,0)} color={color} />
        </div>
      </div>

      {/* monthly flow */}
      <Section title="روند ماهانه">
        <FlowChart flow={d.flow} color={color} />
      </Section>

      {/* signals */}
      <Section title="سیگنال‌ها">
        {d.signals.length === 0
          ? <p style={{ color: T.t3, fontSize: 10 }}>—</p>
          : d.signals.map(s => (
            <div key={s.stype} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 8.5, borderRadius: T.rPill, padding: "2px 7px",
                background: `${STYPE_COLOR[s.stype] ?? T.t3}18`,
                border: `1px solid ${STYPE_COLOR[s.stype] ?? T.t3}44`,
                color: STYPE_COLOR[s.stype] ?? T.t3 }}>
                {STYPE_FA[s.stype] ?? s.stype}
              </span>
              <span style={{ color: T.t1, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{s.n}</span>
              <span style={{ color: T.t3, fontSize: 9 }}>
                اطمینان {Math.round(s.avg_conf * 100)}٪
              </span>
            </div>
          ))
        }
      </Section>

      {/* entities */}
      <Section title="موجودیت‌های برتر">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {d.entities.slice(0, 6).map((e, i) => {
            const ec = ETYPE_COLOR[e.etype] ?? T.t3;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 8, color: ec, borderRadius: T.rPill, padding: "1px 5px",
                  border: `1px solid ${ec}40`, background: `${ec}10`, minWidth: 28, textAlign: "center" }}>
                  {e.etype === "person" ? "شخص" : e.etype === "org" ? "سازمان" : e.etype === "location" ? "مکان" : e.etype}
                </span>
                <span style={{ color: T.t1, fontSize: 10.5, flex: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                <span style={{ color: T.t3, fontSize: 9, fontVariantNumeric: "tabular-nums" }}>{e.n}×</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* topics */}
      {d.topics.length > 0 && (
        <Section title="موضوعات">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {d.topics.map(t => (
              <span key={t.topic} style={{ fontSize: 9.5, borderRadius: T.rPill, padding: "2px 9px",
                border: `1px solid ${T.hair}`, color: T.t2 }}>
                {t.topic} <span style={{ color: T.t3 }}>({t.n})</span>
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: T.rCard,
      border: `1px solid ${T.hair}`, background: "rgba(255,255,255,0.018)" }}>
      <p style={{ color: T.t3, fontSize: 9, fontWeight: 700, letterSpacing: ".06em",
        textTransform: "uppercase", margin: "0 0 10px" }}>{title}</p>
      {children}
    </div>
  );
}

export default function CountryCompare() {
  const { isMobile } = useBreakpoint();
  const [countries, setCountries] = useState<string[]>([]);
  const [selA, setSelA] = useState("پاکستان");
  const [selB, setSelB] = useState("افغانستان");
  const [data, setData] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/intel/compare?a=پاکستان&b=افغانستان")
      .then(r => r.json())
      .then(d => { setCountries(d.countries ?? []); setData(d); })
      .catch(() => {});
  }, []);

  function compare() {
    if (selA === selB) return;
    setLoading(true);
    setData(null);
    fetch(`/api/intel/compare?a=${encodeURIComponent(selA)}&b=${encodeURIComponent(selB)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  const sel = { padding: "5px 10px", borderRadius: T.rCtl, fontSize: 10.5,
    background: "rgba(0,0,0,0.3)", border: `1px solid ${T.hair}`,
    color: T.t1, fontFamily: "YekanBakh, sans-serif", cursor: "pointer", outline: "none" };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column",
      padding: isMobile ? "12px 14px 0" : "18px 26px 0", overflow: "hidden", fontFamily: "YekanBakh, sans-serif" }}>

      {/* header */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "flex-start", justifyContent: "space-between", gap: isMobile ? 10 : 16, marginBottom: 16, flexShrink: 0 }}>
        <div>
          <p style={{ color: T.gold, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", margin: 0 }}>COUNTRY COMPARISON</p>
          <h1 style={{ color: T.t1, fontSize: isMobile ? 16 : 20, margin: "6px 0 4px", fontWeight: 700 }}>مقایسه کشورها</h1>
          {!isMobile && <p style={{ color: T.t3, fontSize: 11, margin: 0 }}>سیگنال‌ها، موجودیت‌ها و روند ماهانه — کنار هم</p>}
        </div>

        {/* controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select value={selA} onChange={e => setSelA(e.target.value)} style={sel}>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span style={{ color: T.t3, fontSize: 12 }}>در برابر</span>
          <select value={selB} onChange={e => setSelB(e.target.value)} style={sel}>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={compare} disabled={loading || selA === selB}
            style={{ padding: "5px 14px", borderRadius: T.rCtl, cursor: "pointer",
              background: T.gold, border: "none", color: "#000", fontSize: 10.5,
              fontFamily: "YekanBakh, sans-serif", fontWeight: 700,
              opacity: loading || selA === selB ? 0.5 : 1 }}>
            {loading ? "…" : "مقایسه"}
          </button>
          {data && (
            <div style={{ display: "flex", gap: 5 }}>
              <button onClick={() => window.open(`/api/intel/export?country=${encodeURIComponent(selA)}`, "_blank")}
                style={{ padding: "4px 10px", borderRadius: T.rCtl, cursor: "pointer",
                  background: "transparent", border: `1px solid ${T.lavender}60`,
                  color: T.lavender, fontSize: 9.5, fontFamily: "YekanBakh, sans-serif" }}>
                ↓ PDF {selA}
              </button>
              <button onClick={() => window.open(`/api/intel/export?country=${encodeURIComponent(selB)}`, "_blank")}
                style={{ padding: "4px 10px", borderRadius: T.rCtl, cursor: "pointer",
                  background: "transparent", border: `1px solid ${T.mint}60`,
                  color: T.mint, fontSize: 9.5, fontFamily: "YekanBakh, sans-serif" }}>
                ↓ PDF {selB}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* body */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24 }}>
        {!data && !loading && (
          <p style={{ color: T.t3, fontSize: 12 }}>در حال بارگذاری…</p>
        )}
        {loading && (
          <p style={{ color: T.t3, fontSize: 12 }}>در حال مقایسه…</p>
        )}
        {data && (
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 14, alignItems: "flex-start" }}>
            <Side d={data.a} color={T.lavender} />
            {!isMobile && <div style={{ width: 1, alignSelf: "stretch", background: T.hair, flexShrink: 0 }} />}
            {isMobile && <div style={{ height: 1, width: "100%", background: T.hair }} />}
            <Side d={data.b} color={T.mint} />
          </div>
        )}
      </div>
    </div>
  );
}
