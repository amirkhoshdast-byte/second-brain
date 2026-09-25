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

// سیگنال‌های جدید از زمان آخرین بازدید با confidence بالا
export async function GET(req: NextRequest) {
  const since      = req.nextUrl.searchParams.get("since");   // ISO timestamp
  const minConf    = parseFloat(req.nextUrl.searchParams.get("min_confidence") ?? "0.7");

  try {
    const c = db();

    const params: unknown[] = [minConf];
    let sinceClause = "";
    if (since) {
      params.push(since);
      sinceClause = `AND s.created_at > $${params.length}::timestamptz`;
    }

    const res = await c.query(`
      SELECT s.id, s.stype, s.title, s.country, s.topic,
             s.confidence::float,
             to_char(s.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') created_at
      FROM intel.signal s
      WHERE s.confidence >= $1
        ${sinceClause}
      ORDER BY s.created_at DESC
      LIMIT 20
    `, params);

    return NextResponse.json({ signals: res.rows, count: res.rows.length });
  } catch (err) {
    return NextResponse.json({ signals: [], count: 0, error: String(err) });
  }
}
