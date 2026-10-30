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
 * GET /api/v1/entities
 *
 * Query params:
 *   type      — نوع موجودیت: person | org | location | ... (اختیاری)
 *   q         — جستجو در نام (اختیاری)
 *   min_count — حداقل تعداد ذکر (پیش‌فرض ۱)
 *   limit     — حداکثر ۲۰۰ (پیش‌فرض ۵۰)
 *   offset    — صفحه‌بندی
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req);
  if (!auth.ok) return auth.res;

  const p = req.nextUrl.searchParams;
  const type      = p.get("type") ?? "";
  const q         = p.get("q") ?? "";
  const minCount  = Math.max(Number(p.get("min_count") ?? 1), 1);
  const limit     = Math.min(Number(p.get("limit") ?? 50), 200);
  const offset    = Math.max(Number(p.get("offset") ?? 0), 0);

  const conditions: string[] = [`mention_count >= $1`];
  const vals: unknown[] = [minCount];
  let i = 2;

  if (type) { conditions.push(`entity_type = $${i++}`); vals.push(type); }
  if (q)    { conditions.push(`canonical_name ILIKE $${i++}`); vals.push(`%${q}%`); }

  const where = "WHERE " + conditions.join(" AND ");

  const c = db();
  const [rows, countRes] = await Promise.all([
    c.query(
      `SELECT id::text, canonical_name, entity_type, mention_count,
              country, aliases
       FROM intel.entity
       ${where}
       ORDER BY mention_count DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, limit, offset]
    ),
    c.query(
      `SELECT COUNT(*)::int total FROM intel.entity ${where}`,
      vals
    ),
  ]);

  return NextResponse.json({
    total: countRes.rows[0].total,
    limit,
    offset,
    entities: rows.rows,
  });
}
