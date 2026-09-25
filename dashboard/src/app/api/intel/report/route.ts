import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

let pool: Pool | null = null;
function db() {
  if (!pool) pool = new Pool({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    max: 4, idleTimeoutMillis: 20000,
  });
  return pool;
}

const FA_MONTHS: Record<string, string> = {
  "01": "فروردین", "02": "اردیبهشت", "03": "خرداد",
  "04": "تیر",     "05": "مرداد",     "06": "شهریور",
  "07": "مهر",     "08": "آبان",       "09": "آذر",
  "10": "دی",      "11": "بهمن",       "12": "اسفند",
};
function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${FA_MONTHS[m] ?? m} ${y}`;
}

const STYPE_FA: Record<string, string> = { trend: "روند", signal: "سیگنال", insight: "بینش" };
const STYPE_COLOR: Record<string, string> = { trend: "#7c6af7", signal: "rgb(79,209,165)", insight: "#38bdf8" };
const DIR_MARK: Record<string, string> = { up: "↑", down: "↓", flat: "→" };
const DIR_COLOR: Record<string, string> = { up: "#4ade80", down: "#f87171", flat: "#94a3b8" };
const ETYPE_COLOR: Record<string, string> = { person: "#fbbf24", org: "#a78bfa", event: "#f97316", topic: "rgb(79,209,165)" };
const ETYPE_FA: Record<string, string> = { person: "شخص", org: "سازمان", event: "رویداد", topic: "موضوع" };

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") ?? null;
  const c = db();

  try {
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.toISOString().slice(0, 7);

    const countryFilter = country ? `AND d.country = '${country.replace(/'/g, "''")}'` : "";
    const signalCountryFilter = country ? `AND country = '${country.replace(/'/g, "''")}'` : "";

    const [statsRes, countriesRes, signalsRes, entitiesRes, timelineRes, topDocsRes, periodRes] = await Promise.all([

      // آمار کلی
      c.query(`
        SELECT count(*)::int total_docs,
               count(DISTINCT country)::int total_countries,
               count(*) FILTER (WHERE report_date >= date_trunc('month', now()))::int this_month_docs,
               count(*) FILTER (WHERE report_date >= date_trunc('month', now() - interval '1 month')
                                  AND report_date < date_trunc('month', now()))::int last_month_docs,
               to_char(min(report_date),'YYYY-MM-DD') min_date,
               to_char(max(report_date),'YYYY-MM-DD') max_date
        FROM intel.document d WHERE 1=1 ${countryFilter}
      `),

      // ۱۰ کشور برتر
      c.query(`
        SELECT coalesce(country,'نامشخص') country, count(*)::int n
        FROM intel.document d WHERE 1=1 ${countryFilter}
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10
      `),

      // سیگنال‌ها
      c.query(`
        SELECT stype, title, description, confidence::float, direction, country, topic, importance
        FROM intel.signal WHERE 1=1 ${signalCountryFilter}
        ORDER BY confidence DESC, importance DESC NULLS LAST LIMIT 20
      `),

      // موجودیت‌های برتر
      c.query(`
        SELECT e.name, e.etype, count(m.document_id)::int n
        FROM intel.entity e
        JOIN intel.mention m ON m.entity_id = e.id
        JOIN intel.document d ON d.id = m.document_id
        WHERE e.etype IN ('person','org','event') ${countryFilter}
        GROUP BY e.id, e.name, e.etype
        ORDER BY n DESC LIMIT 15
      `),

      // خط زمانی ۱۸ ماه
      c.query(`
        SELECT to_char(date_trunc('month', report_date),'YYYY-MM') ym, count(*)::int n
        FROM intel.document d
        WHERE report_date IS NOT NULL ${countryFilter}
        GROUP BY 1 ORDER BY 1 ASC
      `),

      // ۸ سند اخیر
      c.query(`
        SELECT title, to_char(report_date,'YYYY-MM-DD') report_date,
               coalesce(country,'') country, ai_summary
        FROM intel.document d
        WHERE 1=1 ${countryFilter}
        ORDER BY report_date DESC NULLS LAST LIMIT 8
      `),

      // مقایسه این ماه vs ماه قبل
      c.query(`
        SELECT
          count(*) FILTER (WHERE to_char(report_date,'YYYY-MM') = $1)::int this_docs,
          count(*) FILTER (WHERE to_char(report_date,'YYYY-MM') = $2)::int last_docs,
          (SELECT count(*) FROM intel.signal
           WHERE created_at >= date_trunc('month', now()) ${signalCountryFilter.replace('AND', 'AND')})::int this_signals,
          (SELECT count(*) FROM intel.signal
           WHERE created_at >= date_trunc('month', now() - interval '1 month')
             AND created_at < date_trunc('month', now()) ${signalCountryFilter.replace('AND', 'AND')})::int last_signals
        FROM intel.document d WHERE 1=1 ${countryFilter}
      `, [thisMonth, lastMonth]),
    ]);

    const stats = statsRes.rows[0];
    const period = periodRes.rows[0];
    const today = now.toISOString().slice(0, 10);

    const docDelta = (period.this_docs ?? 0) - (period.last_docs ?? 0);
    const sigDelta = (period.this_signals ?? 0) - (period.last_signals ?? 0);

    const deltaSpan = (n: number, label: string) => {
      if (n === 0) return `<span style="color:#64748b">بدون تغییر ${label}</span>`;
      const color = n > 0 ? "#4ade80" : "#f87171";
      const arrow = n > 0 ? "↑" : "↓";
      return `<span style="color:${color}">${arrow}${Math.abs(n)} ${label} نسبت به ماه قبل</span>`;
    };

    const maxTL = Math.max(...timelineRes.rows.map((r: { n: number }) => r.n), 1);
    const timelineBars = timelineRes.rows.map((r: { ym: string; n: number }) => {
      const h = Math.max(6, Math.round((r.n / maxTL) * 72));
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;min-width:0">
        <div style="width:100%;height:${h}px;background:rgb(79,209,165);border-radius:3px 3px 0 0;opacity:0.8"></div>
        <span style="font-size:7px;color:#64748b;white-space:nowrap">${formatMonth(r.ym).slice(0, 3)}</span>
      </div>`;
    }).join("");

    const maxCountry = Math.max(...countriesRes.rows.map((r: { n: number }) => r.n), 1);
    const countryBars = countriesRes.rows.map((r: { country: string; n: number }) => {
      const pct = Math.round((r.n / maxCountry) * 100);
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
        <span style="width:72px;font-size:10px;color:#cbd5e1;text-align:right;flex-shrink:0">${r.country}</span>
        <div style="flex:1;background:#1e293b;border-radius:2px;height:10px">
          <div style="width:${pct}%;background:rgb(79,209,165);height:100%;border-radius:2px;opacity:0.8"></div>
        </div>
        <span style="font-size:10px;color:#64748b;width:28px;text-align:left;flex-shrink:0">${r.n}</span>
      </div>`;
    }).join("");

    const signalRows = signalsRes.rows.map((s: {
      stype: string; title: string; description: string;
      confidence: number; direction: string | null; country: string | null; topic: string | null;
    }) => `
      <tr>
        <td style="padding:7px 10px">
          <span style="font-size:9px;padding:2px 8px;border-radius:99px;background:${STYPE_COLOR[s.stype] ?? "#64748b"}22;color:${STYPE_COLOR[s.stype] ?? "#94a3b8"};border:1px solid ${STYPE_COLOR[s.stype] ?? "#64748b"}55">
            ${STYPE_FA[s.stype] ?? s.stype}
          </span>
        </td>
        <td style="padding:7px 10px;font-size:10px;color:#e2e8f0;max-width:220px">${s.title}</td>
        <td style="padding:7px 10px;font-size:9px;color:#94a3b8;max-width:260px">${(s.description ?? "").slice(0, 90)}…</td>
        ${!country ? `<td style="padding:7px 10px;font-size:9px;color:#7c6af7">${s.country ?? "—"}</td>` : ""}
        <td style="padding:7px 10px;font-size:10px;color:${s.direction ? DIR_COLOR[s.direction] : "#94a3b8"}">${s.direction ? DIR_MARK[s.direction] : "—"}</td>
        <td style="padding:7px 10px;font-size:10px;font-variant-numeric:tabular-nums;color:#e2e8f0">${Math.round(s.confidence * 100)}٪</td>
      </tr>`).join("");

    const entityRows = entitiesRes.rows.map((e: { name: string; etype: string; n: number }) => `
      <tr>
        <td style="padding:5px 10px">
          <span style="font-size:9px;padding:1px 7px;border-radius:99px;background:${ETYPE_COLOR[e.etype] ?? "#64748b"}18;color:${ETYPE_COLOR[e.etype] ?? "#94a3b8"};border:1px solid ${ETYPE_COLOR[e.etype] ?? "#64748b"}44">
            ${ETYPE_FA[e.etype] ?? e.etype}
          </span>
        </td>
        <td style="padding:5px 10px;font-size:10px;color:#e2e8f0">${e.name}</td>
        <td style="padding:5px 10px;font-size:10px;color:#94a3b8;font-variant-numeric:tabular-nums">${e.n}</td>
      </tr>`).join("");

    const docRows = topDocsRes.rows.map((d: {
      title: string; report_date: string | null; country: string; ai_summary: string | null;
    }) => `
      <tr>
        <td style="padding:6px 10px;font-size:10px;color:#e2e8f0;max-width:280px">${d.title ?? "—"}</td>
        ${!country ? `<td style="padding:6px 10px;font-size:9px;color:#7c6af7">${d.country || "—"}</td>` : ""}
        <td style="padding:6px 10px;font-size:9px;color:#64748b">${d.report_date ?? "—"}</td>
        <td style="padding:6px 10px;font-size:9px;color:#94a3b8;max-width:240px">${(d.ai_summary ?? "").slice(0, 100)}${d.ai_summary && d.ai_summary.length > 100 ? "…" : ""}</td>
      </tr>`).join("");

    const reportTitle = country ? `گزارش هوشمند — ${country}` : "گزارش هوشمند جامع";
    const subtitle = country
      ? `تحلیل اطلاعاتی ${country} · ${today}`
      : `نمای کلی همه کشورها · ${today}`;

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <title>${reportTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;900&display=swap">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --mint: rgb(79,209,165);
      --lavender: #7c6af7;
      --sky: #38bdf8;
      --gold: #f5c542;
      --bg: #0d1117;
      --surface: #111827;
      --border: #1e293b;
      --t1: #f8fafc;
      --t2: #cbd5e1;
      --t3: #94a3b8;
      --t4: #475569;
    }
    body {
      background: var(--bg);
      color: var(--t2);
      font-family: Vazirmatn, system-ui, sans-serif;
      font-size: 12px;
      line-height: 1.7;
      padding: 40px 48px;
      direction: rtl;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Header ── */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 20px;
      border-bottom: 2px solid var(--mint);
      margin-bottom: 28px;
    }
    .report-brand { font-size: 9px; color: var(--t4); letter-spacing: .08em; }
    .report-title { font-size: 32px; font-weight: 900; color: var(--t1); line-height: 1.2; margin: 6px 0 4px; }
    .report-subtitle { font-size: 11px; color: var(--t3); }
    .report-date { text-align: left; font-size: 9px; color: var(--t4); line-height: 1.8; }

    /* ── KPI strip ── */
    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 28px;
    }
    .kpi {
      padding: 14px 18px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface);
    }
    .kpi-n { font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .kpi-l { font-size: 9px; color: var(--t4); margin-top: 3px; }
    .kpi-delta { font-size: 9px; margin-top: 5px; }

    /* ── Section headers ── */
    h2 {
      font-size: 10px;
      font-weight: 700;
      color: var(--t4);
      letter-spacing: .1em;
      text-transform: uppercase;
      border-bottom: 1px solid var(--border);
      padding-bottom: 7px;
      margin-bottom: 14px;
      margin-top: 32px;
    }

    /* ── Two-col layout ── */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .section-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px 18px;
    }

    /* ── Tables ── */
    table { width: 100%; border-collapse: collapse; }
    th {
      font-size: 9px; color: var(--t4); text-align: right;
      padding: 5px 10px; border-bottom: 1px solid var(--border);
      font-weight: 600; letter-spacing: .04em;
    }
    tr:nth-child(even) { background: rgba(255,255,255,0.02); }
    td { vertical-align: top; }

    /* ── Timeline bars ── */
    .timeline-wrap {
      display: flex;
      gap: 4px;
      align-items: flex-end;
      height: 82px;
      padding: 10px 12px 0;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }

    /* ── Footer ── */
    .report-footer {
      margin-top: 44px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: var(--t4);
    }

    /* ── Print ── */
    @page { size: A4; margin: 18mm 16mm; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      h2 { page-break-after: avoid; }
      tr { page-break-inside: avoid; }
      .section-box { break-inside: avoid; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="report-header">
    <div>
      <div class="report-brand">INTELLIGENCE REPORT · مغز دوم سازمانی</div>
      <h1 class="report-title">${country ?? "گزارش جامع"}</h1>
      <p class="report-subtitle">${subtitle}</p>
    </div>
    <div class="report-date">
      <div>تاریخ تهیه: ${today}</div>
      <div>بازه داده: ${stats.min_date ?? "—"} تا ${stats.max_date ?? "—"}</div>
    </div>
  </div>

  <!-- KPI strip -->
  <div class="kpi-strip">
    <div class="kpi">
      <div class="kpi-n" style="color:var(--mint)">${stats.total_docs}</div>
      <div class="kpi-l">کل اسناد</div>
      <div class="kpi-delta">${deltaSpan(docDelta, "سند")}</div>
    </div>
    <div class="kpi">
      <div class="kpi-n" style="color:var(--lavender)">${signalsRes.rows.length}</div>
      <div class="kpi-l">سیگنال فعال</div>
      <div class="kpi-delta">${deltaSpan(sigDelta, "سیگنال")}</div>
    </div>
    <div class="kpi">
      <div class="kpi-n" style="color:var(--gold)">${stats.total_countries}</div>
      <div class="kpi-l">کشور پوشش‌داده</div>
      <div class="kpi-delta" style="color:var(--t4)">&nbsp;</div>
    </div>
    <div class="kpi">
      <div class="kpi-n" style="color:var(--sky)">${entitiesRes.rows.length}</div>
      <div class="kpi-l">موجودیت برتر</div>
      <div class="kpi-delta" style="color:var(--t4)">&nbsp;</div>
    </div>
  </div>

  <!-- Timeline -->
  ${timelineRes.rows.length > 1 ? `
  <h2>روند ماهانه اسناد</h2>
  <div class="timeline-wrap">
    ${timelineBars}
  </div>` : ""}

  <!-- Two-col: countries + entities -->
  <div class="two-col" style="margin-top:28px">
    ${!country ? `
    <div>
      <h2 style="margin-top:0">کشورهای برتر</h2>
      <div class="section-box" style="padding:14px 16px">
        ${countryBars}
      </div>
    </div>` : ""}
    <div ${country ? 'style="grid-column:1/3"' : ""}>
      <h2 style="margin-top:0">موجودیت‌های برتر</h2>
      <div class="section-box" style="padding:0">
        <table>
          <tr><th>نوع</th><th>نام</th><th>اشاره</th></tr>
          ${entityRows}
        </table>
      </div>
    </div>
  </div>

  <!-- Signals -->
  ${signalsRes.rows.length ? `
  <h2>سیگنال‌های هوشمند</h2>
  <div class="section-box" style="padding:0">
    <table>
      <tr>
        <th>نوع</th><th>عنوان</th><th>توضیح</th>
        ${!country ? "<th>کشور</th>" : ""}
        <th>جهت</th><th>اطمینان</th>
      </tr>
      ${signalRows}
    </table>
  </div>` : ""}

  <!-- Recent docs -->
  ${topDocsRes.rows.length ? `
  <h2>آخرین اسناد</h2>
  <div class="section-box" style="padding:0">
    <table>
      <tr>
        <th>عنوان</th>
        ${!country ? "<th>کشور</th>" : ""}
        <th>تاریخ</th><th>خلاصه هوش مصنوعی</th>
      </tr>
      ${docRows}
    </table>
  </div>` : ""}

  <!-- Footer -->
  <div class="report-footer">
    <span>گزارش خودکار — Cultural Intelligence Hub · مغز دوم سازمانی</span>
    <span>${today} — محرمانه</span>
  </div>

  <!-- Print button (hidden in print) -->
  <div class="no-print" style="position:fixed;bottom:24px;left:24px;display:flex;gap:8px">
    <button onclick="window.print()"
      style="padding:10px 22px;background:rgb(79,209,165);color:#0d1117;border:none;border-radius:8px;font-family:Vazirmatn,sans-serif;font-size:13px;font-weight:700;cursor:pointer">
      دانلود PDF
    </button>
    <button onclick="window.close()"
      style="padding:10px 18px;background:#1e293b;color:#94a3b8;border:1px solid #334155;border-radius:8px;font-family:Vazirmatn,sans-serif;font-size:13px;cursor:pointer">
      بستن
    </button>
  </div>

</body>
</html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });

  } catch (err) {
    console.error("report:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
