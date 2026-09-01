import { NextResponse } from "next/server";
import { Pool } from "pg";

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

export async function GET() {
  try {
    const c = db();

    // موضوعات (topic entities) با تعداد اسناد
    const topicRows = await c.query<{ topic_id: number; topic_name: string; doc_count: number }>(`
      SELECT e.id topic_id, e.name topic_name, count(DISTINCT m.document_id)::int doc_count
      FROM intel.entity e
      JOIN intel.mention m ON m.entity_id = e.id
      WHERE e.etype = 'topic'
      GROUP BY e.id, e.name
      HAVING count(DISTINCT m.document_id) >= 2
      ORDER BY doc_count DESC
      LIMIT 30
    `);

    if (topicRows.rows.length === 0) {
      // fallback: گروه‌بندی بر اساس کشور
      const countryRows = await c.query<{ country: string; doc_count: number }>(`
        SELECT coalesce(country,'نامشخص') country, count(*)::int doc_count
        FROM intel.document
        GROUP BY 1 ORDER BY 2 DESC LIMIT 20
      `);
      const entityByCountry = await c.query<{
        country: string; entity_id: number; name: string; etype: string; mentions: number
      }>(`
        SELECT coalesce(d.country,'نامشخص') country,
               e.id entity_id, e.name, e.etype,
               count(m.document_id)::int mentions
        FROM intel.document d
        JOIN intel.mention m ON m.document_id = d.id
        JOIN intel.entity e ON e.id = m.entity_id
        WHERE e.etype IN ('person','org','event')
        GROUP BY 1,2,3,4
        ORDER BY 1, mentions DESC
      `);
      const byCountry: Record<string, typeof entityByCountry.rows> = {};
      for (const r of entityByCountry.rows) {
        if (!byCountry[r.country]) byCountry[r.country] = [];
        byCountry[r.country].push(r);
      }
      return NextResponse.json({
        mode: "country",
        concepts: countryRows.rows.map(r => ({
          id: r.country, label: r.country, docs: r.doc_count,
          entities: (byCountry[r.country] ?? []).slice(0, 20).map(e => ({
            id: e.entity_id, name: e.name, etype: e.etype, mentions: e.mentions,
          })),
        })),
      });
    }

    // موجودیت‌های هر موضوع (person/org/event که در همان اسناد هستند)
    const topicIds = topicRows.rows.map(r => r.topic_id);
    const entityRows = await c.query<{
      topic_id: number; entity_id: number; name: string; etype: string; mentions: number
    }>(`
      SELECT tm.topic_entity_id topic_id,
             e.id entity_id, e.name, e.etype,
             count(DISTINCT m.document_id)::int mentions
      FROM (
        SELECT entity_id topic_entity_id, document_id
        FROM intel.mention WHERE entity_id = ANY($1::int[])
      ) tm
      JOIN intel.mention m ON m.document_id = tm.document_id
      JOIN intel.entity e ON e.id = m.entity_id
      WHERE e.etype IN ('person','org','event')
        AND e.id <> tm.topic_entity_id
      GROUP BY 1,2,3,4
      ORDER BY 1, mentions DESC
    `, [topicIds]);

    const byTopic: Record<number, typeof entityRows.rows> = {};
    for (const r of entityRows.rows) {
      if (!byTopic[r.topic_id]) byTopic[r.topic_id] = [];
      if (byTopic[r.topic_id].length < 25) byTopic[r.topic_id].push(r);
    }

    return NextResponse.json({
      mode: "topic",
      concepts: topicRows.rows.map(r => ({
        id: r.topic_id, label: r.topic_name, docs: r.doc_count,
        entities: (byTopic[r.topic_id] ?? []).map(e => ({
          id: e.entity_id, name: e.name, etype: e.etype, mentions: e.mentions,
        })),
      })),
    });
  } catch (err) {
    console.error("knowledge-tree:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
