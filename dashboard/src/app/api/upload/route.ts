import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "crypto";

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

const OLLAMA = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const MODEL  = process.env.EXTRACT_MODEL ?? "qwen3:8b";

// ── استخراج متن از فایل ─────────────────────────────────────────────────────
async function extractText(buf: Buffer, mime: string, name: string): Promise<string> {
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
    const data = await pdfParse(buf);
    return data.text;
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result  = await mammoth.extractRawText({ buffer: buf });
    return result.value;
  }
  // TXT / HTML / سایر متن‌ها
  return buf.toString("utf-8");
}

// ── فراخوانی ollama برای استخراج ساختاریافته ──────────────────────────────
const SCHEMA = {
  type: "object",
  properties: {
    title:      { type: "string" },
    country:    { type: "string" },
    region:     { type: "string" },
    topic:      { type: "string" },
    report_date:{ type: "string" },
    confidence: { type: "number" },
    ai_summary: { type: "string" },
    entities:   {
      type: "array",
      items: {
        type: "object",
        properties: {
          name:  { type: "string" },
          etype: { type: "string", enum: ["person","org","event","topic"] },
        },
        required: ["name","etype"],
      },
    },
  },
  required: ["title","ai_summary","entities"],
};

async function extractWithAI(text: string, meta: { country?: string; topic?: string; report_date?: string }) {
  const sample = text.slice(0, 3200);
  const prompt =
    "متن زیر یک سند سازمانی است. اطلاعات ساختاریافته‌ی زیر را از آن استخراج کن.\n\n" +
    `متن:\n${sample}\n\n` +
    "قوانین استخراج:\n" +
    "- title: عنوان اصلی سند (حداکثر ۱۵ کلمه)\n" +
    "- country: کشور اصلی که سند درباره آن است\n" +
    "- region: منطقه جغرافیایی (مثلاً «جنوب آسیا»، «خاورمیانه»)\n" +
    "- topic: موضوع اصلی (مثلاً «روابط بین‌الملل»، «آموزش»، «اقتصاد»)\n" +
    "- report_date: تاریخ سند به فرمت YYYY-MM-DD اگر در متن باشد\n" +
    "- confidence: عدد ۰ تا ۱ — کیفیت و انسجام متن\n" +
    "- ai_summary: خلاصه دو جمله‌ای فارسی از محتوای سند\n" +
    "- entities: آرایه‌ای از موجودیت‌های مهم\n" +
    "  · etype باید یکی از: person, org, event, topic باشد\n" +
    "  · حداکثر ۲۰ موجودیت — فقط موارد مشخص و مهم\n\n" +
    (meta.country    ? `کشور که کاربر مشخص کرده: ${meta.country}\n`    : "") +
    (meta.topic      ? `موضوع که کاربر مشخص کرده: ${meta.topic}\n`      : "") +
    (meta.report_date? `تاریخ که کاربر مشخص کرده: ${meta.report_date}\n`: "") +
    "\nفقط JSON بده، هیچ توضیح اضافه‌ای نده.";

  const payload = {
    model: MODEL, stream: false, format: SCHEMA, think: false,
    options: { temperature: 0.1, num_predict: 1200 },
    messages: [{ role: "user", content: prompt }],
  };

  const resp = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });
  const json = await resp.json();
  const data = JSON.parse(json.message.content);

  // اگر کاربر مقدار دستی داده overwrite کن
  if (meta.country    ) data.country     = meta.country;
  if (meta.topic      ) data.topic       = meta.topic;
  if (meta.report_date) data.report_date = meta.report_date;

  return data;
}

// ── ذخیره در DB ────────────────────────────────────────────────────────────
async function saveToDb(extracted: Record<string, unknown>, textHash: string, fileName: string) {
  const c = db();

  // جلوگیری از تکرار
  const dup = await c.query("select id from intel.document where content_hash=$1", [textHash]);
  if (dup.rows.length) return { docId: dup.rows[0].id, duplicate: true };

  // سند اصلی
  const docRes = await c.query(`
    insert into intel.document
      (path, title, country, region, folder, report_date, ai_summary, confidence,
       content_hash, model, source_name, doc_type)
    values ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10,$11,'uploaded')
    returning id
  `, [
    `uploads/${fileName}`,
    (extracted.title as string)?.slice(0,500) ?? fileName,
    extracted.country ?? null,
    extracted.region  ?? null,
    extracted.topic   ?? null,
    extracted.report_date ?? null,
    (extracted.ai_summary as string)?.slice(0,2000) ?? null,
    typeof extracted.confidence === "number" ? extracted.confidence : 0.7,
    textHash, MODEL, "آپلود کاربر",
  ]);
  const docId = docRes.rows[0].id as bigint;

  // موجودیت‌ها + اشاره‌ها
  const entities = (extracted.entities as Array<{ name: string; etype: string }>) ?? [];
  for (const e of entities) {
    if (!e.name?.trim() || !e.etype) continue;
    const entRes = await c.query(`
      insert into intel.entity (etype, name)
      values ($1, $2)
      on conflict (etype, name) do update set name=excluded.name
      returning id
    `, [e.etype, e.name.trim().slice(0, 200)]);
    const entId = entRes.rows[0].id;
    await c.query(`
      insert into intel.mention (document_id, entity_id)
      values ($1, $2) on conflict do nothing
    `, [docId, entId]);
  }

  return { docId: String(docId), duplicate: false, entityCount: entities.length };
}

// ── handler ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ ok: false, error: "فایلی ارسال نشده" }, { status: 400 });

    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) return NextResponse.json({ ok: false, error: "حجم فایل بیش از ۱۵ مگابایت است" }, { status: 400 });

    const country    = (form.get("country")     as string) || undefined;
    const topic      = (form.get("topic")       as string) || undefined;
    const report_date= (form.get("report_date") as string) || undefined;

    const buf  = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash("sha256").update(buf).digest("hex");

    // استخراج متن
    const text = await extractText(buf, file.type, file.name);
    if (text.trim().length < 50) {
      return NextResponse.json({ ok: false, error: "متن کافی در فایل پیدا نشد" }, { status: 422 });
    }

    // استخراج با AI
    const extracted = await extractWithAI(text, { country, topic, report_date });

    // ذخیره
    const result = await saveToDb(extracted, hash, file.name);

    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      docId: result.docId,
      title: extracted.title,
      country: extracted.country,
      topic: extracted.topic,
      entityCount: result.entityCount ?? 0,
      summary: extracted.ai_summary,
    });
  } catch (err) {
    console.error("upload error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
