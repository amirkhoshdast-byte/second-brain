import { NextRequest, NextResponse } from "next/server";
import { OLLAMA_URL, embed, search } from "@/lib/vectors";

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

export async function POST(req: NextRequest) {
  const { question, history: rawHistory } = await req.json();
  if (!question?.trim()) return NextResponse.json({ error: "سوال خالی است" }, { status: 400 });
  const history = cleanHistory(rawHistory);
  const priorQuestions = history.filter(t => t.role === "user").slice(-2).map(t => t.content);
  const retrievalQuery = priorQuestions.length
    ? `زمینهٔ پرسش‌های پیشین: ${priorQuestions.join(" | ")}\nپرسش پیگیری: ${question}`
    : question;
  const conversation = history.map(t => `${t.role === "user" ? "کاربر" : "دستیار"}: ${t.content}`).join("\n");

  // ۱. embed پرسش کامل‌شده با زمینهٔ گفتگو
  const vector = await embed(retrievalQuery);

  // ۲. بازیابی context از Qdrant
  //
  // chunkهای پرامتیاز اغلب از یک سند می‌آیند، پس بیش از نیاز بازیابی می‌کنیم تا
  // پس از یکتاسازی همچنان چند سند متمایز باقی بماند.
  const hits = await search(vector, 12, 0.3);
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
  const MAX_SOURCES = 5;
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

  // ۴. ساخت context
  const contextParts = unique.map((h: Record<string, unknown>, i: number) => {
    const p = h.payload as Record<string, string>;
    const text = p.chunk_text ?? p.text_preview ?? "";
    return `[منبع ${i + 1}: ${p.title ?? p.name ?? "—"} | ${p.folder ?? ""}]\n${text}`;
  });
  const context = contextParts.join("\n\n---\n\n");

  const systemPrompt = `تو یک دستیار تحلیلگر هوشمند سازمانی هستی.
پاسخ‌هایت باید:
- بر اساس اسناد ارائه‌شده باشد
- اگر اطلاعات در اسناد نیست، صادقانه بگو «در اسناد موجود اطلاعاتی پیدا نشد»
- منابع را با [منبع N] ارجاع بده
- پاسخ را به فارسی بده
- اگر پرسش کاربر پیگیریِ پرسش قبل است، موضوع پرسش قبل را حفظ کن مگر کاربر صریحاً موضوع را عوض کرده باشد`;

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
