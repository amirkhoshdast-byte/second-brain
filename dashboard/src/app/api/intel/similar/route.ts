import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
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

export async function GET(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get("id");
  const path  = req.nextUrl.searchParams.get("path");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 6), 12);

  if (!docId && !path) {
    return NextResponse.json({ error: "id یا path الزامی است" }, { status: 400 });
  }

  const c = db();

  try {
    // سند مبدأ را از Postgres بگیر
    const srcRes = docId
      ? await c.query<{ id: string; title: string; path: string; ai_summary: string | null; country: string | null }>(
          `SELECT id::text, title, path, ai_summary, country FROM intel.document WHERE id = $1`, [docId])
      : await c.query<{ id: string; title: string; path: string; ai_summary: string | null; country: string | null }>(
          `SELECT id::text, title, path, ai_summary, country FROM intel.document WHERE path = $1`, [path]);

    if (!srcRes.rows.length) {
      return NextResponse.json({ error: "سند یافت نشد" }, { status: 404 });
    }

    const src = srcRes.rows[0];

    // متن برای embedding: عنوان + خلاصه (حداکثر ۵۰۰ کاراکتر)
    const queryText = [src.title, src.ai_summary?.slice(0, 400) ?? ""].filter(Boolean).join(" — ");

    // vector از Ollama
    const vector = await embed(queryText);

    // جستجوی Qdrant — شامل همه chunk‌ها، dedup بر اساس path
    const qdrantRes = await qdrant(`/collections/${COLLECTION}/points/search`, "POST", {
      vector,
      limit: limit * 6, // بیشتر بگیر چون dedup می‌کنیم
      with_payload: true,
      with_vector: false,
      score_threshold: 0.25,
    });

    const hits: { id: string | number; score: number; payload: Record<string, string> }[] = qdrantRes.result ?? [];

    // dedup: بهترین chunk هر path (سند مبدأ را حذف کن)
    const seen = new Set<string>();
    seen.add(src.path); // سند خودش نباشد
    const topPaths: { path: string; score: number; title: string }[] = [];

    for (const hit of hits) {
      const p = hit.payload?.path;
      const t = hit.payload?.title ?? "";
      if (!p || seen.has(p)) continue;
      seen.add(p);
      topPaths.push({ path: p, score: Math.round(hit.score * 1000) / 1000, title: t });
      if (topPaths.length >= limit) break;
    }

    if (!topPaths.length) {
      return NextResponse.json({ source: { id: src.id, title: src.title }, similar: [] });
    }

    // اطلاعات کامل از Postgres
    const paths = topPaths.map(p => p.path);
    const docsRes = await c.query<{
      id: string; title: string; path: string;
      country: string | null; report_date: string | null;
      doc_type: string | null; ai_summary: string | null;
    }>(
      `SELECT id::text, title, path, country,
              to_char(report_date,'YYYY-MM-DD') report_date,
              doc_type, left(ai_summary, 180) ai_summary
       FROM intel.document WHERE path = ANY($1::text[])`,
      [paths]
    );

    // ترتیب بر اساس score Qdrant
    const docMap = new Map(docsRes.rows.map(d => [d.path, d]));
    const similar = topPaths
      .map(p => {
        const d = docMap.get(p.path);
        return d ? { ...d, similarity: p.score } : null;
      })
      .filter(Boolean);

    return NextResponse.json({
      source: { id: src.id, title: src.title, country: src.country },
      similar,
    });

  } catch (err) {
    console.error("similar:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
