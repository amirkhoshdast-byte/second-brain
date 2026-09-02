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
    max: 4, idleTimeoutMillis: 20000,
  });
  return pool;
}

export async function GET() {
  try {
    const c = db();

    const [trending, underserved, spotlight, entityTrends, recentSignals] = await Promise.all([

      // داغ این هفته — آخرین مقالات با بیشترین موجودیت
      c.query<{
        id: number; title: string; country: string | null; region: string | null;
        ai_summary: string | null; confidence: number | null;
        extracted_at: string; entity_count: number;
      }>(`
        SELECT d.id, d.title, d.country, d.region, d.ai_summary,
               d.confidence::float, d.extracted_at::text,
               count(m.entity_id)::int entity_count
        FROM intel.document d
        LEFT JOIN intel.mention m ON m.document_id = d.id
        WHERE d.extracted_at > now() - interval '14 days'
        GROUP BY d.id
        ORDER BY entity_count DESC, d.extracted_at DESC
        LIMIT 12
      `),

      // کشورهای کم‌پوشش — وجود دارند ولی مقاله کم دارند
      c.query<{ country: string; count: number; latest: string | null }>(`
        SELECT country, count(*)::int, max(extracted_at)::text latest
        FROM intel.document
        WHERE country IS NOT NULL AND country <> ''
        GROUP BY country
        HAVING count(*) < 5
        ORDER BY count ASC, country
        LIMIT 20
      `),

      // اکتشاف تصادفی — مقالات با اعتماد بالا از کشورهای متنوع
      c.query<{
        id: number; title: string; country: string | null; region: string | null;
        ai_summary: string | null; confidence: number | null; source_url: string | null;
      }>(`
        SELECT DISTINCT ON (d.country) d.id, d.title, d.country, d.region,
               d.ai_summary, d.confidence::float, d.source_url
        FROM intel.document d
        WHERE d.confidence > 0.7
          AND d.ai_summary IS NOT NULL
          AND d.country IS NOT NULL
        ORDER BY d.country, random()
        LIMIT 8
      `),

      // موجودیت‌های پرتکرار اخیر — چه نام‌هایی داغ است؟
      c.query<{ name: string; etype: string; recent_mentions: number }>(`
        SELECT e.name, e.etype, count(m.document_id)::int recent_mentions
        FROM intel.entity e
        JOIN intel.mention m ON m.entity_id = e.id
        JOIN intel.document d ON d.id = m.document_id
        WHERE d.extracted_at > now() - interval '14 days'
          AND e.etype IN ('person', 'org', 'event')
        GROUP BY e.id, e.name, e.etype
        ORDER BY recent_mentions DESC
        LIMIT 15
      `),

      // آخرین سیگنال‌ها
      c.query<{
        id: number; stype: string; title: string; country: string | null;
        importance: number | null; confidence: number | null;
      }>(`
        SELECT id, stype, title, country, importance, confidence::float
        FROM intel.signal
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT 5
      `),
    ]);

    // آمار کلی
    const stats = await c.query<{
      total: number; this_week: number; countries: number;
    }>(`
      SELECT count(*)::int total,
             count(*) filter (where extracted_at > now() - interval '7 days')::int this_week,
             count(distinct country)::int countries
      FROM intel.document
    `);

    return NextResponse.json({
      stats: stats.rows[0],
      trending: trending.rows,
      underserved: underserved.rows,
      spotlight: spotlight.rows,
      entityTrends: entityTrends.rows,
      recentSignals: recentSignals.rows,
    });
  } catch (err) {
    console.error("discover:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
