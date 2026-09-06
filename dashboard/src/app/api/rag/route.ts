import { NextRequest, NextResponse } from "next/server";
import { OLLAMA_URL, embed, hybridSearch } from "@/lib/vectors";

const CHAT_MODEL = "qwen3:8b";

type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * پرسش‌های کوتاهِ پیگیری (مثل «در پاکستان چطور؟») به تنهایی embedding
 * مفیدی ندارند. چند نوبت آخر را با محدودیت طول وارد query بازیابی می‌کنیم؛
 * بنابراین موضوعِ سؤال قبلی حفظ می‌شود، بی‌آنکه کل مکالمه یا دادهٔ نامرتبط
 * به Qdrant فرستاده شود.
 */
function cleanHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-6).flatMap((turn): ChatTurn[] => {
    if (!turn || typeof turn !== "object") return [];
    const t = turn as Record<string, unknown>;
    if ((t.role !== "user" && t.role !== "assistant") || typeof t.content !== "string") return [];
    const content = t.content.trim().slice(0, 900);
    return content ? [{ role: t.role, content }] : [];
  });
}

/**
 * HyDE — Hypothetical Document Embedding
 *
 * برای سوال‌های کوتاه یا مبهم، LLM یک پاسخ فرضی ۱–۲ جمله‌ای می‌سازد.
 * آن پاسخ به جای سوال اصلی embed می‌شود؛ چون فضای معنایی پاسخ به اسناد
 * واقعی نزدیک‌تر از فضای سوال است.
 * اگر تولید پاسخ فرضی طولانی شود یا خطا بدهد، به query اصلی برمی‌گردیم.
 */
async function hydeExpand(query: string): Promise<string> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CHAT_MODEL,
        stream: false,
        options: { num_predict: 120, temperature: 0.3 },
        messages: [
          {
            role: "system",
            content: "یک متخصص تحلیل‌گر هستی. به پرسش زیر یک پاسخ فرضی کوتاه (۱–۲ جمله، حداکثر ۸۰ کلمه) بنویس. فرض کن چنین سندی وجود دارد. فقط پاسخ را بنویس، هیچ توضیح اضافه‌ای نده.",
          },
          { role: "user", content: query },
        ],
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return query;
    const d = await res.json();
    const text = (d.message?.content ?? "").trim();
    return text.length > 20 ? text : query;
  } catch {
    return query;
  }
}

export async function POST(req: NextRequest) {
  const { question, history: rawHistory } = await req.json();
  if (!question?.trim()) return NextResponse.json({ error: "سوال خالی است" }, { status: 400 });
  const history = cleanHistory(rawHistory);
  const priorQuestions = history.filter(t => t.role === "user").slice(-2).map(t => t.content);
  const retrievalQuery = priorQuestions.length
    ? `زمینهٔ پرسش‌های پیشین: ${priorQuestions.join(" | ")}\nپرسش پیگیری: ${question}`
    : question;
  const conversation = history.map(t => `${t.role === "user" ? "کاربر" : "دستیار"}: ${t.content}`).join("\n");

  // ۱. HyDE — فقط برای سوال‌های کوتاه (< 30 کاراکتر) که embedding ضعیف دارند
  const isShort = question.trim().length < 30;
  const embedQuery = isShort ? await hydeExpand(retrievalQuery) : retrievalQuery;

  // ۲. embed + hybrid search (dense از HyDE + keyword از query اصلی → RRF)
  const vector = await embed(embedQuery);
  const hits = await hybridSearch(retrievalQuery, vector, 12);
  if (hits.length === 0) {
    const enc = new TextEncoder();
    const s = new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(`data: ${JSON.stringify({ token: "سندی با ارتباط معنایی کافی به این پرسش پیدا نشد. پرسش را با واژه‌های دیگری بنویسید، یا اگر Vault تازه به‌روز شده، ابتدا آن را دوباره ایندکس کنید." })}\n\n`));
        c.enqueue(enc.encode(`data: ${JSON.stringify({ done: true, sources: [] })}\n\n`));
        c.close();
      },
    });
    return new NextResponse(s, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  }

  // ۳. یکتاسازی بر اساس سند
  //
  // بدون این کار چند chunk از یک فایل، هم context را با متن تکراری پر می‌کنند و
  // هم در UI به‌صورت چند چیپ یکسان دیده می‌شوند که توهم پشتیبانی بیشتر می‌سازد.
  // بالاترین امتیاز هر سند نگه داشته می‌شود (نتایج از قبل مرتب‌اند).
  const MAX_SOURCES = 7;
  const seen = new Set<string>();
  const unique: Array<Record<string, unknown>> = [];
  for (const h of hits) {
    const p = h.payload as Record<string, string>;
    const key = p.path ?? p.title ?? String(h.id);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(h);
    if (unique.length >= MAX_SOURCES) break;
  }

  // ۴. ساخت context با متادیتای کامل‌تر
  const contextParts = unique.map((h: Record<string, unknown>, i: number) => {
    const p = h.payload as Record<string, string>;
    const text = p.chunk_text ?? p.text_preview ?? "";
    const meta = [p.folder, p.country, p.report_date].filter(Boolean).join(" | ");
    return `[منبع ${i + 1}: ${p.title ?? p.name ?? "—"}${meta ? ` (${meta})` : ""}]\n${text}`;
  });
  const context = contextParts.join("\n\n---\n\n");

  const systemPrompt = `تو یک دستیار تحلیلگر هوشمند سازمانی هستی که به پایگاه دانش سازمان فرهنگ و ارتباطات اسلامی دسترسی داری.

قوانین پاسخ‌دهی:
۱. **فقط از اسناد ارائه‌شده پاسخ بده** — اگر پاسخ در اسناد نیست، صریح بگو: «اطلاعات کافی در اسناد موجود یافت نشد.» و پیشنهاد بده کاربر سوال را دقیق‌تر بپرسد.
۲. **هر ادعا را به منبع وصل کن** — از [منبع N] استفاده کن. بدون منبع، ادعا نکن.
۳. **اطلاعات دانش عمومی را با اسناد قاطی نکن** — اگر چیزی از خودت می‌دانی ولی در اسناد نیست، آن را جدا و با عبارت «براساس دانش عمومی:» مشخص کن.
۴. **پاسخ ساختارمند** — برای سوال‌های چندگانه، هر بخش را جداگانه جواب بده.
۵. **پیگیری مکالمه** — اگر سوال کوتاه است، موضوع قبلی را حفظ کن مگر کاربر صریحاً تغییر دهد.
۶. **پاسخ را فارسی بنویس** — اسامی خاص و اصطلاحات تخصصی می‌توانند انگلیسی بمانند.`;

  const userPrompt = `${conversation ? `تاریخچهٔ کوتاه گفتگو:\n${conversation}\n\n---\n` : ""}اسناد مرتبط:\n\n${context}\n\n---\nسوال فعلی: ${question}`;

  // ۴. تولید پاسخ با qwen3:8b (streaming)
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: CHAT_MODEL,
            stream: true,
            think: false,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
          signal: AbortSignal.timeout(120000),
        });

        const reader = ollamaRes.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split("\n").filter(Boolean);
          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              if (json.message?.content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: json.message.content })}\n\n`));
              }
            } catch {}
          }
        }

        // ارسال منابع در پایان
        const sources = unique.map((h: Record<string, unknown>) => {
          const p = h.payload as Record<string, string>;
          return { title: p.title ?? p.name, folder: p.folder, path: p.path, score: h.score };
        });
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, sources })}\n\n`));
        controller.close();
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`));
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
