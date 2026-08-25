/**
 * پیکربندی مشترک جستجوی برداری.
 *
 * مدل embedding و کالکشن Qdrant باید همیشه با هم عوض شوند: هر کالکشن با ابعاد
 * خروجی یک مدل مشخص ساخته می‌شود. اگر این دو از هم جدا بیفتند، Qdrant خطای
 * ناهماهنگی ابعاد می‌دهد و جستجو کاملاً از کار می‌افتد — دقیقاً همان اتفاقی که
 * وقتی کالکشن ۷۶۸ بعدی nomic با کوئری‌های bge-m3 (۱۰۲۴ بعدی) صدا زده می‌شد رخ داد.
 *
 * به همین دلیل هر دو اینجا کنار هم تعریف شده‌اند، نه پراکنده در مسیرهای API.
 */
export const EMBED_MODEL = process.env.EMBEDDING_MODEL ?? "bge-m3";
export const COLLECTION = process.env.QDRANT_COLLECTION ?? "org_documents_bge";

export const OLLAMA_URL = process.env.OLLAMA_HOST ?? "http://localhost:11434";
export const QDRANT_URL = process.env.QDRANT_URL!;
export const QDRANT_KEY = process.env.QDRANT_API_KEY!;

/** بردار یک متن را با مدل پیکربندی‌شده می‌سازد. */
export async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status} برای مدل ${EMBED_MODEL}`);
  const d = await res.json();
  return d.embeddings[0];
}

/**
 * فراخوانی Qdrant که روی پاسخ ناموفق throw می‌کند.
 *
 * بدون این بررسی، خطای Qdrant بی‌صدا به «۰ نتیجه» تبدیل می‌شود و کاربر
 * پیام گمراه‌کننده‌ی «چیزی پیدا نشد» می‌بیند در حالی که ایراد پیکربندی است.
 */
export async function qdrant(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${QDRANT_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "api-key": QDRANT_KEY },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.status?.error ?? `Qdrant ${res.status}`);
  }
  return json;
}

/** جستجوی برداری در کالکشن پیکربندی‌شده. */
export async function search(vector: number[], limit = 5, scoreThreshold?: number) {
  const body: Record<string, unknown> = {
    vector, limit, with_payload: true, with_vector: false,
  };
  if (scoreThreshold !== undefined) body.score_threshold = scoreThreshold;
  const d = await qdrant(`/collections/${COLLECTION}/points/search`, "POST", body);
  return d.result ?? [];
}
