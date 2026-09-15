import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

let pool: Pool | null = null;
function db() {
  if (!pool) {
    pool = new Pool({
      host: process.env.POSTGRES_HOST ?? "localhost",
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      max: 4,
      idleTimeoutMillis: 20000,
    });
  }
  return pool;
}

export async function GET(req: NextRequest) {
  const title   = req.nextUrl.searchParams.get("title") ?? "";
  const idParam = req.nextUrl.searchParams.get("id")    ?? "";
  const path    = req.nextUrl.searchParams.get("path")  ?? "";

  if (!title && !idParam && !path) {
    return NextResponse.json({ error: "title, id or path required" }, { status: 400 });
  }

  try {
    const c = db();

    // ── جستجوی سند در postgres ────────────────────────────────────────────
    const docRes = path
      ? await c.query(
          `SELECT id, title, path, country, region, producer,
                  to_char(report_date,'YYYY-MM-DD') report_date,
                  doc_type, source_name, source_url, ai_summary, confidence::float,
                  to_char(extracted_at,'YYYY-MM-DD') extracted_at
           FROM intel.document
           WHERE path ILIKE $1
           ORDER BY extracted_at DESC LIMIT 1`,
          [`%${path.replace(/^.*\//, "").slice(0, 120)}%`]
        )
      : idParam
      ? await c.query(
          `SELECT id, title, path, country, region, producer,
                  to_char(report_date,'YYYY-MM-DD') report_date,
                  doc_type, source_name, source_url, ai_summary, confidence::float,
                  to_char(extracted_at,'YYYY-MM-DD') extracted_at
           FROM intel.document WHERE id = $1`,
          [idParam]
        )
      : await c.query(
          `SELECT id, title, path, country, region, producer,
                  to_char(report_date,'YYYY-MM-DD') report_date,
                  doc_type, source_name, source_url, ai_summary, confidence::float,
                  to_char(extracted_at,'YYYY-MM-DD') extracted_at
           FROM intel.document
           WHERE title ILIKE $1
           ORDER BY extracted_at DESC LIMIT 1`,
          [`%${title.slice(0, 80)}%`]
        );

    if (docRes.rows.length === 0) {
      return NextResponse.json({ found: false });
    }

    const doc = docRes.rows[0];

    // ── موجودیت‌های مرتبط ────────────────────────────────────────────────
    const entRes = await c.query(
      `SELECT e.id::text, e.name, e.etype,
              1 AS mentions,
              m.salience::float
       FROM intel.mention m
       JOIN intel.entity  e ON e.id = m.entity_id
       WHERE m.document_id = $1
       ORDER BY m.salience DESC NULLS LAST`,
      [doc.id]
    );

    // ── اسناد مرتبط (همان کشور + موضوع مشترک) ────────────────────────────
    const relRes = await c.query(
      `WITH doc_topics AS (
         SELECT e.name FROM intel.mention m
         JOIN intel.entity e ON e.id = m.entity_id
         WHERE m.document_id = $1 AND e.etype = 'topic'
         LIMIT 5
       )
       SELECT d.id::text, d.title, d.country, d.report_date::text, d.doc_type,
              count(DISTINCT m2.entity_id) shared
       FROM intel.document d
       JOIN intel.mention m2 ON m2.document_id = d.id
       JOIN intel.entity  e2 ON e2.id = m2.entity_id AND e2.etype = 'topic'
       JOIN doc_topics dt ON dt.name = e2.name
       WHERE d.id <> $1
       GROUP BY d.id, d.title, d.country, d.report_date, d.doc_type
       ORDER BY shared DESC, d.report_date DESC NULLS LAST
       LIMIT 6`,
      [doc.id]
    );

    return NextResponse.json({
      found: true,
      doc,
      entities: entRes.rows,
      related: relRes.rows,
    });
  } catch (err) {
    return NextResponse.json({ found: false, error: String(err) }, { status: 200 });
  }
}
