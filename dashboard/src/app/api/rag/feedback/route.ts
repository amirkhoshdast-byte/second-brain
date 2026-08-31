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

async function ensureTable(c: Pool) {
  await c.query(`
    CREATE TABLE IF NOT EXISTS intel.feedback (
      id          SERIAL PRIMARY KEY,
      question    TEXT NOT NULL,
      answer      TEXT NOT NULL,
      rating      SMALLINT NOT NULL CHECK (rating IN (1, -1)),
      sources     JSONB,
      created_at  TIMESTAMPTZ DEFAULT now()
    )
  `);
}

// POST /api/rag/feedback — ذخیره رأی
export async function POST(req: NextRequest) {
  const { question, answer, rating, sources } = await req.json() as {
    question: string; answer: string; rating: 1 | -1; sources?: unknown[];
  };
  if (!question || !answer || (rating !== 1 && rating !== -1)) {
    return NextResponse.json({ ok: false, error: "question + answer + rating (1|-1) الزامی است" }, { status: 400 });
  }
  const c = db();
  await ensureTable(c);
  const result = await c.query(
    `INSERT INTO intel.feedback (question, answer, rating, sources) VALUES ($1, $2, $3, $4) RETURNING id`,
    [question.slice(0, 1000), answer.slice(0, 4000), rating, JSON.stringify(sources ?? [])]
  );
  return NextResponse.json({ ok: true, id: result.rows[0].id });
}

// GET /api/rag/feedback — آمار برای Admin Panel
export async function GET() {
  const c = db();
  try {
    await ensureTable(c);
    const [totals, recent, worst] = await Promise.all([
      c.query(`
        SELECT
          count(*) FILTER (WHERE rating = 1)::int  positive,
          count(*) FILTER (WHERE rating = -1)::int negative,
          count(*)::int total
        FROM intel.feedback
      `),
      c.query(`
        SELECT id, question, rating, created_at
        FROM intel.feedback
        ORDER BY created_at DESC LIMIT 20
      `),
      c.query(`
        SELECT question, answer, created_at
        FROM intel.feedback
        WHERE rating = -1
        ORDER BY created_at DESC LIMIT 10
      `),
    ]);
    const { positive, negative, total } = totals.rows[0];
    return NextResponse.json({
      positive, negative, total,
      satisfaction: total > 0 ? Math.round((positive / total) * 100) : null,
      recent: recent.rows,
      worst: worst.rows,
    });
  } catch {
    return NextResponse.json({ positive: 0, negative: 0, total: 0, satisfaction: null, recent: [], worst: [] });
  }
}
