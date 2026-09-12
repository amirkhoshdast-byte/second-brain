import { NextResponse } from "next/server";
import { Pool } from "pg";
import { OLLAMA_URL } from "@/lib/vectors";

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
  const c = db();

  const [topSig, newDocs, topCountries] = await Promise.all([
    c.query(`
      SELECT stype, title, description, country, confidence::float, direction
      FROM intel.signal
      WHERE confidence > 0.6
      ORDER BY confidence DESC, created_at DESC
      LIMIT 10
    `),
    c.query(`
      SELECT count(*)::int n FROM intel.document
      WHERE extracted_at > now() - interval '7 days'
    `),
    c.query(`
      SELECT country, count(*)::int n
      FROM intel.document
      WHERE extracted_at > now() - interval '7 days' AND country IS NOT NULL
      GROUP BY country ORDER BY n DESC LIMIT 5
    `),
  ]);

  const sigText = topSig.rows.map((s: {stype:string;title:string;description:string;country:string|null;confidence:number;direction:string|null}) =>
    `- [${s.stype}/${s.direction ?? "—"}] ${s.title}: ${s.description?.slice(0, 80) ?? ""}${s.country ? ` (${s.country})` : ""}`
  ).join("\n");

  const countriesText = topCountries.rows.map((r: {country:string;n:number}) => `${r.country}: ${r.n} سند`).join("، ");

  const prompt = `بر اساس اطلاعات زیر، یک خلاصه هفتگی فشرده (۳–۵ جمله) به فارسی بنویس. بدون مقدمه، مستقیم شروع کن:

سیگنال‌های برتر:
${sigText}

کشورهای فعال هفته: ${countriesText || "—"}
اسناد جدید: ${newDocs.rows[0].n}`;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen3:8b",
        stream: false,
        think: false,
        options: { num_predict: 200, temperature: 0.4 },
        messages: [
          { role: "system", content: "تحلیلگر هوشمند سازمانی هستی. خلاصه‌های دقیق و کاربردی می‌نویسی." },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });
    const d = await res.json();
    const summary = (d.message?.content ?? "").trim();

    return NextResponse.json({
      summary,
      newDocs: newDocs.rows[0].n,
      topCountries: topCountries.rows,
      topSignals: topSig.rows,
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      summary: null,
      newDocs: newDocs.rows[0].n,
      topCountries: topCountries.rows,
      topSignals: topSig.rows,
      generatedAt: new Date().toISOString(),
    });
  }
}
