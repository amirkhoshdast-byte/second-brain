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
    max: 4,
  });
  return pool;
}

// GET /api/admin/documents?q=...&country=...&page=1&limit=30
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q       = searchParams.get("q") ?? "";
  const country = searchParams.get("country") ?? "";
  const docType = searchParams.get("doc_type") ?? "";
  const page    = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit   = Math.min(100, Number(searchParams.get("limit") ?? 30));
  const offset  = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(d.title ILIKE $${params.length} OR d.ai_summary ILIKE $${params.length})`);
  }
  if (country) {
    params.push(country);
    conditions.push(`d.country = $${params.length}`);
  }
  if (docType) {
    params.push(docType);
    conditions.push(`d.doc_type = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const c = db();
  const [rows, total] = await Promise.all([
    c.query(`
      SELECT
        d.id, d.title, d.country, d.region, d.folder, d.doc_type,
        d.source_name, d.report_date, d.confidence, d.extracted_at,
        d.ai_summary,
        count(m.entity_id)::int AS entity_count
      FROM intel.document d
      LEFT JOIN intel.mention m ON m.document_id = d.id
      ${where}
      GROUP BY d.id
      ORDER BY d.extracted_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]),
    c.query(`SELECT count(*)::int AS n FROM intel.document d ${where}`, params),
  ]);

  return NextResponse.json({
    docs: rows.rows,
    total: total.rows[0].n,
    page,
    pages: Math.ceil(total.rows[0].n / limit),
  });
}

// PATCH /api/admin/documents — ویرایش metadata
export async function PATCH(req: NextRequest) {
  const body = await req.json() as { id: number; title?: string; country?: string; report_date?: string; doc_type?: string; folder?: string };
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  const allowed = ["title", "country", "report_date", "doc_type", "folder"];
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [k, v] of Object.entries(fields)) {
    if (!allowed.includes(k)) continue;
    params.push(v || null);
    const cast = k === "report_date" ? `$${params.length}::date` : `$${params.length}`;
    sets.push(`${k} = ${cast}`);
  }

  if (!sets.length) return NextResponse.json({ ok: false, error: "no valid fields" }, { status: 400 });

  params.push(id);
  const c = db();
  await c.query(`UPDATE intel.document SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/documents?id=123
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const c = db();
  await c.query("DELETE FROM intel.document WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
