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
  const stype   = req.nextUrl.searchParams.get("stype");
  const country = req.nextUrl.searchParams.get("country");

  try {
    const c = db();

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (stype)   { params.push(stype);   conditions.push(`s.stype = $${params.length}`); }
    if (country) { params.push(country); conditions.push(`s.country = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [signals, countries, stypes] = await Promise.all([
      c.query(`
        SELECT s.id, s.stype, s.title, s.description, s.country, s.topic,
               s.importance, s.confidence::float, s.direction,
               count(e.document_id)::int evidence,
               s.created_at
        FROM intel.signal s
        LEFT JOIN intel.signal_evidence e ON e.signal_id = s.id
        ${where}
        GROUP BY s.id
        ORDER BY s.confidence DESC, evidence DESC
        LIMIT 200
      `, params),
      c.query(`
        SELECT country, count(*)::int n
        FROM intel.signal
        WHERE country IS NOT NULL
        GROUP BY country ORDER BY n DESC
      `),
      c.query(`
        SELECT stype, count(*)::int n
        FROM intel.signal
        GROUP BY stype ORDER BY n DESC
      `),
    ]);

    return NextResponse.json({
      signals: signals.rows,
      countries: countries.rows,
      stypes: stypes.rows,
      total: signals.rows.length,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
