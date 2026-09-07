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

/**
 * جستجوی کلیدواژه‌ای روی chunk_text و title.
 * نیازمند payload index از نوع text روی این فیلدها است (یک‌بار از طریق API ایجاد شده).
 */
export async function keywordSearch(query: string, limit = 12, extraFilter?: unknown): Promise<SearchHit[]> {
  // کلمات معنادار را استخراج کن (stop-words فارسی و عربی حذف می‌شوند)
  const STOP = new Set(["و","در","به","از","که","این","با","را","است","یک","آن","ها","می","هم","تا","اما","برای","یا","هر","نیز","بر","شد","شده"]);
  const words = query.trim().split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
  if (!words.length) return [];

  const wordClauses = words.slice(0, 6).map(w => ({ key: "chunk_text", match: { text: w } }));
  const extraMust = extraFilter ? ((extraFilter as { must?: unknown[] }).must ?? [extraFilter]) : [];
  const filter = { must: [...wordClauses, ...extraMust as object[]] };

  try {
    const d = await qdrant(`/collections/${COLLECTION}/points/scroll`, "POST", {
      filter,
      limit,
      with_payload: true,
      with_vector: false,
    });
    // scroll نتیجه بدون score برمی‌گردد؛ score ثابت ۰.۵ برای RRF کافی است
    return (d.result?.points ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      score: 0.5,
    }));
  } catch {
    return [];
  }
}

type SearchHit = Record<string, unknown>;

/**
 * Reciprocal Rank Fusion — ترکیب دو لیست رتبه‌بندی‌شده.
 *
 * k=60 مقدار استاندارد RRF است. هر نتیجه امتیاز 1/(k+rank) می‌گیرد
 * و امتیازها از هر دو لیست جمع می‌شوند.
 */
function rrf(lists: SearchHit[][], k = 60, topN = 8): SearchHit[] {
  const scores = new Map<string, { hit: SearchHit; score: number }>();

  for (const list of lists) {
    list.forEach((hit, rank) => {
      const id = String(hit.id);
      const prev = scores.get(id)?.score ?? 0;
      scores.set(id, { hit, score: prev + 1 / (k + rank + 1) });
    });
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(({ hit, score }) => ({ ...hit, score }));
}

/**
 * Hybrid search = dense vector + keyword → RRF merge.
 *
 * این تابع جایگزین `search()` در RAG pipeline می‌شود.
 * بدون re-index کار می‌کند چون از payload index موجود استفاده می‌کند.
 */
export async function hybridSearch(
  query: string,
  vector: number[],
  limit = 8,
  countryFilter?: string,
): Promise<SearchHit[]> {
  const filter = countryFilter ? {
    must: [{ key: "country", match: { value: countryFilter } }],
  } : undefined;

  const [dense, keyword] = await Promise.all([
    searchWithFilter(vector, 16, 0.2, filter),
    keywordSearch(query, 16, filter),
  ]);

  // اگر keyword هیچ نتیجه‌ای نداشت، فقط dense برگردان
  if (!keyword.length) return dense.slice(0, limit);

  return rrf([dense, keyword], 60, limit);
}

async function searchWithFilter(vector: number[], limit = 5, scoreThreshold?: number, filter?: unknown) {
  const body: Record<string, unknown> = {
    vector, limit, with_payload: true, with_vector: false,
  };
  if (scoreThreshold !== undefined) body.score_threshold = scoreThreshold;
  if (filter) body.filter = filter;
  const d = await qdrant(`/collections/${COLLECTION}/points/search`, "POST", body);
  return d.result ?? [];
}
