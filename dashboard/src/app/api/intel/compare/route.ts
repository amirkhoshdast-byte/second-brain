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
  const a = req.nextUrl.searchParams.get("a");
  const b = req.nextUrl.searchParams.get("b");
  if (!a || !b) return NextResponse.json({ error: "a و b الزامی‌اند" }, { status: 400 });

  const c = db();

  const [docsA, docsB, entA, entB, sigA, sigB, flowA, flowB, topicsA, topicsB, countries] = await Promise.all([
    c.query(`SELECT count(*)::int n, count(*) FILTER (WHERE report_date IS NOT NULL)::int dated
             FROM intel.document WHERE country=$1`, [a]),
    c.query(`SELECT count(*)::int n, count(*) FILTER (WHERE report_date IS NOT NULL)::int dated
             FROM intel.document WHERE country=$1`, [b]),

    c.query(`SELECT e.name, e.etype, count(*)::int n
             FROM intel.entity e JOIN intel.mention m ON m.entity_id=e.id
             JOIN intel.document d ON d.id=m.document_id
             WHERE d.country=$1 GROUP BY e.id ORDER BY n DESC LIMIT 8`, [a]),
    c.query(`SELECT e.name, e.etype, count(*)::int n
             FROM intel.entity e JOIN intel.mention m ON m.entity_id=e.id
             JOIN intel.document d ON d.id=m.document_id
             WHERE d.country=$1 GROUP BY e.id ORDER BY n DESC LIMIT 8`, [b]),

    c.query(`SELECT stype, count(*)::int n, avg(confidence)::float avg_conf
             FROM intel.signal WHERE country=$1 GROUP BY stype ORDER BY n DESC`, [a]),
    c.query(`SELECT stype, count(*)::int n, avg(confidence)::float avg_conf
             FROM intel.signal WHERE country=$1 GROUP BY stype ORDER BY n DESC`, [b]),

    c.query(`SELECT to_char(date_trunc('month', report_date),'YYYY-MM') m, count(*)::int n
             FROM intel.document WHERE country=$1 AND report_date IS NOT NULL
             GROUP BY 1 ORDER BY 1 DESC LIMIT 12`, [a]),
    c.query(`SELECT to_char(date_trunc('month', report_date),'YYYY-MM') m, count(*)::int n
             FROM intel.document WHERE country=$1 AND report_date IS NOT NULL
             GROUP BY 1 ORDER BY 1 DESC LIMIT 12`, [b]),

    c.query(`SELECT topic, count(*)::int n FROM intel.document
             WHERE country=$1 AND topic IS NOT NULL GROUP BY topic ORDER BY n DESC LIMIT 6`, [a]),
    c.query(`SELECT topic, count(*)::int n FROM intel.document
             WHERE country=$1 AND topic IS NOT NULL GROUP BY topic ORDER BY n DESC LIMIT 6`, [b]),

    c.query(`SELECT country FROM intel.document WHERE country IS NOT NULL
             GROUP BY country ORDER BY count(*) DESC LIMIT 54`),
  ]);

  return NextResponse.json({
    countries: countries.rows.map(r => r.country),
    a: {
      country: a,
      docs: docsA.rows[0],
      entities: entA.rows,
      signals: sigA.rows,
      flow: flowA.rows.reverse(),
      topics: topicsA.rows,
    },
    b: {
      country: b,
      docs: docsB.rows[0],
      entities: entB.rows,
      signals: sigB.rows,
      flow: flowB.rows.reverse(),
      topics: topicsB.rows,
    },
  });
}
