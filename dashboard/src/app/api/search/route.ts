import { NextRequest, NextResponse } from "next/server";
import { COLLECTION, embed, qdrant, hybridSearch } from "@/lib/vectors";

export async function GET(req: NextRequest) {
  const q        = req.nextUrl.searchParams.get("q") ?? "";
  const country  = req.nextUrl.searchParams.get("country") ?? "";
  const dateFrom = req.nextUrl.searchParams.get("from") ?? "";  // YYYY-MM-DD
  const dateTo   = req.nextUrl.searchParams.get("to") ?? "";
  const collection = req.nextUrl.searchParams.get("collection") ?? COLLECTION;
  const limit    = parseInt(req.nextUrl.searchParams.get("limit") ?? "12");

  if (!q.trim()) {
    return NextResponse.json({ query: "", results: [], semantic: false });
  }

  // ساخت فیلتر Qdrant
  const must: unknown[] = [];
  if (country) must.push({ key: "country", match: { value: country } });
  if (dateFrom) must.push({ key: "report_date", range: { gte: dateFrom } });
  if (dateTo)   must.push({ key: "report_date", range: { lte: dateTo } });
  const qdrantFilter = must.length ? { must } : undefined;

  try {
    const vector = await embed(q);
    const hits = await hybridSearch(q, vector, limit, qdrantFilter ? country : undefined);

    // اگر فیلتر اضافی (تاریخ) دارد، روی نتایج اعمال کن
    const filtered = (dateFrom || dateTo)
      ? hits.filter(h => {
          const p = h.payload as Record<string, string>;
          const d = p.report_date;
          if (!d) return false;
          if (dateFrom && d < dateFrom) return false;
          if (dateTo   && d > dateTo)   return false;
          return true;
        })
      : hits;

    const results = filtered.map((p: Record<string, unknown>) => ({
      id: p.id,
      score: typeof p.score === "number" ? Math.round((p.score as number) * 100) / 100 : 0,
      ...(p.payload as Record<string, unknown>),
    }));

    return NextResponse.json({ query: q, results, semantic: true, total: results.length });
  } catch (err) {
    const fallback = await qdrant(`/collections/${collection}/points/scroll`, "POST", {
      limit: 1000,
      with_payload: true,
      with_vector: false,
      ...(qdrantFilter ? { filter: qdrantFilter } : {}),
    });
    const all = (fallback.result?.points ?? []) as Array<Record<string, unknown>>;
    const needle = q.toLowerCase();
    const filtered = all.filter((p) => {
      const payload = p.payload as Record<string, string>;
      return (
        payload.title?.toLowerCase().includes(needle) ||
        payload.chunk_text?.toLowerCase().includes(needle) ||
        payload.text_preview?.toLowerCase().includes(needle)
      );
    });
    return NextResponse.json({
      query: q,
      results: filtered.slice(0, limit).map((p) => ({ id: p.id, score: null, ...(p.payload as Record<string, unknown>) })),
      semantic: false,
      error: String(err),
    });
  }
}
