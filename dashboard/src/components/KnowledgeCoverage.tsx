"use client";

import { useEffect, useMemo, useState } from "react";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { T } from "@/lib/theme";
import DocDetailModal from "@/components/DocDetailModal";

/* ─── types ─────────────────────────────────────────────── */
type EntityNode = { id: number; name: string; etype: string; mentions: number };
type TopDoc     = { id: string; title: string; country: string; report_date: string | null; path: string };
type TimePoint  = { month: string; n: number };
type Concept    = {
  id: number | string; label: string; docs: number; signals: number;
  entities: EntityNode[];
  top_docs: TopDoc[];
  timeline: TimePoint[];
};
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

/* ─── MiniBarChart ──────────────────────────────────────── */
function MiniBarChart({ data }: { data: TimePoint[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.n), 1);
  const last6 = data.slice(-12);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 36, padding: "0 2px" }}>
      {last6.map(d => (
        <div key={d.month} title={`${d.month}: ${d.n} سند`} style={{
          flex: 1, borderRadius: "2px 2px 0 0",
          background: T.mint,
          opacity: 0.7,
          height: `${Math.max(10, Math.round((d.n / max) * 100))}%`,
          minWidth: 4,
          transition: "height 0.3s",
        }} />
      ))}
    </div>
  );
}

/* ─── ConceptChip ───────────────────────────────────────── */
function ConceptChip({ c, active, onClick }: { c: Concept; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 8, width: "100%", padding: "8px 11px", borderRadius: T.rCtl,
      textAlign: "right", cursor: "pointer", transition: "all 0.14s",
      fontFamily: "YekanBakh, sans-serif",
      background: active ? T.goldDim : "transparent",
      border: `1px solid ${active ? T.goldLine : "transparent"}`,
      color: active ? T.gold : T.t2,
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, lineHeight: 1.3, textAlign: "right" }}>{c.label}</span>
      <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
        {c.signals > 0 && (
          <span style={{
            fontSize: 8.5, color: T.mint, background: `${T.mint}18`,
            border: `1px solid ${T.mint}44`, borderRadius: T.rPill, padding: "1px 5px",
          }}>{c.signals}⚡</span>
        )}
        <span style={{
          fontSize: 9, fontFamily: "YekanBakh, monospace",
          border: `1px solid ${active ? T.goldLine : T.hair2}`,
          borderRadius: T.rPill, padding: "1px 5px",
          color: active ? T.gold : T.t3,
        }}>{c.docs}</span>
      </div>
    </button>
  );
}

/* ─── EntityCard ────────────────────────────────────────── */
function EntityCard({ e, search }: { e: EntityNode; search: string }) {
  const color = ETYPE_COLOR[e.etype] ?? T.t3;
  const highlight = search && e.name.includes(search);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
      borderRadius: T.rCtl, transition: "background 0.12s",
      background: highlight ? `${color}14` : "transparent",
    }}
      onMouseEnter={ev => { ev.currentTarget.style.background = `${color}0d`; }}
      onMouseLeave={ev => { ev.currentTarget.style.background = highlight ? `${color}14` : "transparent"; }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ color: T.t1, fontSize: 11, flex: 1, lineHeight: 1.4 }}>{e.name}</span>
      <span style={{
        fontSize: 9, color: T.t3, fontFamily: "YekanBakh, monospace",
        border: `1px solid ${T.hair}`, borderRadius: T.rPill, padding: "1px 5px",
      }}>{e.mentions}</span>
    </div>
  );
}

/* ─── main component ────────────────────────────────────── */
export default function KnowledgeCoverage() {
  const { isMobile } = useBreakpoint();
  const [intel, setIntel]       = useState<Intel | null>(null);
  const [tree, setTree]         = useState<TreeData | null>(null);
  const [selected, setSelected] = useState<number | string | null>(null);
  const [search, setSearch]     = useState("");
  const [etypeFilter, setEtypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"topic" | "country">("topic");
  const [activeTab, setActiveTab] = useState<"entities" | "docs">("entities");
  const [activeDoc, setActiveDoc] = useState<{ title: string; path?: string } | null>(null);

  useEffect(() => {
    fetch("/api/intel").then(r => r.json()).then(setIntel).catch(() => setIntel({ ready: false }));
  }, []);

  useEffect(() => {
    setTree(null); setSelected(null); setSearch(""); setEtypeFilter("all");
    fetch(`/api/intel/knowledge-tree?mode=${viewMode}`)
      .then(r => r.json())
      .then((d: TreeData) => { setTree(d); if (d.concepts.length > 0) setSelected(d.concepts[0].id); })
      .catch(() => setTree(null));
  }, [viewMode]);

  const concept = useMemo(() => tree?.concepts.find(c => c.id === selected) ?? null, [tree, selected]);

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

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, marginBottom: 16, flexShrink: 0 }}>
        <div>
          <p style={{ color: T.gold, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", margin: 0 }}>KNOWLEDGE TREE</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0 4px" }}>
            <h1 style={{ color: T.t1, fontSize: 20, margin: 0, fontWeight: 700 }}>درخت دانش</h1>
            <div style={{ display: "flex", borderRadius: T.rPill, border: `1px solid ${T.hair}`, overflow: "hidden" }}>
              {(["topic", "country"] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)} style={{
                  padding: "4px 12px", cursor: "pointer",
                  fontFamily: "YekanBakh, sans-serif", fontSize: 10, fontWeight: 600,
                  border: "none", transition: "all 0.14s",
                  background: viewMode === m ? T.gold : "transparent",
                  color: viewMode === m ? "#000" : T.t3,
                }}>
                  {m === "topic" ? "موضوعات" : "کشورها"}
                </button>
              ))}
            </div>
          </div>
          <p style={{ color: T.t3, fontSize: 11, margin: 0 }}>
            {tree
              ? `${tree.concepts.length} ${viewMode === "country" ? "کشور" : "مفهوم"} · ${intel.documents ?? 0} سند استخراج‌شده`
              : "در حال بارگذاری…"}
          </p>
        </div>

        {/* KPI strip */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
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

      {/* ── Body ────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "220px 1fr",
        gridTemplateRows: isMobile ? "auto 1fr" : "1fr",
        gap: 12, overflow: "hidden", paddingBottom: 18,
      }}>

        {/* Left: concept list */}
        <div style={{
          borderRadius: T.rCard, border: `1px solid ${T.hair}`,
          background: "rgba(255,255,255,0.015)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ padding: "10px 10px 8px", borderBottom: `1px solid ${T.hair}`, flexShrink: 0 }}>
            <p style={{ color: T.t3, fontSize: 9.5, margin: 0, letterSpacing: ".05em" }}>
              {viewMode === "country" ? "کشورها" : "مفاهیم / موضوعات"}
            </p>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
            {isLoading && <p style={{ color: T.t3, fontSize: 10, padding: 8 }}>در حال بارگذاری…</p>}
            {tree?.concepts.map(c => (
              <ConceptChip key={String(c.id)} c={c} active={selected === c.id}
                onClick={() => setSelected(c.id)} />
            ))}
          </div>
        </div>

        {/* Right: detail panel */}
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
                display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: T.gold, fontSize: 10, margin: 0, letterSpacing: ".06em" }}>
                    {viewMode === "country" ? "کشور" : "مفهوم"}
                  </p>
                  <h2 style={{ color: T.t1, fontSize: 17, margin: "4px 0 6px", fontWeight: 700 }}>{concept.label}</h2>
                  {/* mini timeline */}
                  {concept.timeline?.length > 0 && (
                    <MiniBarChart data={concept.timeline} />
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 10, color: T.mint, border: `1px solid ${T.mint}44`,
                    background: `${T.mint}10`, borderRadius: T.rPill, padding: "4px 10px",
                  }}>{concept.docs} سند · {concept.entities.length} موجودیت</span>
                  {concept.signals > 0 && (
                    <span style={{
                      fontSize: 10, color: T.lavender, border: `1px solid ${T.lavender}44`,
                      background: `${T.lavender}10`, borderRadius: T.rPill, padding: "4px 10px",
                    }}>⚡ {concept.signals} سیگنال</span>
                  )}
                  {viewMode === "country" && (
                    <button
                      onClick={() => window.open(`/api/intel/export?country=${encodeURIComponent(concept.label)}`, "_blank")}
                      style={{
                        padding: "4px 10px", borderRadius: T.rCtl, cursor: "pointer",
                        background: "transparent", border: `1px solid ${T.gold}60`,
                        color: T.gold, fontSize: 9.5, fontFamily: "YekanBakh, sans-serif",
                      }}
                    >↓ گزارش PDF</button>
                  )}
                </div>
              </div>

              {/* tabs: موجودیت‌ها / اسناد */}
              <div style={{
                padding: "0 16px", borderBottom: `1px solid ${T.hair}`,
                display: "flex", alignItems: "center", gap: 0, flexShrink: 0,
              }}>
                {(["entities", "docs"] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    padding: "10px 14px", cursor: "pointer", border: "none",
                    background: "transparent", fontFamily: "YekanBakh, sans-serif",
                    fontSize: 11, fontWeight: activeTab === tab ? 700 : 400,
                    color: activeTab === tab ? T.t1 : T.t3,
                    borderBottom: `2px solid ${activeTab === tab ? T.gold : "transparent"}`,
                    marginBottom: -1,
                  }}>
                    {tab === "entities" ? `موجودیت‌ها (${concept.entities.length})` : `اسناد برتر (${concept.top_docs?.length ?? 0})`}
                  </button>
                ))}

                {/* entity filters — only in entities tab */}
                {activeTab === "entities" && (
                  <div style={{ display: "flex", gap: 4, marginRight: "auto", alignItems: "center" }}>
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
                    <input
                      value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="جستجو…"
                      style={{
                        background: "rgba(0,0,0,0.2)", border: `1px solid ${T.hair}`,
                        borderRadius: T.rCtl, padding: "3px 9px", color: T.t2,
                        fontSize: 10.5, outline: "none", fontFamily: "YekanBakh, sans-serif",
                        width: 110,
                      }}
                    />
                  </div>
                )}
              </div>

              {/* content */}
              <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
                {activeTab === "entities" ? (
                  <>
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
                  </>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {!concept.top_docs?.length && (
                      <p style={{ color: T.t3, fontSize: 11, padding: "8px 4px" }}>سندی یافت نشد.</p>
                    )}
                    {concept.top_docs?.map(doc => (
                      <button
                        key={doc.id}
                        onClick={() => setActiveDoc({ title: doc.title, path: doc.path })}
                        style={{
                          background: T.panel, border: `1px solid ${T.hair}`,
                          borderRadius: 8, padding: "10px 14px", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 12, textAlign: "right",
                          width: "100%", transition: "border-color 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = T.hair2; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = T.hair; }}
                      >
                        <span style={{ fontSize: 14, flexShrink: 0 }}>📄</span>
                        <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                          <p style={{
                            fontSize: 11.5, color: T.t1, fontWeight: 600, margin: 0,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>{doc.title}</p>
                          <p style={{ fontSize: 9.5, color: T.t3, margin: "3px 0 0" }}>
                            {doc.country} {doc.report_date ? `· ${doc.report_date.slice(0, 7)}` : ""}
                          </p>
                        </div>
                        <span style={{
                          fontSize: 9.5, color: T.sky, border: `1px solid ${T.sky}44`,
                          borderRadius: 4, padding: "2px 7px", flexShrink: 0,
                        }}>سند ↗</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* DocDetailModal */}
      {activeDoc && (
        <DocDetailModal
          title={activeDoc.title}
          path={activeDoc.path}
          onClose={() => setActiveDoc(null)}
          onNavigate={t => setActiveDoc({ title: t })}
        />
      )}
    </div>
  );
}
