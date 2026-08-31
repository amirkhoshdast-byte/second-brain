"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Divider, EmptyState, Grid, Input, MetricCard, PageSection, Select, Spinner, Stack } from "@/components/ds";

// ─── Types ─────────────────────────────────────────────────────────────────────

type AdminStats = {
  overview: { total_docs: number; with_date: number; with_country: number; with_summary: number; this_week: number; today: number };
  byCountry: { country: string; n: number }[];
  byEntityType: { etype: string; n: number }[];
  byDocType: { doc_type: string; n: number }[];
  recentDocs: DocRow[];
  issues: { no_date: number; no_country: number; no_summary: number; low_confidence: number };
};

type DocRow = {
  id: number; title: string; country: string | null; region: string | null;
  folder: string | null; doc_type: string | null; source_name: string | null;
  report_date: string | null; confidence: number | null; extracted_at: string;
  ai_summary: string | null; entity_count: number;
};

type EntityRow = { id: number; etype: string; name: string; doc_count: number };

type Tab = "overview" | "documents" | "entities" | "feedback";

const ETYPES = ["", "person", "org", "event", "topic", "country"];
const COUNTRIES = ["", "پاکستان", "افغانستان", "چین", "تایلند", "اندونزی", "ژاپن", "بنگلادش", "ترکیه", "ایران"];
const DOC_TYPES = ["", "report", "uploaded", "bulk", "web", "country", "signal"];

const ETYPE_LABEL: Record<string, string> = {
  person: "شخص", org: "سازمان", event: "رویداد", topic: "موضوع", country: "کشور",
};
const ETYPE_TONE: Record<string, "mint" | "rose" | "lavender" | "sky" | "gold"> = {
  person: "rose", org: "mint", event: "lavender", topic: "sky", country: "gold",
};

// ─── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ stats }: { stats: AdminStats }) {
  const { overview, issues, byCountry, byEntityType, recentDocs } = stats;

  return (
    <Stack gap={20}>
      {/* KPI row */}
      <div className="ds-metric-strip">
        <MetricCard label="کل اسناد"   value={overview.total_docs}  tone="gold" />
        <MetricCard label="این هفته"   value={overview.this_week}   tone="mint" />
        <MetricCard label="امروز"      value={overview.today}       tone="lavender" />
        <MetricCard label="با خلاصه"   value={overview.with_summary} unit={`از ${overview.total_docs}`} tone="sky" />
      </div>

      {/* Issues */}
      {(issues.no_date > 0 || issues.no_country > 0 || issues.low_confidence > 0) && (
        <Card variant="glass" style={{ borderColor: "rgba(232,180,74,.3)", background: "rgba(232,180,74,.04)" }}>
          <PageSection eyebrow="نیاز به بررسی" title="مشکلات داده" style={{ marginBottom: 12 }} />
          <div className="ds-grid ds-grid-3" style={{ gap: 8 }}>
            {[
              { label: "بدون تاریخ",     n: issues.no_date,         tone: "warn" as const },
              { label: "بدون کشور",      n: issues.no_country,      tone: "warn" as const },
              { label: "اطمینان پایین",  n: issues.low_confidence,  tone: "bad" as const },
            ].map(({ label, n, tone }) => (
              <div key={label} className="ds-card-solid" style={{ padding: "10px 14px", borderRadius: "var(--r-ctl)" }}>
                <p style={{ fontSize: 22, fontWeight: 700, color: `var(--${tone})`, margin: "0 0 4px" }}>{n}</p>
                <p className="ds-caption">{label}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Grid cols={2} gap={16}>
        {/* کشورها */}
        <Card variant="solid">
          <PageSection eyebrow="توزیع جغرافیایی" title="کشورها" style={{ marginBottom: 12 }} />
          <Stack gap={6}>
            {byCountry.map(({ country, n }) => {
              const pct = Math.round((n / overview.total_docs) * 100);
              return (
                <div key={country}>
                  <div className="ds-flex-between" style={{ marginBottom: 3 }}>
                    <span className="ds-body">{country}</span>
                    <span className="ds-caption">{n} ({pct}٪)</span>
                  </div>
                  <div style={{ height: 3, background: "var(--hair)", borderRadius: 4 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "var(--gold)", borderRadius: 4, transition: "width .4s" }} />
                  </div>
                </div>
              );
            })}
          </Stack>
        </Card>

        {/* موجودیت‌ها */}
        <Card variant="solid">
          <PageSection eyebrow="انواع موجودیت" title="موجودیت‌ها" style={{ marginBottom: 12 }} />
          <Stack gap={8}>
            {byEntityType.map(({ etype, n }) => (
              <div key={etype} className="ds-flex-between">
                <Badge label={ETYPE_LABEL[etype] ?? etype} tone={ETYPE_TONE[etype] ?? "gold"} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>{n.toLocaleString()}</span>
              </div>
            ))}
          </Stack>
        </Card>
      </Grid>

      {/* آخرین اسناد */}
      <Card variant="solid">
        <PageSection eyebrow="آخرین فعالیت" title="اسناد اخیر" style={{ marginBottom: 12 }} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--hair)" }}>
                {["عنوان", "کشور", "نوع", "موجودیت", "اطمینان", "تاریخ استخراج"].map(h => (
                  <th key={h} style={{ padding: "6px 10px", color: "var(--text-3)", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentDocs.map(doc => (
                <tr key={doc.id} style={{ borderBottom: "1px solid var(--hair)" }}>
                  <td style={{ padding: "8px 10px", color: "var(--text-1)", maxWidth: 220 }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</span>
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--text-2)", whiteSpace: "nowrap" }}>{doc.country ?? "—"}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <Badge label={doc.doc_type ?? "—"} tone="gold" />
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--text-2)", textAlign: "center" }}>{doc.entity_count}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <ConfBar val={doc.confidence ?? 0} />
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--text-3)", whiteSpace: "nowrap" }}>
                    {new Date(doc.extracted_at).toLocaleDateString("fa-IR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Stack>
  );
}

// ─── ConfBar ───────────────────────────────────────────────────────────────────

function ConfBar({ val }: { val: number }) {
  const tone = val >= 0.7 ? "var(--ok)" : val >= 0.4 ? "var(--warn)" : "var(--bad)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 40, height: 3, background: "var(--hair)", borderRadius: 4 }}>
        <div style={{ width: `${Math.round(val * 100)}%`, height: "100%", background: tone, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 10, color: tone }}>{Math.round(val * 100)}٪</span>
    </div>
  );
}

// ─── Tab: Documents ────────────────────────────────────────────────────────────

function DocumentsTab() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [docType, setDocType] = useState("");
  const [editing, setEditing] = useState<DocRow | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "30" });
    if (q)       params.set("q", q);
    if (country) params.set("country", country);
    if (docType) params.set("doc_type", docType);
    const r = await fetch(`/api/admin/documents?${params}`).then(r => r.json());
    setDocs(r.docs ?? []); setTotal(r.total ?? 0); setPages(r.pages ?? 1); setPage(p);
    setLoading(false);
  }, [q, country, docType]);

  useEffect(() => { load(1); }, [load]);

  const deleteDoc = async (id: number) => {
    setDeleting(id);
    await fetch(`/api/admin/documents?id=${id}`, { method: "DELETE" });
    setDeleting(null);
    load(page);
  };

  return (
    <Stack gap={16}>
      {/* فیلترها */}
      <Card variant="solid">
        <div className="ds-grid ds-grid-3" style={{ gap: 10 }}>
          <Input placeholder="جستجو در عنوان و خلاصه…" value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load(1)} />
          <Select value={country} onChange={e => setCountry(e.target.value)}>
            <option value="">همه کشورها</option>
            {COUNTRIES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={docType} onChange={e => setDocType(e.target.value)}>
            <option value="">همه انواع</option>
            {DOC_TYPES.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
      </Card>

      {/* جدول */}
      <Card variant="solid">
        <div className="ds-flex-between" style={{ marginBottom: 12 }}>
          <p className="ds-caption">{total.toLocaleString()} سند</p>
          {loading && <Spinner size={13} />}
        </div>
        <div className="ds-scroll-x">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--hair)" }}>
                {["عنوان", "کشور", "نوع", "موجودیت‌ها", "اطمینان", "تاریخ گزارش", ""].map(h => (
                  <th key={h} style={{ padding: "6px 10px", color: "var(--text-3)", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <tr key={doc.id} style={{ borderBottom: "1px solid var(--hair)" }} className="ds-card-hover">
                  <td style={{ padding: "9px 10px", maxWidth: 260 }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-1)", fontWeight: 500 }}>{doc.title}</span>
                    {doc.source_name && <span className="ds-caption">{doc.source_name}</span>}
                  </td>
                  <td style={{ padding: "9px 10px", color: "var(--text-2)", whiteSpace: "nowrap" }}>{doc.country ?? "—"}</td>
                  <td style={{ padding: "9px 10px" }}><Badge label={doc.doc_type ?? "—"} tone="gold" /></td>
                  <td style={{ padding: "9px 10px", textAlign: "center", color: "var(--text-2)" }}>{doc.entity_count}</td>
                  <td style={{ padding: "9px 10px" }}><ConfBar val={doc.confidence ?? 0} /></td>
                  <td style={{ padding: "9px 10px", color: "var(--text-3)", whiteSpace: "nowrap" }}>
                    {doc.report_date ? new Date(doc.report_date).toLocaleDateString("fa-IR") : "—"}
                  </td>
                  <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>
                    <Stack direction="row" gap={6}>
                      <Button size="sm" variant="outline" tone="gold" onClick={() => setEditing(doc)}>ویرایش</Button>
                      <Button size="sm" variant="danger" loading={deleting === doc.id}
                        onClick={() => { if (confirm(`حذف «${doc.title}»؟`)) deleteDoc(doc.id); }}>حذف</Button>
                    </Stack>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && docs.length === 0 && <EmptyState icon="◎" title="سندی یافت نشد" description="فیلترها را تغییر دهید" />}
        </div>

        {/* صفحه‌بندی */}
        {pages > 1 && (
          <div className="ds-flex-between" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--hair)" }}>
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => load(page - 1)}>← قبلی</Button>
            <span className="ds-caption">صفحه {page} از {pages}</span>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => load(page + 1)}>بعدی →</Button>
          </div>
        )}
      </Card>

      {/* دیالوگ ویرایش */}
      {editing && <EditDocDialog doc={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(page); }} />}
    </Stack>
  );
}

// ─── Edit Dialog ───────────────────────────────────────────────────────────────

function EditDocDialog({ doc, onClose, onSaved }: { doc: DocRow; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle]     = useState(doc.title ?? "");
  const [country, setCountry] = useState(doc.country ?? "");
  const [date, setDate]       = useState(doc.report_date?.slice(0, 10) ?? "");
  const [docType, setDocType] = useState(doc.doc_type ?? "");
  const [saving, setSaving]   = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch("/api/admin/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: doc.id, title, country: country || null, report_date: date || null, doc_type: docType || null }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <Card variant="glass" style={{ position: "relative", zIndex: 1, width: "min(520px, 92vw)", maxHeight: "90vh", overflowY: "auto" }}>
        <PageSection eyebrow="ویرایش سند" title={doc.title.slice(0, 50)} style={{ marginBottom: 20 }}
          action={<Button size="sm" variant="ghost" onClick={onClose}>✕</Button>} />
        <Stack gap={12}>
          <Input label="عنوان" value={title} onChange={e => setTitle(e.target.value)} />
          <Grid cols={2} gap={10}>
            <Select label="کشور" value={country} onChange={e => setCountry(e.target.value)}>
              <option value="">انتخاب کشور</option>
              {COUNTRIES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input label="تاریخ گزارش" type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ colorScheme: "dark" }} />
          </Grid>
          <Select label="نوع سند" value={docType} onChange={e => setDocType(e.target.value)}>
            {DOC_TYPES.map(t => <option key={t} value={t}>{t || "انتخاب نوع"}</option>)}
          </Select>
          <Divider />
          <Stack direction="row" gap={10} justify="flex-end">
            <Button variant="ghost" onClick={onClose}>لغو</Button>
            <Button variant="primary" tone="gold" loading={saving} onClick={save}>ذخیره</Button>
          </Stack>
        </Stack>
      </Card>
    </div>
  );
}

// ─── Tab: Entities ─────────────────────────────────────────────────────────────

function EntitiesTab() {
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [etype, setEtype] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (q)     params.set("q", q);
    if (etype) params.set("etype", etype);
    const r = await fetch(`/api/admin/entities?${params}`).then(r => r.json());
    setEntities(r.entities ?? []); setTotal(r.total ?? 0); setPages(r.pages ?? 1); setPage(p);
    setLoading(false);
  }, [q, etype]);

  useEffect(() => { load(1); }, [load]);

  const saveEdit = async (id: number) => {
    setSaving(true);
    await fetch("/api/admin/entities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName }),
    });
    setSaving(false);
    setEditingId(null);
    load(page);
  };

  const deleteEnt = async (id: number, name: string) => {
    if (!confirm(`حذف موجودیت «${name}»؟`)) return;
    await fetch(`/api/admin/entities?id=${id}`, { method: "DELETE" });
    load(page);
  };

  return (
    <Stack gap={16}>
      <Card variant="solid">
        <div className="ds-grid ds-grid-2" style={{ gap: 10 }}>
          <Input placeholder="جستجو در نام موجودیت‌ها…" value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load(1)} />
          <Select value={etype} onChange={e => setEtype(e.target.value)}>
            <option value="">همه انواع</option>
            {ETYPES.filter(Boolean).map(t => <option key={t} value={t}>{ETYPE_LABEL[t] ?? t}</option>)}
          </Select>
        </div>
      </Card>

      <Card variant="solid">
        <div className="ds-flex-between" style={{ marginBottom: 12 }}>
          <p className="ds-caption">{total.toLocaleString()} موجودیت</p>
          {loading && <Spinner size={13} />}
        </div>
        <div className="ds-scroll-x">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--hair)" }}>
                {["نوع", "نام", "تعداد اسناد", ""].map(h => (
                  <th key={h} style={{ padding: "6px 10px", color: "var(--text-3)", fontWeight: 600, textAlign: "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entities.map(ent => (
                <tr key={ent.id} style={{ borderBottom: "1px solid var(--hair)" }}>
                  <td style={{ padding: "8px 10px" }}>
                    <Badge label={ETYPE_LABEL[ent.etype] ?? ent.etype} tone={ETYPE_TONE[ent.etype] ?? "gold"} />
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--text-1)" }}>
                    {editingId === ent.id ? (
                      <Stack direction="row" gap={6}>
                        <Input value={editName} onChange={e => setEditName(e.target.value)}
                          style={{ padding: "5px 10px", fontSize: 11 }}
                          onKeyDown={e => e.key === "Enter" && saveEdit(ent.id)} />
                        <Button size="sm" variant="primary" tone="gold" loading={saving} onClick={() => saveEdit(ent.id)}>✓</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>✕</Button>
                      </Stack>
                    ) : (
                      <span style={{ fontWeight: 500 }}>{ent.name}</span>
                    )}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>{ent.doc_count}</span>
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <Stack direction="row" gap={6}>
                      <Button size="sm" variant="outline" tone="gold"
                        onClick={() => { setEditingId(ent.id); setEditName(ent.name); }}>ویرایش</Button>
                      <Button size="sm" variant="danger"
                        onClick={() => deleteEnt(ent.id, ent.name)}>حذف</Button>
                    </Stack>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && entities.length === 0 && <EmptyState icon="◎" title="موجودیتی یافت نشد" />}
        </div>
        {pages > 1 && (
          <div className="ds-flex-between" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--hair)" }}>
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => load(page - 1)}>← قبلی</Button>
            <span className="ds-caption">صفحه {page} از {pages}</span>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => load(page + 1)}>بعدی →</Button>
          </div>
        )}
      </Card>
    </Stack>
  );
}

// ─── Feedback Tab ──────────────────────────────────────────────────────────────

type FeedbackStats = {
  positive: number; negative: number; total: number; satisfaction: number | null;
  recent: Array<{ id: number; question: string; rating: number; created_at: string }>;
  worst: Array<{ question: string; answer: string; created_at: string }>;
};

function FeedbackTab() {
  const [data, setData] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWorst, setShowWorst] = useState(false);

  useEffect(() => {
    fetch("/api/rag/feedback").then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <Stack align="center" justify="center" style={{ minHeight: 200 }}><Spinner size={24} /></Stack>;
  if (!data) return null;

  const pct = data.satisfaction;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* KPI */}
      <div className="ds-metric-strip">
        <MetricCard label="کل بازخورد" value={data.total} unit="رأی" tone="sky" />
        <MetricCard label="مثبت 👍" value={data.positive} unit="رأی" tone="mint" />
        <MetricCard label="منفی 👎" value={data.negative} unit="رأی" tone="rose" />
        <MetricCard label="رضایت" value={pct !== null ? `${pct}٪` : "—"} tone="gold" />
      </div>

      {data.total === 0 ? (
        <EmptyState icon="◈" title="هنوز بازخوردی ثبت نشده" description="بعد از هر پاسخ دستیار، دکمه‌های 👍/👎 نمایش داده می‌شوند." />
      ) : (
        <>
          {/* رضایت بار */}
          {pct !== null && (
            <Card>
              <p className="ds-label" style={{ marginBottom: 10 }}>نرخ رضایت کلی</p>
              <div style={{ height: 10, borderRadius: 5, background: "var(--hair)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: pct >= 70 ? "var(--ok)" : pct >= 40 ? "var(--warn)" : "var(--bad)", borderRadius: 5, transition: "width 0.4s" }} />
              </div>
              <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 6 }}>{data.positive} مثبت از {data.total} رأی</p>
            </Card>
          )}

          {/* آخرین بازخوردها */}
          <div>
            <p className="ds-label" style={{ marginBottom: 10 }}>آخرین بازخوردها</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.recent.map(r => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "var(--panel-solid)", border: "1px solid var(--hair)" }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{r.rating === 1 ? "👍" : "👎"}</span>
                  <span style={{ flex: 1, fontSize: 11, color: "var(--t2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.question}</span>
                  <span style={{ fontSize: 9, color: "var(--t3)", flexShrink: 0 }}>{new Date(r.created_at).toLocaleDateString("fa-IR")}</span>
                </div>
              ))}
            </div>
          </div>

          {/* پاسخ‌های ضعیف */}
          {data.worst.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <p className="ds-label">{`پرسش‌های با رأی منفی (${data.worst.length})`}</p>
                <Button variant="ghost" size="sm" onClick={() => setShowWorst(v => !v)}>
                  {showWorst ? "پنهان" : "نمایش"}
                </Button>
              </div>
              {showWorst && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.worst.map((w, i) => (
                    <Card key={i} variant="solid">
                      <p style={{ fontSize: 10, fontWeight: 600, color: "var(--bad)", marginBottom: 4 }}>❌ {w.question}</p>
                      <p style={{ fontSize: 10, color: "var(--t3)", lineHeight: 1.7, margin: 0 }}>{w.answer.slice(0, 200)}{w.answer.length > 200 ? "…" : ""}</p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats").then(r => r.json()).then(d => { setStats(d); setLoadingStats(false); });
  }, []);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview",  label: "نمای کلی",    icon: "◍" },
    { id: "documents", label: "اسناد",        icon: "▦" },
    { id: "entities",  label: "موجودیت‌ها",  icon: "⬡" },
    { id: "feedback",  label: "بازخورد",      icon: "◈" },
  ];

  return (
    <div className="ds-page-pad">
      {/* Header */}
      <Stack direction="row" align="center" justify="space-between" style={{ marginBottom: 20 }}>
        <div>
          <p className="ds-eyebrow" style={{ marginBottom: 4 }}>ADMIN PANEL</p>
          <h2 className="ds-heading-lg">مدیریت پایگاه دانش</h2>
        </div>
        {stats && (
          <Badge
            label={`${stats.overview.total_docs.toLocaleString()} سند`}
            tone="gold"
          />
        )}
      </Stack>

      {/* Tabs */}
      <Stack direction="row" gap={4} style={{ marginBottom: 20, borderBottom: "1px solid var(--hair)", paddingBottom: 0 }}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 16px", borderRadius: "var(--r-ctl) var(--r-ctl) 0 0",
              background: active ? "var(--panel-solid)" : "transparent",
              border: `1px solid ${active ? "var(--hair)" : "transparent"}`,
              borderBottom: active ? "1px solid var(--panel-solid)" : "none",
              color: active ? "var(--gold)" : "var(--text-3)",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: "YekanBakh, sans-serif",
              marginBottom: active ? -1 : 0,
            }}>
              <span>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </Stack>

      {/* Content */}
      {loadingStats && tab === "overview" ? (
        <Stack align="center" justify="center" style={{ minHeight: 200 }}>
          <Spinner size={24} />
          <p className="ds-caption">در حال بارگذاری آمار…</p>
        </Stack>
      ) : (
        <>
          {tab === "overview"  && stats && <OverviewTab stats={stats} />}
          {tab === "documents" && <DocumentsTab />}
          {tab === "entities"  && <EntitiesTab />}
          {tab === "feedback"  && <FeedbackTab />}
        </>
      )}
    </div>
  );
}
