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

// GET /api/admin/entities?q=...&etype=...&page=1
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q     = searchParams.get("q") ?? "";
  const etype = searchParams.get("etype") ?? "";
  const page  = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = 40;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (q) {
    params.push(`%${q}%`);
    conditions.push(`e.name ILIKE $${params.length}`);
  }
  if (etype) {
    params.push(etype);
    conditions.push(`e.etype = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const c = db();

  const [rows, total] = await Promise.all([
    c.query(`
      SELECT e.id, e.etype, e.name, count(m.document_id)::int AS doc_count
      FROM intel.entity e
      LEFT JOIN intel.mention m ON m.entity_id = e.id
      ${where}
      GROUP BY e.id
      ORDER BY doc_count DESC, e.name
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]),
    c.query(`SELECT count(*)::int AS n FROM intel.entity e ${where}`, params),
  ]);

  return NextResponse.json({ entities: rows.rows, total: total.rows[0].n, page, pages: Math.ceil(total.rows[0].n / limit) });
}

// PATCH — ویرایش نام موجودیت
export async function PATCH(req: NextRequest) {
  const { id, name } = await req.json() as { id: number; name: string };
  if (!id || !name?.trim()) return NextResponse.json({ ok: false, error: "id + name required" }, { status: 400 });
  const c = db();
  await c.query("UPDATE intel.entity SET name = $1 WHERE id = $2", [name.trim(), id]);
  return NextResponse.json({ ok: true });
}

// DELETE — حذف موجودیت (mentions هم cascade می‌شوند)
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const c = db();
  await c.query("DELETE FROM intel.mention WHERE entity_id = $1", [id]);
  await c.query("DELETE FROM intel.entity WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}

// POST /api/admin/entities/merge — ادغام دو موجودیت
// body: { keep_id, merge_id }  → mentions از merge_id به keep_id منتقل، merge_id حذف
export async function POST(req: NextRequest) {
  const { keep_id, merge_id } = await req.json() as { keep_id: number; merge_id: number };
  if (!keep_id || !merge_id || keep_id === merge_id) {
    return NextResponse.json({ ok: false, error: "keep_id و merge_id متفاوت و الزامی هستند" }, { status: 400 });
  }
  const c = db();
  // mentions تکراری را نادیده بگیر، بقیه را منتقل کن
  await c.query(`
    INSERT INTO intel.mention (document_id, entity_id)
    SELECT document_id, $1 FROM intel.mention WHERE entity_id = $2
    ON CONFLICT DO NOTHING
  `, [keep_id, merge_id]);
  await c.query("DELETE FROM intel.mention WHERE entity_id = $1", [merge_id]);
  await c.query("DELETE FROM intel.entity WHERE id = $1", [merge_id]);
  return NextResponse.json({ ok: true });
}
