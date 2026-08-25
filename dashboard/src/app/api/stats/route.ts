import { NextResponse } from "next/server";
import { QdrantClient } from "@qdrant/js-client-rest";
import { COLLECTION } from "@/lib/vectors";

export async function GET() {
  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL!,
    apiKey: process.env.QDRANT_API_KEY,
  });

  try {
    const collections = await qdrant.getCollections();
    const stats = await Promise.all(
      collections.collections.map(async (c) => {
        const info = await qdrant.getCollection(c.name);
        return {
          name: c.name,
          points: info.points_count ?? 0,
        };
      })
    );

    // شمارش کالکشن فعال، نه جمع همه‌ی کالکشن‌ها: کالکشن‌های بازنشسته (مثل
    // ایندکس قدیمی nomic) هنوز روی دیسک هستند و جمع‌زدنشان عددی می‌سازد که با
    // چیزی که واقعاً قابل جستجوست نمی‌خواند.
    const active = stats.find((c) => c.name === COLLECTION)?.points ?? 0;

    // تعداد سند یکتا (نه chunk). به ایندکس payload روی `path` نیاز دارد؛ اگر
    // نبود، به‌جای عدد حدسی null برمی‌گردانیم تا UI چیزی ساختگی نشان ندهد.
    let indexedDocs: number | null = null;
    try {
      const facet = await qdrant.facet(COLLECTION, { key: "path", limit: 5000, exact: true });
      indexedDocs = facet.hits.length;
    } catch {
      indexedDocs = null;
    }

    return NextResponse.json({
      collections: stats,
      active_collection: COLLECTION,
      total_documents: active,
      indexed_documents: indexedDocs,
      status: "ok",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
