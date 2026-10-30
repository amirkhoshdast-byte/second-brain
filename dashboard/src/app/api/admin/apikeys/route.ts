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

async function hashKey(key: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(key));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function randomKey(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return "sb_" + Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** اطمینان از وجود جدول */
async function ensureTable(c: Pool) {
  await c.query(`
    CREATE TABLE IF NOT EXISTS intel.api_keys (
      id           SERIAL PRIMARY KEY,
      key_hash     TEXT NOT NULL UNIQUE,
      label        TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_used_at TIMESTAMPTZ,
      is_active    BOOLEAN NOT NULL DEFAULT true
    )
  `);
}

/** GET /api/admin/apikeys — لیست کلیدها (بدون hash) */
export async function GET() {
  const c = db();
  await ensureTable(c);
  const res = await c.query(`
    SELECT id, label, created_at, last_used_at, is_active
    FROM intel.api_keys ORDER BY created_at DESC
  `);
  return NextResponse.json({ keys: res.rows });
}

/** POST /api/admin/apikeys — ساخت کلید جدید */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const label = (body.label ?? "بدون نام").slice(0, 100);

  const c = db();
  await ensureTable(c);

  const raw = randomKey();
  const hash = await hashKey(raw);

  await c.query(
    `INSERT INTO intel.api_keys (key_hash, label) VALUES ($1, $2)`,
    [hash, label]
  );

  return NextResponse.json({
    key: raw,
    label,
    note: "این کلید را ذخیره کنید — دیگر نمایش داده نخواهد شد",
  }, { status: 201 });
}

/** DELETE /api/admin/apikeys?id=X — غیرفعال کردن کلید */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id الزامی است" }, { status: 400 });

  const c = db();
  await c.query(`UPDATE intel.api_keys SET is_active = false WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
