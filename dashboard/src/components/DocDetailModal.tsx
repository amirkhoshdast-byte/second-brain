"use client";
import { useEffect, useState, useCallback } from "react";
import { T } from "@/lib/theme";

interface Entity {
  id: string;
  name: string;
  etype: string;
  aliases?: string[] | null;
  mentions: number;
}

interface RelatedDoc {
  id: string;
  title: string;
  country: string | null;
  report_date: string | null;
  doc_type: string | null;
  shared: number;
}

interface DocData {
  id: string;
  title: string;
  path: string;
  country: string | null;
  region: string | null;
  producer: string | null;
  report_date: string | null;
  doc_type: string | null;
  source_name: string | null;
  source_url: string | null;
  ai_summary: string | null;
  confidence: number | null;
  extracted_at: string | null;
}

interface Props {
  title: string;
  path?: string;
  onClose: () => void;
  onNavigate?: (title: string) => void;
}

const etypeColor: Record<string, string> = {
  person: T.sky,
  org:    T.mint,
  topic:  T.lavender,
  event:  T.warn,
};

const etypeLabel: Record<string, string> = {
  person: "شخص",
  org:    "سازمان",
  topic:  "موضوع",
  event:  "رویداد",
};

function highlightEntities(text: string, entities: Entity[]): string {
  let result = text;
  // sort by name length desc so longer names match first
  const sorted = [...entities].sort((a, b) => b.name.length - a.name.length);
  for (const e of sorted) {
    const color = etypeColor[e.etype] ?? T.t3;
    const escaped = e.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(`(${escaped})`, "gi"),
      `<mark style="background:${color}22;color:${color};border-radius:3px;padding:0 2px;font-weight:600">$1</mark>`
    );
  }
  return result;
}

export default function DocDetailModal({ title, path, onClose, onNavigate }: Props) {
  const [doc, setDoc]           = useState<DocData | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [related, setRelated]   = useState<RelatedDoc[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeEtype, setActiveEtype] = useState<string | null>(null);

  const load = useCallback((t: string, p?: string) => {
    setLoading(true);
    setDoc(null);
    setEntities([]);
    setRelated([]);
    const param = p
      ? `path=${encodeURIComponent(p)}`
      : `title=${encodeURIComponent(t)}`;
    fetch(`/api/intel/document?${param}`)
      .then(r => r.json())
      .then(data => {
        if (data.found) {
          setDoc(data.doc);
          setEntities(data.entities ?? []);
          setRelated(data.related ?? []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(title, path); }, [title, path, load]);

  // close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const etypes = [...new Set(entities.map(e => e.etype))];
  const visibleEntities = activeEtype
    ? entities.filter(e => e.etype === activeEtype)
    : entities;

  const highlightedSummary = doc?.ai_summary
    ? highlightEntities(doc.ai_summary, entities)
    : null;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div style={{
        background: T.panelSolid, borderRadius: 14,
        border: `1px solid ${T.hair2}`,
        width: "100%", maxWidth: 820, maxHeight: "90vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{
          padding: "18px 22px", borderBottom: `1px solid ${T.hair}`,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14,
        }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.t1, margin: 0, lineHeight: 1.5 }}>
              {loading ? "در حال بارگذاری…" : (doc?.title ?? title)}
            </p>
            {doc && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
                {doc.country   && <Chip label={doc.country}   color={T.sky} />}
                {doc.doc_type  && <Chip label={doc.doc_type}  color={T.t3} />}
                {doc.producer  && <Chip label={doc.producer}  color={T.t3} />}
                {doc.report_date && <Chip label={doc.report_date} color={T.gold} />}
                {doc.confidence != null && (
                  <Chip label={`اطمینان ${Math.round(doc.confidence * 100)}٪`} color={doc.confidence > 0.7 ? T.mint : T.warn} />
                )}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
            {doc?.source_url && (
              <a
                href={doc.source_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 11, color: T.sky, border: `1px solid ${T.sky}44`,
                  borderRadius: 6, padding: "5px 10px", textDecoration: "none",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                ↗ منبع
              </a>
            )}
            <button onClick={onClose} style={{
              background: "none", border: `1px solid ${T.hair2}`,
              color: T.t3, cursor: "pointer", fontSize: 16,
              width: 30, height: 30, borderRadius: 6, display: "flex",
              alignItems: "center", justifyContent: "center",
            }}>×</button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Left — summary + related */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px", minWidth: 0 }}>
            {loading && (
              <p style={{ color: T.t3, fontSize: 12, textAlign: "center", paddingTop: 40 }}
                 className="anim-pulse">در حال بارگذاری اطلاعات سند…</p>
            )}

            {!loading && !doc && (
              <p style={{ color: T.t3, fontSize: 12, textAlign: "center", paddingTop: 40 }}>
                سند در پایگاه داده یافت نشد
              </p>
            )}

            {doc?.ai_summary && (
              <section style={{ marginBottom: 24 }}>
                <SectionLabel>خلاصه هوشمند</SectionLabel>
                <p
                  style={{ fontSize: 12.5, color: T.t2, lineHeight: 2, margin: 0 }}
                  dangerouslySetInnerHTML={{ __html: highlightedSummary ?? doc.ai_summary }}
                />
              </section>
            )}

            {related.length > 0 && (
              <section>
                <SectionLabel>اسناد مرتبط</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {related.map(r => (
                    <button
                      key={r.id}
                      onClick={() => { if (onNavigate) { onNavigate(r.title); load(r.title); } }}
                      style={{
                        background: T.panel, border: `1px solid ${T.hair}`,
                        borderRadius: 8, padding: "9px 13px", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 12, textAlign: "right",
                        width: "100%",
                      }}
                    >
                      <span style={{ flex: 1, fontSize: 11.5, color: T.t1, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.title}
                      </span>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {r.country    && <Chip label={r.country}                 color={T.sky}  tiny />}
                        {r.report_date && <Chip label={r.report_date.slice(0,7)} color={T.t3}   tiny />}
                        <Chip label={`${r.shared} موضوع مشترک`} color={T.lavender} tiny />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right — entities */}
          {entities.length > 0 && (
            <div style={{
              width: 220, flexShrink: 0, borderRight: `1px solid ${T.hair}`,
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}>
              <div style={{ padding: "14px 14px 10px", borderBottom: `1px solid ${T.hair}` }}>
                <p style={{ fontSize: 11.5, fontWeight: 600, color: T.t1, margin: "0 0 8px" }}>موجودیت‌ها</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  <button
                    onClick={() => setActiveEtype(null)}
                    style={etypeBtn(activeEtype === null, T.gold)}
                  >همه</button>
                  {etypes.map(et => (
                    <button
                      key={et}
                      onClick={() => setActiveEtype(prev => prev === et ? null : et)}
                      style={etypeBtn(activeEtype === et, etypeColor[et] ?? T.t3)}
                    >{etypeLabel[et] ?? et}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px" }}>
                {visibleEntities.map(e => (
                  <div key={e.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 8px", borderRadius: 6, marginBottom: 3,
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                      background: etypeColor[e.etype] ?? T.t3,
                    }} />
                    <span style={{
                      flex: 1, fontSize: 11, color: T.t1, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{e.name}</span>
                    <span style={{
                      fontSize: 9.5, color: T.t3, fontFamily: "monospace",
                      background: T.panel, borderRadius: 4, padding: "1px 5px",
                    }}>{e.mentions}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, color, tiny }: { label: string; color: string; tiny?: boolean }) {
  return (
    <span style={{
      fontSize: tiny ? 9.5 : 10.5,
      color, background: color + "18",
      border: `1px solid ${color}33`,
      borderRadius: 5, padding: tiny ? "2px 6px" : "3px 8px",
      fontWeight: 500, whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, color: T.t3, letterSpacing: "0.08em",
      textTransform: "uppercase", margin: "0 0 10px",
      borderBottom: `1px solid ${T.hair}`, paddingBottom: 6,
    }}>{children}</p>
  );
}

function etypeBtn(active: boolean, color: string): React.CSSProperties {
  return {
    fontSize: 9.5, padding: "3px 7px", borderRadius: 5, cursor: "pointer",
    border: `1px solid ${active ? color : color + "44"}`,
    background: active ? color + "22" : "transparent",
    color: active ? color : T.t3, fontFamily: "YekanBakh, sans-serif",
    fontWeight: active ? 600 : 400,
  };
}
