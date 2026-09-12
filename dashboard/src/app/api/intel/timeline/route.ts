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
  const topic   = req.nextUrl.searchParams.get("topic");
  const docId   = req.nextUrl.searchParams.get("id");   // سند جاری برای highlight

  if (!country && !topic) return NextResponse.json({ docs: [] });

  const c = db();
  const conds: string[] = [];
  const params: unknown[] = [];

  if (country) { params.push(country); conds.push(`country = $${params.length}`); }
  if (topic)   { params.push(topic);   conds.push(`doc_type = $${params.length}`); }

  const where = `WHERE ${conds.join(" AND ")} AND report_date IS NOT NULL`;
  const { rows } = await c.query(`
    SELECT id::text, title, report_date, country, doc_type AS topic, ai_summary AS summary
    FROM intel.document
    ${where}
    ORDER BY report_date ASC
    LIMIT 60
  `, params);

  return NextResponse.json({ docs: rows, currentId: docId });
}
