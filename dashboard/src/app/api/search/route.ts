import { NextRequest, NextResponse } from "next/server";
import { COLLECTION, embed, qdrant, search } from "@/lib/vectors";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const collection = req.nextUrl.searchParams.get("collection") ?? COLLECTION;
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "10");

  if (!q.trim()) {
    return NextResponse.json({ query: "", results: [], semantic: false });
  }

  try {
    const vector = await embed(q);
    const hits = await search(vector, limit, 0.3);

    const results = hits.map((p: Record<string, unknown>) => ({
      id: p.id,
      score: typeof p.score === "number" ? Math.round((p.score as number) * 100) / 100 : 0,
      ...(p.payload as Record<string, unknown>),
    }));

    return NextResponse.json({ query: q, results, semantic: true });
  } catch (err) {
    // بازگشت به جستجوی متنی ساده تا اگر embedding یا Qdrant از کار افتاد،
    // کاربر همچنان بتواند اسناد را پیدا کند.
    const fallback = await qdrant(`/collections/${collection}/points/scroll`, "POST", {
      limit: 1000,
      with_payload: true,
      with_vector: false,
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
