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
  const q        = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const country  = req.nextUrl.searchParams.get("country") ?? "";
  const dateFrom = req.nextUrl.searchParams.get("from") ?? "";
  const dateTo   = req.nextUrl.searchParams.get("to") ?? "";
  const limit    = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "12"), 40);

  if (!q) return NextResponse.json({ results: [], total: 0 });

  try {
    const c = db();
    const params: (string | number)[] = [q, limit];
    const extra: string[] = [];

    if (country)  { params.push(country);  extra.push(`d.country = $${params.length}`); }
    if (dateFrom) { params.push(dateFrom); extra.push(`d.report_date >= $${params.length}::date`); }
    if (dateTo)   { params.push(dateTo);   extra.push(`d.report_date <= $${params.length}::date`); }

    const extraWhere = extra.length ? "AND " + extra.join(" AND ") : "";

    const res = await c.query(`
      SELECT
        d.id::text,
        d.title,
        d.path,
        d.country,
        d.doc_type,
        to_char(d.report_date,'YYYY-MM-DD') report_date,
        d.producer,
        d.source_name,
        left(d.ai_summary, 300) excerpt,
        ts_rank_cd(d.fts_vec, plainto_tsquery('simple', $1)) rank,
        ts_headline(
          'simple', coalesce(d.ai_summary,'') || ' ' || d.title,
          plainto_tsquery('simple', $1),
          'MaxWords=25, MinWords=10, StartSel=<mark>, StopSel=</mark>'
        ) headline
      FROM intel.document d
      WHERE d.fts_vec @@ plainto_tsquery('simple', $1)
        ${extraWhere}
      ORDER BY rank DESC
      LIMIT $2
    `, params);

    return NextResponse.json({
      query: q,
      results: res.rows,
      total: res.rows.length,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err), results: [], total: 0 }, { status: 200 });
  }
}
