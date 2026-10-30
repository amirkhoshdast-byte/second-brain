import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { requireApiKey } from "@/lib/apikey";

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

/**
 * GET /api/v1/signals
 *
 * Query params:
 *   country   — فیلتر کشور (اختیاری)
 *   type      — نوع سیگنال (اختیاری)
 *   from      — تاریخ شروع YYYY-MM-DD (اختیاری)
 *   limit     — حداکثر ۱۰۰ (پیش‌فرض ۵۰)
 *   offset    — صفحه‌بندی (پیش‌فرض ۰)
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req);
  if (!auth.ok) return auth.res;

  const p = req.nextUrl.searchParams;
  const country = p.get("country") ?? "";
  const type    = p.get("type") ?? "";
  const from    = p.get("from") ?? "";
  const limit   = Math.min(Number(p.get("limit") ?? 50), 100);
  const offset  = Math.max(Number(p.get("offset") ?? 0), 0);

  const conditions: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  if (country) { conditions.push(`d.country = $${i++}`);           vals.push(country); }
  if (type)    { conditions.push(`s.signal_type = $${i++}`);       vals.push(type); }
  if (from)    { conditions.push(`s.detected_at >= $${i++}`);      vals.push(from); }

  const where = conditions.length ? "AND " + conditions.join(" AND ") : "";

  const c = db();
  const [rows, countRes] = await Promise.all([
    c.query(
      `SELECT s.id::text, s.signal_type, s.severity, s.summary,
              to_char(s.detected_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') detected_at,
              d.title doc_title, d.country, d.id::text doc_id
       FROM intel.signal s
       LEFT JOIN intel.document d ON d.id = s.document_id
       WHERE 1=1 ${where}
       ORDER BY s.detected_at DESC NULLS LAST
       LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, limit, offset]
    ),
    c.query(
      `SELECT COUNT(*)::int total
       FROM intel.signal s
       LEFT JOIN intel.document d ON d.id = s.document_id
       WHERE 1=1 ${where}`,
      vals
    ),
  ]);

  return NextResponse.json({
    total: countRes.rows[0].total,
    limit,
    offset,
    signals: rows.rows,
  });
}
