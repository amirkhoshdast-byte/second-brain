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

export interface ApiKeyRow {
  id: number;
  key_hash: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

async function hashKey(key: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(key));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** API key را از هدر Bearer یا query param api_key می‌خواند و در DB چک می‌کند */
export async function requireApiKey(req: NextRequest): Promise<
  { ok: true; keyId: number } | { ok: false; res: NextResponse }
> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const queryKey   = req.nextUrl.searchParams.get("api_key") ?? "";
  const raw = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : queryKey;

  if (!raw) {
    return { ok: false, res: NextResponse.json({ error: "API key الزامی است" }, { status: 401 }) };
  }

  const hash = await hashKey(raw);
  const c = db();

  try {
    const res = await c.query<ApiKeyRow>(
      `SELECT id FROM intel.api_keys WHERE key_hash = $1 AND is_active = true`,
      [hash]
    );
    if (!res.rows.length) {
      return { ok: false, res: NextResponse.json({ error: "API key نامعتبر است" }, { status: 401 }) };
    }
    const keyId = res.rows[0].id;
    // آخرین استفاده را async آپدیت کن (بدون await — تأخیر نمی‌افزاید)
    c.query(`UPDATE intel.api_keys SET last_used_at = now() WHERE id = $1`, [keyId]).catch(() => {});
    return { ok: true, keyId };
  } catch (err) {
    console.error("apikey check:", err);
    return { ok: false, res: NextResponse.json({ error: "خطای سرور" }, { status: 500 }) };
  }
}
