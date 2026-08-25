import { NextResponse } from "next/server";
import { QdrantClient } from "@qdrant/js-client-rest";
import { COLLECTION } from "@/lib/vectors";

export async function GET() {
  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL!,
    apiKey: process.env.QDRANT_API_KEY,
  });

  try {
    const result = await qdrant.scroll(COLLECTION, {
      limit: 20,
      with_payload: true,
      with_vector: false,
    });

    const docs = result.points.map((p) => ({
      id: p.id,
      ...(p.payload as Record<string, unknown>),
    }));

    return NextResponse.json({ documents: docs });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
