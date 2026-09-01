"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";

/* ─── types ─────────────────────────────────────────────── */
type EntityNode = { id: number; name: string; etype: string; mentions: number };
type Concept    = { id: number | string; label: string; docs: number; entities: EntityNode[] };
type TreeData   = { mode: "topic" | "country"; concepts: Concept[] };

type Intel = {
  ready: boolean; documents?: number; countries?: number;
  entities?: { topic: number; person: number; org: number; event: number };
};

/* ─── constants ─────────────────────────────────────────── */
const ETYPE_LABEL: Record<string, string> = { person: "شخص", org: "سازمان", event: "رویداد", topic: "موضوع" };
const ETYPE_COLOR: Record<string, string> = { person: T.gold, org: T.sky, event: T.lavender, topic: T.mint };
const ETYPE_ORDER = ["person", "org", "event"];

/* ─── helpers ───────────────────────────────────────────── */
function groupByEtype(entities: EntityNode[]) {
  const g: Record<string, EntityNode[]> = {};
  for (const e of entities) {
    if (!g[e.etype]) g[e.etype] = [];
    g[e.etype].push(e);
  }
  return g;
}

/* ─── sub-components ────────────────────────────────────── */
function Chip({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count: number }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8, width: "100%", padding: "9px 11px", borderRadius: T.rCtl,
        textAlign: "right", cursor: "pointer", transition: "all 0.14s",
        fontFamily: "YekanBakh, sans-serif",
        background: active ? T.goldDim : "transparent",
        border: `1px solid ${active ? T.goldLine : "transparent"}`,
        color: active ? T.gold : T.t2,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ fontSize: 11.5, fontWeight: active ? 700 : 500, lineHeight: 1.3 }}>{label}</span>
      <span style={{
        fontSize: 9, fontFamily: "monospace",
        border: `1px solid ${active ? T.goldLine : T.hair2}`,
        borderRadius: T.rPill, padding: "1px 5px",
        color: active ? T.gold : T.t3,
      }}>{count}</span>
    </button>
  );
}

function EntityCard({ e, search }: { e: EntityNode; search: string }) {
  const color = ETYPE_COLOR[e.etype] ?? T.t3;
  const highlight = search && e.name.includes(search);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
      borderRadius: T.rCtl, transition: "background 0.12s",
      background: highlight ? `${color}14` : "transparent",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = `${color}0d`; }}
      onMouseLeave={ev => { ev.currentTarget.style.background = highlight ? `${color}14` : "transparent"; }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ color: T.t1, fontSize: 11, flex: 1, lineHeight: 1.4 }}>{e.name}</span>
      <span style={{
        fontSize: 9, color: T.t3, fontFamily: "monospace",
        border: `1px solid ${T.hair}`, borderRadius: T.rPill, padding: "1px 5px",
      }}>{e.mentions}</span>
    </div>
  );
}

/* ─── main component ────────────────────────────────────── */
export default function KnowledgeCoverage() {
  const [intel, setIntel]     = useState<Intel | null>(null);
  const [tree, setTree]       = useState<TreeData | null>(null);
  const [selected, setSelected] = useState<number | string | null>(null);
  const [search, setSearch]   = useState("");
  const [etypeFilter, setEtypeFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/intel").then(r => r.json()).then(setIntel).catch(() => setIntel({ ready: false }));
    fetch("/api/intel/knowledge-tree").then(r => r.json()).then((d: TreeData) => {
      setTree(d);
      if (d.concepts.length > 0) setSelected(d.concepts[0].id);
    }).catch(() => setTree(null));
  }, []);

  const concept = useMemo(() =>
    tree?.concepts.find(c => c.id === selected) ?? null,
    [tree, selected]);

  const filtered = useMemo(() => {
    if (!concept) return [];
    return concept.entities.filter(e => {
      const matchType = etypeFilter === "all" || e.etype === etypeFilter;
      const matchSearch = !search || e.name.includes(search);
      return matchType && matchSearch;
    });
  }, [concept, etypeFilter, search]);

  const grouped = useMemo(() => groupByEtype(filtered), [filtered]);

  if (!intel) return <div style={{ padding: 36, color: T.t3, fontFamily: "YekanBakh, sans-serif" }}>در حال بارگذاری…</div>;
  if (!intel.ready) return <div style={{ padding: 36, color: T.warn, fontFamily: "YekanBakh, sans-serif" }}>خط لوله استخراج هنوز داده‌ای ندارد.</div>;

  const isLoading = !tree;

  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      padding: "18px 26px 0", overflow: "hidden", fontFamily: "YekanBakh, sans-serif",
    }}>

      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, marginBottom: 16, flexShrink: 0 }}>
        <div>
          <p style={{ color: T.gold, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", margin: 0 }}>KNOWLEDGE TREE</p>
          <h1 style={{ color: T.t1, fontSize: 20, margin: "6px 0 4px", fontWeight: 700 }}>
            درخت دانش — {tree?.mode === "country" ? "بر اساس کشور" : "موجودیت‌ها دور مفاهیم"}
          </h1>
          <p style={{ color: T.t3, fontSize: 11, margin: 0 }}>
            {tree ? `${tree.concepts.length} ${tree.mode === "country" ? "کشور" : "مفهوم"} · ${intel.documents ?? 0} سند استخراج‌شده` : "در حال بارگذاری گراف…"}
          </p>
        </div>
        {/* KPI strip */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {[
            [intel.documents ?? 0, "سند", T.mint],
            [intel.entities?.person ?? 0, "شخص", T.gold],
            [intel.entities?.org ?? 0, "سازمان", T.sky],
            [intel.entities?.event ?? 0, "رویداد", T.lavender],
          ].map(([v, label, tone]) => (
            <div key={String(label)} style={{
              textAlign: "center", padding: "8px 12px",
              borderRadius: T.rCard, border: `1px solid ${T.hair}`,
              background: `${tone as string}0a`,
            }}>
              <p style={{ color: tone as string, fontSize: 18, fontWeight: 400, margin: 0, fontVariantNumeric: "tabular-nums" }}>{v as number}</p>
              <p style={{ color: T.t3, fontSize: 9, margin: "3px 0 0" }}>{label as string}</p>
            </div>
          ))}
        </div>
      </div>

      {/* body: two-column */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, overflow: "hidden", paddingBottom: 18 }}>

        {/* left: concept list */}
        <div style={{
          borderRadius: T.rCard, border: `1px solid ${T.hair}`,
          background: "rgba(255,255,255,0.015)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ padding: "10px 10px 8px", borderBottom: `1px solid ${T.hair}`, flexShrink: 0 }}>
            <p style={{ color: T.t3, fontSize: 9.5, margin: 0, letterSpacing: ".05em" }}>
              {tree?.mode === "country" ? "کشورها" : "مفاهیم / موضوعات"}
            </p>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
            {isLoading && <p style={{ color: T.t3, fontSize: 10, padding: 8 }}>در حال بارگذاری…</p>}
            {tree?.concepts.map(c => (
              <Chip key={String(c.id)} label={c.label} active={selected === c.id}
                count={c.docs} onClick={() => setSelected(c.id)} />
            ))}
          </div>
        </div>

        {/* right: entity cluster */}
        <div style={{
          borderRadius: T.rCard, border: `1px solid ${T.hair}`,
          background: "rgba(255,255,255,0.015)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {!concept ? (
            <div style={{ padding: 24, color: T.t3, fontSize: 12 }}>یک مفهوم را از چپ انتخاب کنید.</div>
          ) : (
            <>
              {/* concept header */}
              <div style={{
                padding: "12px 16px", borderBottom: `1px solid ${T.hair}`,
                display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: T.gold, fontSize: 10, margin: 0, letterSpacing: ".06em" }}>
                    {tree?.mode === "country" ? "کشور" : "مفهوم"}
                  </p>
                  <h2 style={{ color: T.t1, fontSize: 17, margin: "4px 0 0", fontWeight: 700 }}>{concept.label}</h2>
                </div>
                <span style={{
                  fontSize: 10, color: T.mint, border: `1px solid ${T.mint}44`,
                  background: `${T.mint}10`, borderRadius: T.rPill, padding: "4px 10px",
                }}>{concept.docs} سند · {concept.entities.length} موجودیت</span>
              </div>

              {/* filters */}
              <div style={{
                padding: "8px 12px", borderBottom: `1px solid ${T.hair}`,
                display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
              }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["all", ...ETYPE_ORDER] as const).map(k => (
                    <button key={k} onClick={() => setEtypeFilter(k)} style={{
                      borderRadius: T.rPill, padding: "3px 9px", cursor: "pointer",
                      fontFamily: "YekanBakh, sans-serif", fontSize: 9.5,
                      border: `1px solid ${etypeFilter === k ? (ETYPE_COLOR[k] ?? T.goldLine) : T.hair}`,
                      background: etypeFilter === k ? `${(ETYPE_COLOR[k] ?? T.gold)}18` : "transparent",
                      color: etypeFilter === k ? (ETYPE_COLOR[k] ?? T.gold) : T.t3,
                    }}>
                      {k === "all" ? "همه" : ETYPE_LABEL[k]}
                    </button>
                  ))}
                </div>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="جستجو در موجودیت‌ها…"
                  style={{
                    flex: 1, background: "rgba(0,0,0,0.2)", border: `1px solid ${T.hair}`,
                    borderRadius: T.rCtl, padding: "4px 10px", color: T.t2,
                    fontSize: 10.5, outline: "none", fontFamily: "YekanBakh, sans-serif",
                  }}
                />
              </div>

              {/* entity groups */}
              <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px" }}>
                {filtered.length === 0 && (
                  <p style={{ color: T.t3, fontSize: 11, padding: "8px 4px" }}>موجودیتی یافت نشد.</p>
                )}
                {ETYPE_ORDER.map(etype => {
                  const group = grouped[etype];
                  if (!group?.length) return null;
                  const color = ETYPE_COLOR[etype];
                  return (
                    <div key={etype} style={{ marginBottom: 16 }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8, marginBottom: 5,
                        paddingBottom: 5, borderBottom: `1px solid ${T.hair}`,
                      }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: ".05em" }}>
                          {ETYPE_LABEL[etype]}
                        </span>
                        <span style={{ fontSize: 9, color: T.t3 }}>{group.length}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 2 }}>
                        {group.map(e => <EntityCard key={e.id} e={e} search={search} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
