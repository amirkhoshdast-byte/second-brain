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
 * GET /api/v1/documents
 *
 * Query params:
 *   country   — فیلتر کشور (اختیاری)
 *   doc_type  — نوع سند (اختیاری)
 *   from      — تاریخ شروع YYYY-MM-DD (اختیاری)
 *   to        — تاریخ پایان YYYY-MM-DD (اختیاری)
 *   q         — جستجوی متنی در عنوان و خلاصه (اختیاری)
 *   limit     — حداکثر نتایج (پیش‌فرض ۲۰، حداکثر ۱۰۰)
 *   offset    — صفحه‌بندی (پیش‌فرض ۰)
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req);
  if (!auth.ok) return auth.res;

  const p = req.nextUrl.searchParams;
  const country  = p.get("country") ?? "";
  const docType  = p.get("doc_type") ?? "";
  const from     = p.get("from") ?? "";
  const to       = p.get("to") ?? "";
  const q        = p.get("q") ?? "";
  const limit    = Math.min(Number(p.get("limit") ?? 20), 100);
  const offset   = Math.max(Number(p.get("offset") ?? 0), 0);

  const conditions: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  if (country)  { conditions.push(`country = $${i++}`);       vals.push(country); }
  if (docType)  { conditions.push(`doc_type = $${i++}`);      vals.push(docType); }
  if (from)     { conditions.push(`report_date >= $${i++}`);  vals.push(from); }
  if (to)       { conditions.push(`report_date <= $${i++}`);  vals.push(to); }
  if (q) {
    conditions.push(`(title ILIKE $${i} OR ai_summary ILIKE $${i})`);
    vals.push(`%${q}%`); i++;
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const c = db();
  const [rows, countRes] = await Promise.all([
    c.query(
      `SELECT id::text, title, country, doc_type,
              to_char(report_date,'YYYY-MM-DD') report_date,
              left(ai_summary, 300) ai_summary, path
       FROM intel.document
       ${where}
       ORDER BY report_date DESC NULLS LAST
       LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, limit, offset]
    ),
    c.query(
      `SELECT COUNT(*)::int total FROM intel.document ${where}`,
      vals
    ),
  ]);

  return NextResponse.json({
    total: countRes.rows[0].total,
    limit,
    offset,
    documents: rows.rows,
  });
}
