import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { requireApiKey } from "@/lib/apikey";
import { embed, qdrant, COLLECTION } from "@/lib/vectors";

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
 * GET /api/v1/search
 *
 * Query params:
 *   q       — متن جستجو (الزامی)
 *   country — فیلتر کشور (اختیاری)
 *   limit   — حداکثر ۲۰ (پیش‌فرض ۱۰)
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req);
  if (!auth.ok) return auth.res;

  const p = req.nextUrl.searchParams;
  const q       = p.get("q") ?? "";
  const country = p.get("country") ?? "";
  const limit   = Math.min(Number(p.get("limit") ?? 10), 20);

  if (!q.trim()) {
    return NextResponse.json({ error: "پارامتر q الزامی است" }, { status: 400 });
  }

  // جستجوی vector
  const vector = await embed(q);
  const filter = country
    ? { must: [{ key: "country", match: { value: country } }] }
    : undefined;

  const qdrantRes = await qdrant(`/collections/${COLLECTION}/points/search`, "POST", {
    vector,
    limit: limit * 4,
    with_payload: true,
    with_vector: false,
    score_threshold: 0.2,
    ...(filter ? { filter } : {}),
  });

  const hits: { score: number; payload: Record<string, string> }[] = qdrantRes.result ?? [];

  // dedup: بهترین chunk هر سند
  const seen = new Set<string>();
  const topPaths: { path: string; score: number }[] = [];
  for (const hit of hits) {
    const path = hit.payload?.path;
    if (!path || seen.has(path)) continue;
    seen.add(path);
    topPaths.push({ path, score: Math.round(hit.score * 1000) / 1000 });
    if (topPaths.length >= limit) break;
  }

  if (!topPaths.length) return NextResponse.json({ query: q, results: [] });

  const c = db();
  const docsRes = await c.query(
    `SELECT id::text, title, country, doc_type,
            to_char(report_date,'YYYY-MM-DD') report_date,
            left(ai_summary, 300) ai_summary, path
     FROM intel.document WHERE path = ANY($1::text[])`,
    [topPaths.map(p => p.path)]
  );

  const docMap = new Map(docsRes.rows.map(d => [d.path, d]));
  const results = topPaths
    .map(p => {
      const d = docMap.get(p.path);
      return d ? { ...d, similarity: p.score } : null;
    })
    .filter(Boolean);

  return NextResponse.json({ query: q, results });
}
