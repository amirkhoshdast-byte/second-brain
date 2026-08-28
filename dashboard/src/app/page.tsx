"use client";

import { useEffect, useRef, useState } from "react";
import { T } from "@/lib/theme";
import IntelligenceGraph from "@/components/IntelligenceGraph";
import InternationalDashboard from "@/components/InternationalDashboard";
import KnowledgeCoverage from "@/components/KnowledgeCoverage";

const VAULT_NAME = "Cultural Intelligence Hub";

// ─── Types ─────────────────────────────────────────────────────────────────────
type CollectionStat = { name: string; points: number };
type StatsData = {
  collections: CollectionStat[];
  total_documents: number;
  active_collection?: string;
  indexed_documents?: number | null;
};
type QdrantDoc = {
  id: number | string; score?: number | null;
  title?: string; entity_id?: string; entity_type?: string; period_id?: string;
  classification?: string; doc_type?: string; folder?: string;
  text_preview?: string; chunk_text?: string; path?: string;
};
type VaultFile = { path: string; name: string; folder: string };
type Message = {
  role: "user" | "assistant"; content: string;
  sources?: Array<{ title: string; folder: string; score: number; path?: string }>;
};


const folderIcon: Record<string, string> = {
  "00-templates": "📐", "01-Countries": "🌍", "02-Religions": "🕌",
  "02-Topic": "🏷️", "03-Organizations": "🏛️", "04-Person": "👤",
  "05-Reports": "📄", "05-Social-Listening": "📡", "06-Meetings": "🤝",
  "07-Insights": "💡", "08-Project": "📂", "09-Event": "📅",
  "10-Agents": "🤖", "Dashboards": "📊", "Knowledge Hub": "🧠", "Raw_Web": "🌐",
};
const typeIcon: Record<string, string> = {
  report: "📄", signal: "📡", insight: "💡", country: "🌍",
  organization: "🏛️", person: "👤", meeting: "🤝", project: "📂",
  event: "📅", agent: "🤖", topic: "🏷️", religion: "🕌",
  knowledge: "🧠", raw_web: "🌐", dashboard: "📊",
};
const classTone: Record<string, string> = {
  public: T.mint, internal: T.sky, restricted: T.warn, confidential: T.bad,
};

function openInObsidian(p: string) {
  window.open(`obsidian://open?vault=${encodeURIComponent(VAULT_NAME)}&file=${encodeURIComponent(p.replace(".md",""))}`, "_blank");
}

// ─── Primitives ────────────────────────────────────────────────────────────────
function Pill({ label, tone = T.gold, filled = false }: { label: string; tone?: string; filled?: boolean }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, color: tone, letterSpacing: "0.02em",
      background: filled ? `${tone}1F` : "transparent",
      border: `1px solid ${tone}44`, borderRadius: T.rPill, padding: "3px 10px",
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

/** برچسب کوچک با میله رنگی — الگوی متریک پلتفرم */
function BarLabel({ label, tone }: { label: string; tone: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{ width: 3, height: 13, borderRadius: 2, background: tone, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: T.t2, fontWeight: 500 }}>{label}</span>
    </span>
  );
}

/** نشانه‌های درون‌خطی یک خط: **پررنگ** و ارجاع [منبع N]. */
function inlineParts(line: string) {
  return line.split(/(\*\*[^*]+\*\*|\[منبع ?\d+\])/g).map((seg, i) => {
    if (/^\*\*[^*]+\*\*$/.test(seg)) {
      return <strong key={i} style={{ color: T.t1, fontWeight: 700 }}>{seg.slice(2, -2)}</strong>;
    }
    if (/^\[منبع ?\d+\]$/.test(seg)) {
      return (
        <span key={i} style={{
          color: T.gold, fontSize: "0.85em", fontWeight: 600,
          padding: "0 3px", whiteSpace: "nowrap",
        }}>{seg}</span>
      );
    }
    return seg;
  });
}

/**
 * رندر حداقلی مارک‌داونی که qwen3 تولید می‌کند: سرتیتر، **پررنگ** و [منبع N].
 *
 * مدل همیشه با این نشانه‌ها پاسخ می‌دهد و نمایش خام آن‌ها ستاره و هش اضافه روی
 * صفحه می‌گذارد. کتابخانه‌ی مارک‌داون برای همین چند الگو زیادی است.
 */
function RichText({ text }: { text: string }) {
  return (
    <div style={{ whiteSpace: "pre-wrap" }}>
      {text.split("\n").map((line, i) => {
        // سرتیتر ### بلوکی رندر می‌شود تا هش خام روی صفحه نماند
        const h = /^\s{0,3}(#{1,4})\s+(.*)$/.exec(line);
        if (h) {
          return (
            <p key={i} style={{
              margin: "12px 0 4px", fontWeight: 700,
              fontSize: h[1].length <= 2 ? "1.06em" : "1em",
              color: T.t1,
            }}>{inlineParts(h[2])}</p>
          );
        }
        return <p key={i} style={{ margin: 0 }}>{inlineParts(line)}</p>;
      })}
    </div>
  );
}

/** خط راهنمای نقطه‌چین — کلید ......... مقدار */
function LeaderRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", fontSize: 11 }}>
      <span style={{ color: T.t2, flexShrink: 0 }}>{k}</span>
      <span className="leader" />
      <span style={{ color: T.t1, fontWeight: 600, flexShrink: 0, fontFamily: mono ? "monospace" : "inherit", fontSize: mono ? 10.5 : 11 }}>{v}</span>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive, counts }: {
  active: string; setActive: (v: string) => void; counts: { vault: number; qdrant: number };
}) {
  const [logoOk, setLogoOk] = useState(true);
  const nav = [
    { id: "world",     icon: "◍", label: "داشبورد بین‌الملل", badge: undefined as number | undefined },
    { id: "graph",     icon: "⬡", label: "گراف هوشمند",       badge: undefined },
    { id: "chat",      icon: "◈", label: "دستیار هوشمند",     badge: undefined },
    { id: "coverage",  icon: "▤", label: "پوشش دانش",         badge: undefined },
    { id: "vault",     icon: "◇", label: "یادداشت‌ها",        badge: counts.vault },
    { id: "search",    icon: "◎", label: "جستجوی معنایی",    badge: undefined },
    { id: "documents", icon: "▦", label: "اسناد نمایه‌شده",   badge: counts.qdrant },
  ];

  return (
    <aside style={{
      width: 212, flexShrink: 0, borderLeft: `1px solid ${T.hair}`,
      display: "flex", flexDirection: "column", height: "100vh",
      background: "rgba(6,17,14,0.55)", backdropFilter: "blur(20px)",
      position: "relative", zIndex: 2,
    }}>
      {/* Brand */}
      <div style={{ padding: "18px 16px 16px", borderBottom: `1px solid ${T.hair}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/*
            نشان سازمان از public/logo.svg خوانده می‌شود. تا وقتی فایل نباشد،
            نماد پیش‌فرض نمایش داده می‌شود تا سایدبار خراب دیده نشود.
          */}
          {logoOk ? (
            <img src="/logo.svg" alt="نشان سازمان فرهنگ و ارتباطات اسلامی"
              onError={() => setLogoOk(false)}
              style={{ width: 34, height: 34, flexShrink: 0, objectFit: "contain", borderRadius: 7 }}
            />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
              border: `1px solid ${T.goldLine}`, background: T.goldDim,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, color: T.gold,
            }}>✦</div>
          )}
          <div>
            <p style={{ color: T.t1, fontWeight: 700, fontSize: 13, lineHeight: 1.15, margin: 0 }}>مغز دوم</p>
            <p style={{ color: T.t3, fontSize: 9, margin: "4px 0 0", lineHeight: 1.5 }}>سازمان فرهنگ<br />و ارتباطات اسلامی</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px" }}>
        {nav.map((item) => {
          const on = active === item.id;
          return (
            <button key={item.id} onClick={() => setActive(item.id)} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "9px 12px", borderRadius: T.rCtl, marginBottom: 3,
              background: on ? T.goldDim : "transparent",
              border: `1px solid ${on ? T.goldLine : "transparent"}`,
              color: on ? T.gold : T.t2,
              cursor: "pointer", transition: "all 0.16s", textAlign: "right",
              fontFamily: "YekanBakh, sans-serif",
            }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, fontWeight: on ? 700 : 500 }}>
                <span style={{ fontSize: 12, opacity: on ? 1 : 0.65 }}>{item.icon}</span>
                {item.label}
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span style={{
                  fontSize: 9.5, fontWeight: 600, color: on ? T.gold : T.t3,
                  border: `1px solid ${on ? T.goldLine : T.hair2}`, borderRadius: T.rPill,
                  padding: "1px 7px", fontFamily: "monospace",
                }}>{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

    </aside>
  );
}

// ─── Metric card — الگوی پلتفرم: میله رنگی + عدد بزرگ سبک ─────────────────────
function Metric({ label, value, unit, tone }: {
  label: string; value: number | string; unit?: string; tone: string;
}) {
  return (
    <div className="panel" style={{ padding: "14px 16px 16px", borderRadius: T.rCard }}>
      <BarLabel label={label} tone={tone} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 12 }}>
        <span style={{ fontSize: 30, fontWeight: 300, color: T.t1, lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: T.t2, fontWeight: 400 }}>{unit}</span>}
      </div>
    </div>
  );
}

// ─── Chat ──────────────────────────────────────────────────────────────────────
function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // مقاله‌ای که کاربر از روی چیپ منبع باز کرده
  const [article, setArticle] = useState<{ path: string; title: string; text: string | null } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const onOpenSource = async (path: string, title: string) => {
    setArticle({ path, title, text: null });
    try {
      const r = await fetch(`/api/vault/${encodeURIComponent(path)}`);
      const d = await r.json();
      setArticle({ path, title, text: d.content ?? "متن این مقاله خوانده نشد." });
    } catch {
      setArticle({ path, title, text: "متن این مقاله خوانده نشد." });
    }
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const q = input.trim(); setInput(""); setLoading(true);
    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    let text = ""; let sources: Message["sources"] = [];
    try {
      const res = await fetch("/api/rag", {
        method: "POST", headers: { "Content-Type": "application/json" },
        // فقط چند نوبت اخیر برای فهم پرسش پیگیری فرستاده می‌شود؛ تاریخچهٔ کامل
        // نه لازم است و نه باید بی‌دلیل وارد context بازیابی شود.
        body: JSON.stringify({ question: q, history: messages.slice(-6).map(({ role, content }) => ({ role, content })) }),
      });
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const j = JSON.parse(line.slice(5));
            if (j.token) { text += j.token; setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: text, sources }]); }
            if (j.done)  { sources = j.sources ?? []; setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: text, sources }]); }
            if (j.error) { text = `خطا: ${j.error}`; setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: text }]); }
          } catch {}
        }
      }
    } catch (e) { setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: `خطا: ${e}` }]); }
    setLoading(false); setTimeout(() => inputRef.current?.focus(), 50);
  };

  const suggestions = [
    "آخرین گزارش ترکیه چه می‌گوید؟",
    "یونس امره انستیتو چیست؟",
    "دیپلماسی فرهنگی ایران کجا فعال است؟",
    "آخرین اقدامات سازمانی چیست؟",
  ];

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "26px 34px", display: "flex", flexDirection: "column", gap: 20 }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
            {/* Orb — نود مرکزی پلتفرم */}
            <div style={{ position: "relative", marginBottom: 26 }}>
              <div style={{ position: "absolute", inset: -46, borderRadius: "50%", background: `radial-gradient(circle, ${T.mint}22 0%, transparent 68%)` }} />
              <div style={{ position: "absolute", inset: -22, borderRadius: "50%", border: `1px solid rgba(111,224,192,0.14)` }} />
              <div className="anim-orb" style={{
                width: 62, height: 62, borderRadius: "50%", position: "relative",
                background: `radial-gradient(circle at 34% 30%, #BFF3E4 0%, ${T.mint} 34%, #157D67 72%, #0A3D33 100%)`,
              }} />
            </div>
            <h2 style={{ color: T.t1, fontSize: 19, fontWeight: 400, margin: "0 0 7px", letterSpacing: "-0.01em" }}>دستیار هوشمند سازمانی</h2>
            <p style={{ color: T.t3, fontSize: 12, margin: "0 0 32px" }}>پرسش خود را از پایگاه دانش Vault بپرسید</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 500, width: "100%" }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => { setInput(s); inputRef.current?.focus(); }} style={{
                  textAlign: "right", fontSize: 11.5, fontWeight: 400, color: T.t2, fontFamily: "YekanBakh, sans-serif",
                  background: T.panel, backdropFilter: "blur(14px)",
                  border: `1px solid ${T.hair}`, borderRadius: T.rCtl,
                  padding: "11px 14px", cursor: "pointer", transition: "all 0.16s", lineHeight: 1.55,
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.goldLine; e.currentTarget.style.color = T.goldHi; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.hair; e.currentTarget.style.color = T.t2; }}
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} className="anim-fadein" style={{ display: "flex", gap: 11, flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-start" }}>
              {/* Avatar */}
              {isUser ? (
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  border: `1px solid ${T.goldLine}`, background: T.goldDim, color: T.gold,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                }}>ش</div>
              ) : (
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: `radial-gradient(circle at 34% 30%, #BFF3E4 0%, ${T.mint} 40%, #14705C 100%)`,
                  boxShadow: `0 0 14px rgba(111,224,192,0.28)`,
                }} />
              )}
              <div style={{ maxWidth: "76%", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{
                  padding: "11px 15px", fontSize: 12.5, lineHeight: 1.8,
                  background: isUser ? T.goldDim : T.panel,
                  backdropFilter: "blur(16px)",
                  border: `1px solid ${isUser ? T.goldLine : T.hair}`,
                  borderRadius: T.rPanel,
                  borderTopRightRadius: isUser ? T.rCtl : T.rPanel,
                  borderTopLeftRadius: isUser ? T.rPanel : T.rCtl,
                  color: isUser ? T.goldHi : T.t1,
                }}>
                  {m.content === "" && loading ? (
                    <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      {[0, 150, 300].map((d, j) => (
                        <span key={j} className="anim-bounce" style={{ width: 5, height: 5, borderRadius: "50%", background: T.mint, display: "inline-block", animationDelay: `${d}ms` }} />
                      ))}
                    </span>
                  ) : isUser
                    ? <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.content}</p>
                    : <RichText text={m.content} />}
                </div>

                {/* چیپ منبع — کلیک متن کامل مقاله را باز می‌کند */}
                {m.sources && m.sources.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {m.sources.map((s, si) => (
                      <button key={si} onClick={() => s.path && onOpenSource(s.path, s.title)}
                        disabled={!s.path}
                        title={s.path ? "نمایش متن مقاله" : undefined}
                        style={{
                          fontSize: 9.5, fontWeight: 500, color: T.t2,
                          background: T.panel, border: `1px solid ${T.hair}`,
                          borderRadius: T.rPill, padding: "3px 9px",
                          display: "flex", alignItems: "center", gap: 6,
                          cursor: s.path ? "pointer" : "default",
                          fontFamily: "YekanBakh, sans-serif", transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { if (s.path) { e.currentTarget.style.borderColor = T.goldLine; e.currentTarget.style.color = T.goldHi; } }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = T.hair; e.currentTarget.style.color = T.t2; }}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.mint, flexShrink: 0 }} />
                        <span style={{ maxWidth: 128, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                        <span style={{ fontFamily: "monospace", color: T.gold }}>{s.score?.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer — شناور با بوردر مویی */}
      <div style={{ padding: "0 34px 22px", flexShrink: 0 }}>
        <div className="panel" style={{ padding: 10, borderRadius: T.rPanel }}>
          <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="پرسش خود را بنویسید..." disabled={loading}
              style={{
                flex: 1, background: "transparent", border: "none",
                padding: "8px 12px", fontSize: 12.5, color: T.t1, outline: "none",
                fontFamily: "YekanBakh, sans-serif", caretColor: T.gold,
              }}
            />
            <button onClick={send} disabled={loading || !input.trim()} style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: T.goldDim, border: `1px solid ${T.goldLine}`, color: T.gold,
              cursor: "pointer", opacity: (loading || !input.trim()) ? 0.35 : 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, transition: "all 0.16s",
            }}>
              {loading
                ? <span className="anim-spin" style={{ width: 13, height: 13, border: `1.5px solid ${T.goldDim}`, borderTopColor: T.gold, borderRadius: "50%", display: "inline-block" }} />
                : "➤"}
            </button>
          </div>
          {messages.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-start", padding: "8px 12px 2px", borderTop: `1px solid ${T.hair}`, marginTop: 8 }}>
              <button onClick={() => setMessages([])} style={{
                background: "none", border: "none", color: T.t3, fontSize: 10, cursor: "pointer",
                padding: 0, fontFamily: "YekanBakh, sans-serif",
              }}>مکالمه جدید +</button>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* پنل مقاله — با کلیک روی چیپ منبع باز می‌شود */}
    {article && (
      <div className="panel anim-fadein" style={{
        width: 390, flexShrink: 0, margin: "0 0 22px 26px",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.hair}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: T.t1, margin: 0 }}>{article.title}</p>
            <p style={{ fontSize: 9.5, color: T.t3, margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{article.path}</p>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={() => openInObsidian(article.path)} style={{
              fontSize: 10, color: T.gold, background: T.goldDim,
              border: `1px solid ${T.goldLine}`, borderRadius: 7, padding: "4px 9px",
              cursor: "pointer", fontFamily: "YekanBakh, sans-serif",
            }}>Obsidian ↗</button>
            <button onClick={() => setArticle(null)} style={{ background: "none", border: "none", color: T.t3, cursor: "pointer", fontSize: 16, padding: "0 3px" }}>×</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {article.text === null
            ? <p className="anim-pulse" style={{ color: T.t3, textAlign: "center", paddingTop: 28, fontSize: 11.5 }}>در حال بارگذاری…</p>
            : <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", fontFamily: "YekanBakh, sans-serif", color: T.t2, lineHeight: 1.95, margin: 0 }}>{article.text}</pre>}
        </div>
      </div>
    )}
    </div>
  );
}

// ─── Vault Browser ─────────────────────────────────────────────────────────────
function VaultBrowser({ files, total }: { files: VaultFile[]; total: number }) {
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState("all");
  const [selected, setSelected] = useState<VaultFile | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  const folders = [...new Set(files.map((f) => f.folder))].sort();
  const counts = Object.fromEntries(folders.map((f) => [f, files.filter((v) => v.folder === f).length]));
  const filtered = files.filter((f) => {
    if (folder !== "all" && f.folder !== folder) return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openFile = async (f: VaultFile) => {
    setSelected(f); setContent(null); setLoadingFile(true);
    const r = await fetch(`/api/vault/${encodeURIComponent(f.path)}`);
    const d = await r.json();
    setContent(d.content ?? "خطا"); setLoadingFile(false);
  };

  return (
    <div style={{ display: "flex", gap: 12, height: "100%", overflow: "hidden" }}>
      {/* Folder rail */}
      <div className="panel" style={{ width: 190, flexShrink: 0, display: "flex", flexDirection: "column", padding: 10, gap: 8, overflow: "hidden" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو..."
          style={{
            background: "rgba(0,0,0,0.25)", border: `1px solid ${T.hair}`, borderRadius: T.rCtl,
            padding: "8px 12px", fontSize: 11.5, color: T.t1, outline: "none",
            fontFamily: "YekanBakh, sans-serif", transition: "border-color 0.15s", width: "100%",
          }}
          onFocus={e => e.target.style.borderColor = T.goldLine}
          onBlur={e => e.target.style.borderColor = T.hair}
        />
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
          {[{ id: "all", label: "همه یادداشت‌ها", icon: "◈", count: total },
            ...folders.map(f => ({ id: f, label: f.replace(/^\d+-/, ""), icon: folderIcon[f] ?? "📁", count: counts[f] }))
          ].map((item) => {
            const on = folder === item.id;
            return (
              <button key={item.id} onClick={() => setFolder(item.id)} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "7px 9px", borderRadius: 8, cursor: "pointer", textAlign: "right",
                background: on ? T.goldDim : "transparent",
                border: `1px solid ${on ? T.goldLine : "transparent"}`,
                color: on ? T.gold : T.t2, fontSize: 11.5, fontWeight: on ? 600 : 400,
                transition: "all 0.13s", fontFamily: "YekanBakh, sans-serif",
              }}>
                <span style={{ display: "flex", gap: 7, alignItems: "center", minWidth: 0 }}>
                  <span style={{ fontSize: 11, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                </span>
                <span style={{ fontSize: 9.5, color: T.t3, fontFamily: "monospace", flexShrink: 0 }}>{item.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
        {filtered.length === 0 && <p style={{ textAlign: "center", color: T.t3, paddingTop: 40, fontSize: 12 }}>یادداشتی یافت نشد</p>}
        {filtered.slice(0, 60).map((f) => {
          const on = selected?.path === f.path;
          return (
            <div key={f.path} onClick={() => openFile(f)} className="panel" style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "9px 14px", borderRadius: T.rCtl, cursor: "pointer",
              borderColor: on ? T.goldLine : T.hair,
              background: on ? T.goldDim : T.panel,
              transition: "all 0.15s",
            }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.borderColor = T.hair2; }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.borderColor = T.hair; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: on ? T.gold : T.mint, flexShrink: 0, opacity: on ? 1 : 0.55 }} />
                <span style={{ fontSize: 11.5, fontWeight: 500, color: on ? T.goldHi : T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 9.5, color: T.t3 }}>{f.folder.replace(/^\d+-/, "")}</span>
                <button onClick={(e) => { e.stopPropagation(); openInObsidian(f.path); }} style={{
                  fontSize: 10, color: T.gold, background: "transparent",
                  border: `1px solid ${T.goldLine}`, borderRadius: 6,
                  padding: "1px 6px", cursor: "pointer",
                }}>↗</button>
              </div>
            </div>
          );
        })}
        {filtered.length > 60 && <p style={{ textAlign: "center", fontSize: 10.5, color: T.t3, padding: "8px 0" }}>{filtered.length - 60} یادداشت بیشتر</p>}
      </div>

      {/* Detail rail */}
      {selected && (
        <div className="panel" style={{ width: 370, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.hair}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: T.t1, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.name}</p>
              <p style={{ fontSize: 9.5, color: T.t3, margin: "4px 0 0" }}>{selected.folder}</p>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => openInObsidian(selected.path)} style={{
                fontSize: 10, color: T.gold, background: T.goldDim,
                border: `1px solid ${T.goldLine}`, borderRadius: 7, padding: "4px 9px",
                cursor: "pointer", fontFamily: "YekanBakh, sans-serif",
              }}>Obsidian ↗</button>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: T.t3, cursor: "pointer", fontSize: 16, padding: "0 3px" }}>×</button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {loadingFile
              ? <p className="anim-pulse" style={{ color: T.t3, textAlign: "center", paddingTop: 28, fontSize: 11.5 }}>در حال بارگذاری…</p>
              : <pre style={{ fontSize: 10.5, whiteSpace: "pre-wrap", fontFamily: "YekanBakh, monospace", color: T.t2, lineHeight: 1.85, margin: 0 }}>{content}</pre>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Search ────────────────────────────────────────────────────────────────────
function SearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QdrantDoc[]>([]);
  const [searching, setSearching] = useState(false);
  const [isSemantic, setIsSemantic] = useState(false);
  const [selected, setSelected] = useState<QdrantDoc | null>(null);

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setSearching(true); setResults([]); setSelected(null);
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const d = await r.json();
    setResults(d.results ?? []); setIsSemantic(d.semantic ?? false); setSearching(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 13 }}>
      <form onSubmit={(e) => { e.preventDefault(); doSearch(query); }} className="panel" style={{ display: "flex", gap: 8, padding: 8, alignItems: "center" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجوی معنایی در متن اسناد Vault…"
          style={{
            flex: 1, background: "transparent", border: "none",
            padding: "8px 12px", fontSize: 12.5, color: T.t1, outline: "none",
            fontFamily: "YekanBakh, sans-serif", caretColor: T.gold,
          }}
        />
        <button type="submit" disabled={searching || !query.trim()} style={{
          background: T.goldDim, border: `1px solid ${T.goldLine}`, color: T.gold,
          borderRadius: T.rCtl, padding: "8px 20px", fontSize: 12, fontWeight: 600,
          cursor: "pointer", opacity: (searching || !query.trim()) ? 0.35 : 1,
          fontFamily: "YekanBakh, sans-serif", flexShrink: 0,
        }}>
          {searching ? <span className="anim-spin" style={{ width: 12, height: 12, border: `1.5px solid ${T.goldDim}`, borderTopColor: T.gold, borderRadius: "50%", display: "inline-block" }} /> : "جستجو"}
        </button>
      </form>

      {results.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Pill label={isSemantic ? "semantic · bge-m3" : "keyword"} tone={isSemantic ? T.lavender : T.t3} filled />
          <span style={{ fontSize: 10.5, color: T.t3 }}>{results.length} نتیجه</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {searching && <p className="anim-pulse" style={{ textAlign: "center", color: T.mint, fontSize: 12, paddingTop: 40 }}>در حال embedding و جستجوی معنایی…</p>}
          {!searching && results.length === 0 && query && <p style={{ textAlign: "center", color: T.t3, fontSize: 12, paddingTop: 40 }}>نتیجه‌ای یافت نشد</p>}
          {results.map((doc, i) => {
            const on = selected?.id === doc.id;
            const sc = doc.score ?? 0;
            const scTone = sc > 0.7 ? T.mint : sc > 0.5 ? T.warn : T.t3;
            return (
              <div key={doc.id} onClick={() => setSelected(doc)} className="panel" style={{
                padding: "11px 15px", borderRadius: T.rCtl, cursor: "pointer",
                borderColor: on ? T.goldLine : T.hair,
                background: on ? T.goldDim : T.panel, transition: "all 0.15s",
              }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.borderColor = T.hair2; }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.borderColor = T.hair; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 12, flexShrink: 0, opacity: 0.7 }}>{typeIcon[doc.entity_type ?? ""] ?? "📄"}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title ?? "—"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                    {doc.score != null && (
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: scTone }} />
                        <span style={{ fontSize: 9.5, fontFamily: "monospace", color: scTone }}>{sc.toFixed(2)}</span>
                      </span>
                    )}
                    <span style={{ fontSize: 9.5, color: T.t3, fontFamily: "monospace" }}>#{i + 1}</span>
                  </div>
                </div>
                <p style={{ fontSize: 10.5, color: T.t3, lineHeight: 1.65, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {doc.chunk_text?.slice(0, 140) ?? doc.text_preview?.slice(0, 140) ?? "—"}
                </p>
              </div>
            );
          })}
        </div>

        {selected && (
          <div className="panel" style={{ width: 350, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.hair}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: T.t1, margin: 0 }}>{selected.title}</p>
                <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                  {selected.entity_type && <span style={{ fontSize: 9.5, color: T.t3 }}>{selected.entity_type}</span>}
                  {selected.classification && <Pill label={selected.classification} tone={classTone[selected.classification] ?? T.t3} filled />}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: T.t3, cursor: "pointer", fontSize: 16, padding: "0 3px", flexShrink: 0 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {selected.entity_id && (
                <div style={{ marginBottom: 14 }}>
                  <LeaderRow k="شناسه" v={selected.entity_id} mono />
                </div>
              )}
              <p style={{ fontSize: 10.5, color: T.t2, lineHeight: 1.9, whiteSpace: "pre-wrap", margin: 0 }}>
                {selected.chunk_text ?? selected.text_preview ?? "—"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Documents ─────────────────────────────────────────────────────────────────
function DocumentsPanel({ docs, loading }: { docs: QdrantDoc[]; loading: boolean }) {
  const [filterType, setFilterType] = useState("all");
  const [selected, setSelected] = useState<QdrantDoc | null>(null);
  const types = [...new Set(docs.map((d) => d.entity_type).filter(Boolean))];
  const filtered = docs.filter((d) => filterType === "all" || d.entity_type === filterType);

  if (loading) return <p className="anim-pulse" style={{ textAlign: "center", color: T.t3, paddingTop: 40, fontSize: 12 }}>در حال بارگذاری…</p>;

  if (docs.length === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
      <div style={{
        width: 54, height: 54, borderRadius: "50%", marginBottom: 20,
        border: `1px solid ${T.hair2}`, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, color: T.t3,
      }}>▦</div>
      <p style={{ color: T.t1, fontWeight: 400, fontSize: 15, margin: "0 0 8px" }}>مجموعه Qdrant خالی است</p>
      <p style={{ color: T.t3, fontSize: 11.5, margin: "0 0 20px" }}>اسکریپت sync را در Terminal اجرا کنید</p>
      <code style={{
        fontSize: 10.5, color: T.gold, background: T.goldDim, padding: "8px 16px",
        borderRadius: T.rCtl, border: `1px solid ${T.goldLine}`, fontFamily: "monospace",
      }}>python3 scripts/sync_batch.py 0 4</code>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{
          background: T.panelSolid, border: `1px solid ${T.hair}`, borderRadius: T.rCtl,
          padding: "7px 13px", fontSize: 11.5, fontWeight: 500, color: T.t1, outline: "none",
          fontFamily: "YekanBakh, sans-serif",
        }}>
          <option value="all">همه انواع</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{ fontSize: 10.5, color: T.t3 }}>{filtered.length} سند</span>
      </div>

      <div style={{ display: "flex", gap: 12, flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
          {filtered.map((doc) => {
            const on = selected?.id === doc.id;
            return (
              <div key={doc.id} onClick={() => setSelected(doc)} className="panel" style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 14px", borderRadius: T.rCtl, cursor: "pointer",
                borderColor: on ? T.goldLine : T.hair,
                background: on ? T.goldDim : T.panel, transition: "all 0.15s",
              }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.borderColor = T.hair2; }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.borderColor = T.hair; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 12, flexShrink: 0, opacity: 0.7 }}>{typeIcon[doc.entity_type ?? ""] ?? "📄"}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 11.5, fontWeight: 600, color: T.t1, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title ?? "—"}</p>
                    {doc.text_preview && <p style={{ fontSize: 9.5, color: T.t3, margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.text_preview.slice(0, 76)}</p>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                  {doc.period_id && <span style={{ fontSize: 9.5, fontFamily: "monospace", color: T.t3 }}>{doc.period_id}</span>}
                  {doc.classification && <Pill label={doc.classification} tone={classTone[doc.classification] ?? T.t3} filled />}
                </div>
              </div>
            );
          })}
        </div>

        {selected && (
          <div className="panel" style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.hair}`, display: "flex", justifyContent: "space-between", gap: 10 }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: T.t1, margin: 0, minWidth: 0 }}>{selected.title}</p>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: T.t3, cursor: "pointer", fontSize: 16, padding: "0 3px", flexShrink: 0 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {/* Details — با خط راهنمای نقطه‌چین */}
              <p style={{ fontSize: 12, color: T.t1, fontWeight: 500, margin: "0 0 12px" }}>جزئیات</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
                {selected.entity_id   && <LeaderRow k="شناسه" v={selected.entity_id} mono />}
                {selected.entity_type && <LeaderRow k="نوع"   v={selected.entity_type} />}
                {selected.folder      && <LeaderRow k="پوشه"  v={selected.folder} />}
                {selected.period_id   && <LeaderRow k="دوره"  v={selected.period_id} mono />}
              </div>
              {selected.classification && (
                <div style={{ marginBottom: 18 }}>
                  <Pill label={selected.classification} tone={classTone[selected.classification] ?? T.t3} filled />
                </div>
              )}
              {(selected.chunk_text || selected.text_preview) && (
                <div>
                  <p style={{ fontSize: 12, color: T.t1, fontWeight: 500, margin: "0 0 8px" }}>محتوا</p>
                  <p style={{ fontSize: 10.5, color: T.t2, lineHeight: 1.9, margin: 0 }}>{(selected.chunk_text ?? selected.text_preview ?? "").slice(0, 320)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [active, setActive] = useState("chat");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [docs, setDocs] = useState<QdrantDoc[]>([]);
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);
  const [vaultTotal, setVaultTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/documents").then((r) => r.json()),
      fetch("/api/vault").then((r) => r.json()),
    ]).then(([s, d, v]) => {
      setStats(s); setDocs(d.documents ?? []); setVaultFiles(v.files ?? []); setVaultTotal(v.total ?? 0); setLoading(false);
    });
  }, []);

  const heads: Record<string, { eyebrow: string; title: string }> = {
    world:     { eyebrow: "رصد چشم‌انداز بین‌الملل", title: "داشبورد بین‌الملل" },
    chat:      { eyebrow: "پرسش از پایگاه دانش", title: "دستیار هوشمند" },
    graph:     { eyebrow: "شبکه‌ی روابط سازمانی", title: "گراف هوشمند سازمانی" },
    vault:     { eyebrow: "دفترچه یادداشت",      title: "مرورگر یادداشت‌ها" },
    search:    { eyebrow: "جستجو در متن اسناد",  title: "جستجوی معنایی" },
    documents: { eyebrow: "نمایه‌ی جستجو",       title: "اسناد نمایه‌شده" },
  };

  const indexed = stats?.total_documents ?? 0;
  const orgSigs = stats?.collections?.find(c => c.name === "org_signals")?.points ?? 0;
  // تعداد واقعی سند ایندکس‌شده؛ اگر Qdrant نتوانست بشمارد «—» نشان می‌دهیم
  // به‌جای عددی که از روی حدس ساخته شده باشد.
  const indexedDocs = stats?.indexed_documents;

  return (
    <div dir="rtl" style={{
      display: "flex", height: "100vh", overflow: "hidden", background: T.canvas,
      color: T.t1, fontFamily: "YekanBakh, system-ui, sans-serif", position: "relative",
    }}>
      {/* ── هاله رادیال — امضای بصری پلتفرم ── */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: `
          radial-gradient(ellipse 70% 55% at 46% 34%, rgba(20,88,74,0.42) 0%, rgba(10,46,39,0.18) 42%, transparent 72%),
          radial-gradient(ellipse 40% 40% at 78% 8%,  rgba(111,224,192,0.07) 0%, transparent 62%),
          radial-gradient(ellipse 50% 40% at 12% 88%, rgba(169,155,232,0.05) 0%, transparent 60%)
        `,
      }} />
      {/* وینیت */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 92% 78% at 50% 46%, transparent 42%, rgba(0,0,0,0.62) 100%)",
      }} />

      <Sidebar active={active} setActive={setActive} counts={{ vault: vaultTotal, qdrant: stats?.total_documents ?? 0 }} />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", minWidth: 0, overflow: "hidden", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <header style={{
          padding: "16px 26px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}>
          <div>
            <p style={{ fontSize: 9, color: T.t3, margin: 0, letterSpacing: "0.14em", fontWeight: 500 }}>{heads[active]?.eyebrow}</p>
            <h1 style={{ fontSize: 19, fontWeight: 400, color: T.t1, margin: "5px 0 0", letterSpacing: "-0.01em" }}>{heads[active]?.title}</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{
              display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: T.ok,
              border: `1px solid ${T.ok}33`, borderRadius: T.rPill, padding: "4px 11px",
            }}>
              <span className="anim-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: T.ok, display: "inline-block" }} />
              فعال
            </span>
            <Pill label="محیط توسعه" tone={T.warn} />
          </div>
        </header>

        {/* Metric strip */}
        {(active === "chat" || active === "documents") && (
          <div style={{ padding: "0 26px 4px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, flexShrink: 0 }}>
            <Metric label="یادداشت‌ها"        value={loading ? "—" : vaultTotal} unit="یادداشت" tone={T.rose} />
            <Metric label="قطعه‌ی قابل جستجو" value={loading ? "—" : indexed}    unit="قطعه"   tone={T.mint} />
            <Metric label="سند نمایه‌شده"     value={loading ? "—" : (indexedDocs ?? "—")} unit="سند" tone={T.lavender} />
            <Metric label="سیگنال اجتماعی"    value={loading ? "—" : orgSigs}    unit="سیگنال" tone={T.gold} />
          </div>
        )}

        {/* Content */}
        <div style={{
          flex: 1, overflow: "hidden", display: "flex", flexDirection: "column",
          // بدون minHeight صفر، این فلکس‌آیتم زیر ارتفاع محتوایش کوچک نمی‌شود و
          // پنل‌های بلند (مثل بازرس گراف) کل صفحه را از ویوپورت بیرون می‌برند.
          minHeight: 0,
          // گراف تمام فضای بوم را می‌گیرد، پس حاشیه‌ی صفحه برایش صفر است
          padding: active === "chat" ? "12px 0 0" : (active === "graph" || active === "world" || active === "coverage") ? 0 : "14px 26px 22px",
        }}>
          {active === "world"     && <InternationalDashboard reportCount={indexedDocs ?? null} onOpenGraph={() => setActive("graph")} onOpenChat={() => setActive("chat")} />}
          {active === "coverage"  && <KnowledgeCoverage />}
          {active === "chat"      && <ChatPanel />}
          {active === "graph"     && <IntelligenceGraph onOpenChat={() => setActive("chat")} />}
          {active === "vault"     && <VaultBrowser files={vaultFiles} total={vaultTotal} />}
          {active === "search"    && <SearchPanel />}
          {active === "documents" && <DocumentsPanel docs={docs} loading={loading} />}
        </div>
      </main>
    </div>
  );
}
