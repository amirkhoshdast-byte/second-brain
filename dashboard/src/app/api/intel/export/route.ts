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

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country");
  if (!country) return NextResponse.json({ error: "country الزامی است" }, { status: 400 });

  const c = db();
  const [docs, entities, signals, flow, topics, topDocs] = await Promise.all([
    c.query(`SELECT count(*)::int n, count(*) FILTER (WHERE report_date IS NOT NULL)::int dated,
             min(report_date) min_d, max(report_date) max_d
             FROM intel.document WHERE country=$1`, [country]),
    c.query(`SELECT e.name, e.etype, count(*)::int n
             FROM intel.entity e JOIN intel.mention m ON m.entity_id=e.id
             JOIN intel.document d ON d.id=m.document_id
             WHERE d.country=$1 GROUP BY e.id ORDER BY n DESC LIMIT 10`, [country]),
    c.query(`SELECT stype, title, description, confidence::float, direction, topic, importance
             FROM intel.signal WHERE country=$1 ORDER BY confidence DESC LIMIT 20`, [country]),
    c.query(`SELECT to_char(date_trunc('month', report_date),'YYYY-MM') m, count(*)::int n
             FROM intel.document WHERE country=$1 AND report_date IS NOT NULL
             GROUP BY 1 ORDER BY 1`, [country]),
    c.query(`SELECT doc_type AS topic, count(*)::int n FROM intel.document
             WHERE country=$1 AND doc_type IS NOT NULL GROUP BY doc_type ORDER BY n DESC LIMIT 8`, [country]),
    c.query(`SELECT title, report_date, doc_type AS topic, ai_summary AS summary
             FROM intel.document WHERE country=$1 ORDER BY report_date DESC NULLS LAST LIMIT 8`, [country]),
  ]);

  const stat = docs.rows[0];
  const dateRange = stat.min_d && stat.max_d
    ? `${stat.min_d.toISOString().slice(0,10)} تا ${stat.max_d.toISOString().slice(0,10)}`
    : "—";

  const STYPE_FA: Record<string,string> = { trend:"روند", signal:"سیگنال", insight:"بینش" };
  const STYPE_COLOR: Record<string,string> = { trend:"#7c6af7", signal:"#4fd1a5", insight:"#38bdf8" };
  const DIR_MARK: Record<string,string> = { up:"↑", down:"↓", flat:"→" };
  const DIR_COLOR: Record<string,string> = { up:"#4ade80", down:"#f87171", flat:"#94a3b8" };
  const ETYPE_COLOR: Record<string,string> = { person:"#fbbf24", org:"#a78bfa", location:"#38bdf8", topic:"#4fd1a5" };
  const ETYPE_FA: Record<string,string> = { person:"شخص", org:"سازمان", location:"مکان", topic:"موضوع" };

  const maxFlow = Math.max(...flow.rows.map((r: {n:number}) => r.n), 1);
  const flowBars = flow.rows.map((r: {m:string;n:number}) => {
    const h = Math.max(4, Math.round((r.n / maxFlow) * 60));
    const mm = r.m.slice(5,7);
    const MONTHS: Record<string,string> = {"01":"فر","02":"ار","03":"خر","04":"تی","05":"مر","06":"شه","07":"مه","08":"آب","09":"آذ","10":"دی","11":"به","12":"اس"};
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1">
      <div style="width:100%;height:${h}px;background:#4fd1a5;border-radius:2px 2px 0 0;opacity:0.85"></div>
      <span style="font-size:7px;color:#94a3b8">${MONTHS[mm]??mm}</span>
    </div>`;
  }).join("");

  const signalRows = signals.rows.map((s: {stype:string;title:string;description:string;confidence:number;direction:string|null;topic:string|null}) => `
    <tr>
      <td style="padding:6px 8px">
        <span style="font-size:9px;padding:2px 7px;border-radius:99px;background:${STYPE_COLOR[s.stype]}22;color:${STYPE_COLOR[s.stype]};border:1px solid ${STYPE_COLOR[s.stype]}66">
          ${STYPE_FA[s.stype]??s.stype}
        </span>
      </td>
      <td style="padding:6px 8px;font-size:10px;color:#e2e8f0">${s.title}</td>
      <td style="padding:6px 8px;font-size:9px;color:#94a3b8">${s.description?.slice(0,80)??""}…</td>
      <td style="padding:6px 8px;font-size:10px;color:${s.direction?DIR_COLOR[s.direction]:"#94a3b8"}">${s.direction?DIR_MARK[s.direction]:"—"}</td>
      <td style="padding:6px 8px;font-size:10px;font-variant-numeric:tabular-nums;color:#e2e8f0">${Math.round(s.confidence*100)}٪</td>
    </tr>`).join("");

  const entityRows = entities.rows.map((e: {name:string;etype:string;n:number}) => `
    <tr>
      <td style="padding:5px 8px">
        <span style="font-size:9px;padding:1px 6px;border-radius:99px;background:${ETYPE_COLOR[e.etype]??'#64748b'}18;color:${ETYPE_COLOR[e.etype]??'#94a3b8'};border:1px solid ${ETYPE_COLOR[e.etype]??'#64748b'}44">
          ${ETYPE_FA[e.etype]??e.etype}
        </span>
      </td>
      <td style="padding:5px 8px;font-size:10px;color:#e2e8f0">${e.name}</td>
      <td style="padding:5px 8px;font-size:10px;color:#94a3b8;font-variant-numeric:tabular-nums">${e.n}</td>
    </tr>`).join("");

  const topDocRows = topDocs.rows.map((d: {title:string;report_date:Date|null;topic:string|null;summary:string|null}) => `
    <tr>
      <td style="padding:5px 8px;font-size:10px;color:#e2e8f0">${d.title??'—'}</td>
      <td style="padding:5px 8px;font-size:9px;color:#94a3b8">${d.report_date?.toISOString().slice(0,10)??"—"}</td>
      <td style="padding:5px 8px;font-size:9px;color:#94a3b8">${d.topic??'—'}</td>
    </tr>`).join("");

  const topicChips = topics.rows.map((t: {topic:string;n:number}) =>
    `<span style="font-size:10px;padding:3px 10px;border-radius:99px;border:1px solid #334155;color:#cbd5e1;background:rgba(255,255,255,0.04)">${t.topic} (${t.n})</span>`
  ).join("");

  const today = new Date().toISOString().slice(0,10);

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <title>گزارش ${country}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700&display=swap">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0d1117; color: #e2e8f0; font-family: Vazirmatn, sans-serif; font-size: 12px; padding: 32px; direction: rtl; }
    h1 { font-size: 28px; font-weight: 700; color: #fff; }
    h2 { font-size: 13px; font-weight: 700; color: #94a3b8; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 12px; margin-top: 28px; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; }
    tr:nth-child(even) { background: rgba(255,255,255,0.025); }
    th { font-size: 9px; color: #64748b; text-align: right; padding: 4px 8px; border-bottom: 1px solid #1e293b; }
    .stat-grid { display: flex; gap: 12px; margin-bottom: 8px; }
    .stat { padding: 12px 18px; border-radius: 8px; border: 1px solid #4fd1a540; background: #4fd1a508; text-align: center; }
    .stat-n { font-size: 26px; font-weight: 700; color: #4fd1a5; font-variant-numeric: tabular-nums; }
    .stat-l { font-size: 9px; color: #64748b; margin-top: 3px; }
    footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #1e293b; font-size: 9px; color: #475569; display: flex; justify-content: space-between; }
    @media print {
      body { background: #fff; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      h1 { color: #0f172a; }
      h2 { color: #475569; border-color: #e2e8f0; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
    <div>
      <p style="color:#4fd1a5;font-size:10px;font-weight:700;letter-spacing:.1em;margin-bottom:6px">INTELLIGENCE REPORT</p>
      <h1>${country}</h1>
      <p style="color:#64748b;font-size:10px;margin-top:4px">تاریخ تهیه: ${today} · بازه داده: ${dateRange}</p>
    </div>
    <div style="text-align:left;font-size:9px;color:#475569">
      <p>Cultural Intelligence Hub</p>
      <p style="margin-top:2px">فرهنگ و ارتباطات اسلامی</p>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat"><div class="stat-n">${stat.n}</div><div class="stat-l">سند</div></div>
    <div class="stat" style="border-color:#7c6af740;background:#7c6af708"><div class="stat-n" style="color:#7c6af7">${signals.rows.length}</div><div class="stat-l">سیگنال</div></div>
    <div class="stat" style="border-color:#fbbf2440;background:#fbbf2408"><div class="stat-n" style="color:#fbbf24">${entities.rows.length > 0 ? entities.rows.reduce((s: number, e: {n:number}) => s+e.n, 0) : 0}</div><div class="stat-l">اشاره به موجودیت</div></div>
  </div>

  ${flow.rows.length > 1 ? `
  <h2>روند ماهانه</h2>
  <div style="display:flex;gap:3px;align-items:flex-end;height:70px;margin-bottom:4px;padding:8px 12px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid #1e293b">
    ${flowBars}
  </div>` : ''}

  ${topics.rows.length ? `
  <h2>موضوعات</h2>
  <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px">${topicChips}</div>` : ''}

  ${signals.rows.length ? `
  <h2>سیگنال‌های هوشمند</h2>
  <table>
    <tr><th>نوع</th><th>عنوان</th><th>توضیح</th><th>جهت</th><th>اطمینان</th></tr>
    ${signalRows}
  </table>` : ''}

  ${entities.rows.length ? `
  <h2>موجودیت‌های برتر</h2>
  <table>
    <tr><th>نوع</th><th>نام</th><th>اشاره</th></tr>
    ${entityRows}
  </table>` : ''}

  ${topDocs.rows.length ? `
  <h2>آخرین اسناد</h2>
  <table>
    <tr><th>عنوان</th><th>تاریخ</th><th>موضوع</th></tr>
    ${topDocRows}
  </table>` : ''}

  <footer>
    <span>گزارش خودکار — مغز دوم سازمانی</span>
    <span>${today}</span>
  </footer>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
