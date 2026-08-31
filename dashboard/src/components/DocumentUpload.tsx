"use client";

import { useCallback, useRef, useState } from "react";
import { T } from "@/lib/theme";
import { Badge, Button, Card, Grid, Input, Select, Spinner, Stack } from "@/components/ds";

type UploadState =
  | { phase: "idle" }
  | { phase: "reading" }
  | { phase: "extracting" }
  | { phase: "saving" }
  | { phase: "done"; title: string; country: string; topic: string; entityCount: number; summary: string; duplicate: boolean }
  | { phase: "error"; message: string };

const COUNTRIES = ["پاکستان","افغانستان","چین","تایلند","اندونزی","ژاپن","بنگلادش","ترکیه","ایران","عراق","سوریه","لبنان","سایر"];
const TOPICS    = ["","دین و مذاهب","روابط بین‌الملل و دیپلماسی","اقتصاد و توسعه","زنان، خانواده و جوانان","هنر، ادبیات و رسانه","سیاست و حکمرانی","آموزش و علم","حقوق، امنیت و بحران","تاریخ و میراث","فرهنگ و جامعه"];

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

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }} className="ds-page-pad">
      <p className="ds-eyebrow" style={{ marginBottom: 8 }}>DOCUMENT UPLOAD</p>
      <h2 className="ds-heading-lg" style={{ marginBottom: 6 }}>آپلود مقاله به پایگاه دانش</h2>
      <p className="ds-body" style={{ marginBottom: 24 }}>
        فایل را آپلود کنید — سیستم به‌طور خودکار موجودیت‌ها را استخراج می‌کند و سند در گراف، جستجو و دستیار قابل استفاده می‌شود.
      </p>

      {/* نتیجه */}
      {state.phase === "done" && (
        <Card variant="glass" style={{ marginBottom: 24, borderColor: "rgba(74,222,156,.28)", background: "rgba(74,222,156,.05)" }}>
          <Stack direction="row" gap={10} align="center" style={{ marginBottom: 14 }}>
            <Badge label={state.duplicate ? "تکراری" : "افزوده شد"} tone={state.duplicate ? "warn" : "ok"} dot />
            <span className="ds-heading-sm">{state.title}</span>
          </Stack>
          <Grid cols={3} gap={8} style={{ marginBottom: 12 }}>
            {([["کشور", state.country], ["موضوع", state.topic], [`${state.entityCount} موجودیت`, "استخراج‌شده"]] as [string,string][]).map(([l, v]) => (
              <div key={l} className="ds-card-solid" style={{ padding: "8px 11px", borderRadius: "var(--r-ctl)" }}>
                <p className="ds-heading-sm" style={{ marginBottom: 3 }}>{v}</p>
                <p className="ds-caption">{l}</p>
              </div>
            ))}
          </Grid>
          {state.summary && <p className="ds-body" style={{ marginBottom: 14 }}>{state.summary}</p>}
          <Button variant="primary" tone="gold" onClick={reset}>آپلود مقاله جدید</Button>
        </Card>
      )}

      {state.phase === "error" && (
        <Card variant="glass" style={{ marginBottom: 20, borderColor: "rgba(232,105,122,.28)", background: "rgba(232,105,122,.05)" }}>
          <Stack direction="row" gap={12} align="flex-start">
            <span style={{ color: "var(--bad)", fontSize: 16 }}>⚠</span>
            <Stack gap={6}>
              <p className="ds-body" style={{ color: "var(--bad)", fontWeight: 600, margin: 0 }}>{state.message}</p>
              <Button variant="ghost" size="sm" onClick={() => setState({ phase: "idle" })}>بستن</Button>
            </Stack>
          </Stack>
        </Card>
      )}

      {state.phase !== "done" && (
        <Stack gap={12}>
          {/* ناحیه drop */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !file && inputRef.current?.click()}
            style={{
              border: `1.5px dashed ${file ? T.goldLine : dragging ? T.mint : T.hair}`,
              borderRadius: 12, padding: "28px 20px", textAlign: "center",
              background: file ? T.goldDim : dragging ? "rgba(111,224,192,.06)" : "rgba(0,0,0,.18)",
              cursor: file ? "default" : "pointer", transition: "all .15s",
            }}>
            <input ref={inputRef} type="file" accept=".pdf,.docx,.txt,.html" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) acceptFile(f); }} />
            {file ? (
              <Stack direction="row" align="center" justify="center" gap={12}>
                <span style={{ fontSize: 28 }}>📄</span>
                <Stack gap={4} style={{ textAlign: "right" }}>
                  <p className="ds-heading-sm" style={{ color: "var(--gold)" }}>{file.name}</p>
                  <p className="ds-caption">{(file.size / 1024).toFixed(0)} KB</p>
                </Stack>
                <button onClick={e => { e.stopPropagation(); setFile(null); setState({ phase: "idle" }); }}
                  style={{ marginRight: "auto", background: "none", border: "none", color: T.t3, fontSize: 18, cursor: "pointer" }}>×</button>
              </Stack>
            ) : (
              <Stack gap={6} align="center">
                <div style={{ width: 44, height: 44, background: T.goldDim, border: `1px solid ${T.goldLine}`, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📤</div>
                <p className="ds-body">فایل را اینجا بکش یا کلیک کن</p>
                <p className="ds-caption">PDF · DOCX · TXT · HTML — حداکثر ۱۵ مگابایت</p>
              </Stack>
            )}
          </div>

          {/* متادیتا */}
          <Grid cols={2} gap={10}>
            <Select label="کشور" value={country} onChange={e => setCountry(e.target.value)}>
              <option value="">تشخیص خودکار (پیشنهادی)</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input label="تاریخ گزارش" type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ colorScheme: "dark" }} />
          </Grid>
          <Select label="موضوع اصلی" value={topic} onChange={e => setTopic(e.target.value)}>
            <option value="">تشخیص خودکار (پیشنهادی)</option>
            {TOPICS.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
          </Select>

          {/* وضعیت پردازش */}
          {busy && (
            <Card variant="solid" style={{ padding: "12px 16px" }}>
              <Stack direction="row" gap={10} align="center">
                <Spinner tone="gold" />
                <Stack gap={3}>
                  <p className="ds-heading-sm">
                    {state.phase === "reading" ? "در حال خواندن فایل…"
                      : state.phase === "extracting" ? "در حال استخراج با هوش مصنوعی…"
                      : "در حال ذخیره در پایگاه دانش…"}
                  </p>
                  <p className="ds-caption">این فرایند ممکن است ۳۰–۹۰ ثانیه طول بکشد</p>
                </Stack>
              </Stack>
            </Card>
          )}

          <Button
            variant={file && !busy ? "primary" : "outline"}
            tone="gold"
            size="lg"
            fullWidth
            loading={busy}
            disabled={!file || busy}
            onClick={submit}>
            {busy ? "در حال پردازش…" : "استخراج و افزودن به پایگاه دانش"}
          </Button>

          <p className="ds-caption" style={{ textAlign: "center", lineHeight: 1.7 }}>
            پس از افزودن، سند در گراف هوشمند، جستجوی معنایی و دستیار هوشمند قابل استفاده است.
          </p>
        </Stack>
      )}
    </div>
  );
}
