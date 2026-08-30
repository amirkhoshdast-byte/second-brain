"use client";

import { useCallback, useRef, useState } from "react";
import { T } from "@/lib/theme";

type UploadState =
  | { phase: "idle" }
  | { phase: "reading" }
  | { phase: "extracting" }
  | { phase: "saving" }
  | { phase: "done"; title: string; country: string; topic: string; entityCount: number; summary: string; duplicate: boolean }
  | { phase: "error"; message: string };

const COUNTRIES = ["پاکستان","افغانستان","چین","تایلند","اندونزی","ژاپن","بنگلادش","ترکیه","ایران","عراق","سوریه","لبنان","سایر"];
const TOPICS    = ["","دین و مذاهب","روابط بین‌الملل و دیپلماسی","اقتصاد و توسعه","زنان، خانواده و جوانان","هنر، ادبیات و رسانه","سیاست و حکمرانی","آموزش و علم","حقوق، امنیت و بحران","تاریخ و میراث","فرهنگ و جامعه"];

function Spinner() {
  return (
    <span style={{ display:"inline-block", width:14, height:14, border:`2px solid ${T.goldLine}`, borderTopColor:T.gold, borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
  );
}

export default function DocumentUpload({ onDone }: { onDone?: () => void }) {
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [country, setCountry] = useState("");
  const [topic, setTopic] = useState("");
  const [date, setDate] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = (f: File) => {
    const allowed = ["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","text/plain","text/html"];
    const extOk = /\.(pdf|docx|txt|html?)$/i.test(f.name);
    if (!allowed.includes(f.type) && !extOk) {
      setState({ phase:"error", message:"فرمت پشتیبانی نمی‌شود — PDF، DOCX یا TXT آپلود کنید." });
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      setState({ phase:"error", message:"حجم فایل بیش از ۱۵ مگابایت است." });
      return;
    }
    setFile(f);
    setState({ phase:"idle" });
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  }, []);

  const submit = async () => {
    if (!file) return;
    setState({ phase: "reading" });

    const fd = new FormData();
    fd.append("file", file);
    if (country) fd.append("country", country);
    if (topic)   fd.append("topic", topic);
    if (date)    fd.append("report_date", date);

    setState({ phase: "extracting" });
    try {
      const res  = await fetch("/api/upload", { method:"POST", body: fd });
      const data = await res.json();
      if (!data.ok) {
        setState({ phase:"error", message: data.error ?? "خطای ناشناخته" });
        return;
      }
      setState({
        phase: "done",
        title:       data.title ?? file.name,
        country:     data.country ?? "—",
        topic:       data.topic   ?? "—",
        entityCount: data.entityCount ?? 0,
        summary:     data.summary ?? "",
        duplicate:   data.duplicate ?? false,
      });
      onDone?.();
    } catch (err) {
      setState({ phase:"error", message: String(err) });
    }
  };

  const reset = () => { setFile(null); setCountry(""); setTopic(""); setDate(""); setState({ phase:"idle" }); };

  const busy = state.phase === "reading" || state.phase === "extracting" || state.phase === "saving";

  const inp: React.CSSProperties = {
    background: "rgba(0,0,0,0.28)",
    border: `1px solid ${T.hair}`,
    borderRadius: 8,
    padding: "9px 13px",
    fontSize: 12,
    color: T.t2,
    fontFamily: "YekanBakh, sans-serif",
    width: "100%",
    outline: "none",
    transition: "border-color .15s",
  };

  return (
    <div style={{ padding:"24px 28px", maxWidth:680, margin:"0 auto" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <p style={{ fontSize:9.5, fontWeight:700, letterSpacing:".12em", color:T.gold, marginBottom:8 }}>DOCUMENT UPLOAD</p>
      <h2 style={{ fontSize:20, fontWeight:700, color:T.t1, marginBottom:6 }}>آپلود مقاله به پایگاه دانش</h2>
      <p style={{ fontSize:11.5, color:T.t3, marginBottom:24, lineHeight:1.7 }}>
        فایل را آپلود کنید — سیستم به‌طور خودکار موجودیت‌ها را استخراج می‌کند و سند در گراف، جستجو و دستیار قابل استفاده می‌شود.
      </p>

      {/* ─── نتیجه ─── */}
      {state.phase === "done" && (
        <div style={{ background:"rgba(74,222,156,.07)", border:`1px solid rgba(74,222,156,.28)`, borderRadius:12, padding:"20px 22px", marginBottom:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <span style={{ fontSize:16 }}>✓</span>
            <span style={{ fontSize:13, fontWeight:700, color:T.ok }}>
              {state.duplicate ? "سند قبلاً موجود بود — تکراری" : "سند با موفقیت افزوده شد"}
            </span>
          </div>
          <p style={{ fontSize:13.5, fontWeight:600, color:T.t1, marginBottom:10 }}>{state.title}</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
            {[["کشور", state.country],["موضوع",state.topic],[`${state.entityCount} موجودیت`,"استخراج‌شده"]].map(([l,v])=>(
              <div key={l} style={{ background:"rgba(0,0,0,.22)", borderRadius:8, padding:"8px 11px" }}>
                <p style={{ fontSize:13, fontWeight:600, color:T.t1, margin:0 }}>{v}</p>
                <p style={{ fontSize:9, color:T.t3, margin:"3px 0 0" }}>{l}</p>
              </div>
            ))}
          </div>
          {state.summary && <p style={{ fontSize:11, color:T.t2, lineHeight:1.75, marginBottom:14 }}>{state.summary}</p>}
          <button onClick={reset} style={{ fontSize:11, color:T.gold, background:T.goldDim, border:`1px solid ${T.goldLine}`, borderRadius:8, padding:"7px 18px", cursor:"pointer", fontFamily:"YekanBakh,sans-serif" }}>
            آپلود مقاله جدید
          </button>
        </div>
      )}

      {state.phase === "error" && (
        <div style={{ background:"rgba(240,112,112,.07)", border:`1px solid rgba(240,112,112,.28)`, borderRadius:10, padding:"14px 18px", marginBottom:20, display:"flex", gap:12, alignItems:"flex-start" }}>
          <span>⚠</span>
          <div>
            <p style={{ fontSize:12, color:T.bad, fontWeight:600, margin:0 }}>{state.message}</p>
            <button onClick={() => setState({ phase:"idle" })} style={{ fontSize:10.5, color:T.t3, background:"none", border:"none", cursor:"pointer", padding:0, marginTop:6, fontFamily:"YekanBakh,sans-serif" }}>بستن</button>
          </div>
        </div>
      )}

      {state.phase !== "done" && (
        <>
          {/* ─── ناحیه drop ─── */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !file && inputRef.current?.click()}
            style={{
              border: `1.5px dashed ${file ? T.goldLine : dragging ? T.mint : T.hair}`,
              borderRadius:12, padding:"28px 20px", textAlign:"center",
              background: file ? T.goldDim : dragging ? "rgba(111,224,192,.06)" : "rgba(0,0,0,.18)",
              cursor: file ? "default" : "pointer", marginBottom:18,
              transition:"all .15s",
            }}>
            <input ref={inputRef} type="file" accept=".pdf,.docx,.txt,.html" style={{ display:"none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) acceptFile(f); }} />

            {file ? (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12 }}>
                <span style={{ fontSize:28 }}>📄</span>
                <div style={{ textAlign:"right" }}>
                  <p style={{ fontSize:13, fontWeight:600, color:T.gold, margin:0 }}>{file.name}</p>
                  <p style={{ fontSize:10.5, color:T.t3, margin:"4px 0 0" }}>{(file.size/1024).toFixed(0)} KB</p>
                </div>
                <button onClick={e => { e.stopPropagation(); setFile(null); setState({ phase:"idle" }); }}
                  style={{ marginRight:"auto", background:"none", border:"none", color:T.t3, fontSize:18, cursor:"pointer", lineHeight:1 }}>×</button>
              </div>
            ) : (
              <>
                <div style={{ width:44, height:44, background:T.goldDim, border:`1px solid ${T.goldLine}`, borderRadius:10, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:20, marginBottom:10 }}>📤</div>
                <p style={{ fontSize:13, color:T.t2, margin:"0 0 4px" }}>فایل را اینجا بکش یا کلیک کن</p>
                <p style={{ fontSize:10.5, color:T.t3 }}>PDF · DOCX · TXT · HTML — حداکثر ۱۵ مگابایت</p>
              </>
            )}
          </div>

          {/* ─── متادیتا ─── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div>
              <p style={{ fontSize:9.5, color:T.t3, fontWeight:600, marginBottom:5 }}>کشور</p>
              <select value={country} onChange={e => setCountry(e.target.value)} style={{ ...inp }}>
                <option value="">تشخیص خودکار (پیشنهادی)</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <p style={{ fontSize:9.5, color:T.t3, fontWeight:600, marginBottom:5 }}>تاریخ گزارش</p>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ ...inp, colorScheme:"dark" }} />
            </div>
          </div>
          <div style={{ marginBottom:20 }}>
            <p style={{ fontSize:9.5, color:T.t3, fontWeight:600, marginBottom:5 }}>موضوع اصلی</p>
            <select value={topic} onChange={e => setTopic(e.target.value)} style={{ ...inp }}>
              <option value="">تشخیص خودکار (پیشنهادی)</option>
              {TOPICS.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* ─── وضعیت پردازش ─── */}
          {busy && (
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", background:"rgba(0,0,0,.22)", border:`1px solid ${T.hair}`, borderRadius:10, marginBottom:16 }}>
              <Spinner />
              <div>
                <p style={{ fontSize:12, color:T.t1, margin:0, fontWeight:600 }}>
                  {state.phase === "reading"    ? "در حال خواندن فایل…"           :
                   state.phase === "extracting" ? "در حال استخراج با هوش مصنوعی…" :
                                                  "در حال ذخیره در پایگاه دانش…"}
                </p>
                <p style={{ fontSize:10, color:T.t3, margin:"3px 0 0" }}>این فرایند ممکن است ۳۰–۹۰ ثانیه طول بکشد</p>
              </div>
            </div>
          )}

          <button
            onClick={submit}
            disabled={!file || busy}
            style={{
              width:"100%", padding:"11px 0", borderRadius:10, fontSize:13, fontWeight:700,
              fontFamily:"YekanBakh,sans-serif", cursor: file && !busy ? "pointer" : "not-allowed",
              background: file && !busy ? T.goldDim : "rgba(0,0,0,.2)",
              border: `1px solid ${file && !busy ? T.goldLine : T.hair}`,
              color: file && !busy ? T.gold : T.t3,
              transition:"all .15s",
            }}>
            {busy ? "در حال پردازش…" : "استخراج و افزودن به پایگاه دانش"}
          </button>

          <p style={{ fontSize:10, color:T.t3, marginTop:10, textAlign:"center", lineHeight:1.6 }}>
            پس از افزودن، سند در گراف هوشمند، جستجوی معنایی و دستیار هوشمند قابل استفاده است.
          </p>
        </>
      )}
    </div>
  );
}
