import { NextResponse } from "next/server";
import { Pool } from "pg";

let pool: Pool | null = null;
function db() {
  if (!pool) pool = new Pool({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    max: 4,
  });
  return pool;
}

export async function GET() {
  const c = db();

  const [overview, byCountry, byType, byDocType, recent, issues] = await Promise.all([
    c.query(`
      SELECT
        count(*)::int                                              AS total_docs,
        count(*) FILTER (WHERE report_date IS NOT NULL)::int      AS with_date,
        count(*) FILTER (WHERE country IS NOT NULL)::int          AS with_country,
        count(*) FILTER (WHERE ai_summary IS NOT NULL)::int       AS with_summary,
        count(*) FILTER (WHERE extracted_at > now()-interval'7d')::int AS this_week,
        count(*) FILTER (WHERE extracted_at > now()-interval'1d')::int AS today
      FROM intel.document
    `),
    c.query(`
      SELECT country, count(*)::int AS n
      FROM intel.document WHERE country IS NOT NULL
      GROUP BY country ORDER BY n DESC LIMIT 10
    `),
    c.query(`
      SELECT etype, count(*)::int AS n FROM intel.entity GROUP BY etype ORDER BY n DESC
    `),
    c.query(`
      SELECT doc_type, count(*)::int AS n FROM intel.document GROUP BY doc_type ORDER BY n DESC
    `),
    c.query(`
      SELECT id, title, country, doc_type, source_name, extracted_at, confidence
      FROM intel.document ORDER BY extracted_at DESC LIMIT 10
    `),
    c.query(`
      SELECT
        count(*) FILTER (WHERE report_date IS NULL)::int     AS no_date,
        count(*) FILTER (WHERE country IS NULL)::int         AS no_country,
        count(*) FILTER (WHERE ai_summary IS NULL)::int      AS no_summary,
        count(*) FILTER (WHERE confidence < 0.5)::int        AS low_confidence
      FROM intel.document
    `),
  ]);

  return NextResponse.json({
    overview: overview.rows[0],
    byCountry: byCountry.rows,
    byEntityType: byType.rows,
    byDocType: byDocType.rows,
    recentDocs: recent.rows,
    issues: issues.rows[0],
  });
}
