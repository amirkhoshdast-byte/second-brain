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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const forceMode = url.searchParams.get("mode"); // "topic" | "country" | null

  try {
    const c = db();

    if (forceMode === "country") {
      const [countryRows, entityByCountryRes, topDocsRes, timelineRes, signalRes] = await Promise.all([
        c.query<{ country: string; doc_count: number }>(`
          SELECT coalesce(country,'نامشخص') country, count(*)::int doc_count
          FROM intel.document
          GROUP BY 1 ORDER BY 2 DESC LIMIT 20
        `),
        c.query<{ country: string; entity_id: number; name: string; etype: string; mentions: number }>(`
          SELECT coalesce(d.country,'نامشخص') country,
                 e.id entity_id, e.name, e.etype,
                 count(m.document_id)::int mentions
          FROM intel.document d
          JOIN intel.mention m ON m.document_id = d.id
          JOIN intel.entity e ON e.id = m.entity_id
          WHERE e.etype IN ('person','org','event')
          GROUP BY 1,2,3,4
          ORDER BY 1, mentions DESC
        `),
        c.query<{ country: string; doc_id: string; title: string; report_date: string; path: string; rn: number }>(`
          SELECT coalesce(d.country,'نامشخص') country,
                 d.id::text doc_id, d.title,
                 to_char(d.report_date,'YYYY-MM-DD') report_date, d.path,
                 row_number() OVER (PARTITION BY d.country ORDER BY d.report_date DESC NULLS LAST) rn
          FROM intel.document d
        `),
        c.query<{ country: string; ym: string; n: number }>(`
          SELECT coalesce(country,'نامشخص') country,
                 to_char(report_date,'YYYY-MM') ym, count(*)::int n
          FROM intel.document
          WHERE report_date IS NOT NULL
          GROUP BY 1,2 ORDER BY 1,2
        `),
        c.query<{ country: string; n: number }>(`
          SELECT coalesce(country,'نامشخص') country, count(*)::int n
          FROM intel.signal WHERE country IS NOT NULL GROUP BY 1
        `),
      ]);

      const byCountry: Record<string, typeof entityByCountryRes.rows> = {};
      for (const r of entityByCountryRes.rows) {
        if (!byCountry[r.country]) byCountry[r.country] = [];
        byCountry[r.country].push(r);
      }
      const docsByCountry: Record<string, typeof topDocsRes.rows> = {};
      for (const r of topDocsRes.rows) {
        if (r.rn > 6) continue;
        if (!docsByCountry[r.country]) docsByCountry[r.country] = [];
        docsByCountry[r.country].push(r);
      }
      const timelineByCountry: Record<string, { month: string; n: number }[]> = {};
      for (const r of timelineRes.rows) {
        if (!timelineByCountry[r.country]) timelineByCountry[r.country] = [];
        timelineByCountry[r.country].push({ month: r.ym, n: r.n });
      }
      const signalByCountry: Record<string, number> = {};
      for (const r of signalRes.rows) signalByCountry[r.country] = r.n;

      return NextResponse.json({
        mode: "country",
        concepts: countryRows.rows.map(r => ({
          id: r.country, label: r.country, docs: r.doc_count,
          signals: signalByCountry[r.country] ?? 0,
          entities: (byCountry[r.country] ?? []).slice(0, 25).map(e => ({
            id: e.entity_id, name: e.name, etype: e.etype, mentions: e.mentions,
          })),
          top_docs: (docsByCountry[r.country] ?? []).map(d => ({
            id: d.doc_id, title: d.title, country: r.country,
            report_date: d.report_date, path: d.path,
          })),
          timeline: timelineByCountry[r.country] ?? [],
        })),
      });
    }

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
      // fallback: redirect to country mode
      const url2 = new URL(req.url);
      url2.searchParams.set("mode", "country");
      return GET(new Request(url2.toString()));
    }

    const topicIds = topicRows.rows.map(r => r.topic_id);

    const [entityRows, docRows, timelineRows, signalRows] = await Promise.all([
      // موجودیت‌های هر موضوع
      c.query<{ topic_id: number; entity_id: number; name: string; etype: string; mentions: number }>(`
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
      `, [topicIds]),

      // اسناد برتر هر موضوع
      c.query<{ topic_id: number; doc_id: string; title: string; country: string; report_date: string; path: string }>(`
        SELECT m.entity_id topic_id, d.id::text doc_id,
               d.title, coalesce(d.country,'') country,
               to_char(d.report_date,'YYYY-MM-DD') report_date, d.path,
               row_number() over (partition by m.entity_id order by d.report_date desc nulls last) rn
        FROM intel.mention m
        JOIN intel.document d ON d.id = m.document_id
        WHERE m.entity_id = ANY($1::int[])
      `, [topicIds]),

      // توزیع ماهانه هر موضوع
      c.query<{ topic_id: number; ym: string; n: number }>(`
        SELECT m.entity_id topic_id,
               to_char(d.report_date,'YYYY-MM') ym,
               count(*)::int n
        FROM intel.mention m
        JOIN intel.document d ON d.id = m.document_id
        WHERE m.entity_id = ANY($1::int[])
          AND d.report_date IS NOT NULL
        GROUP BY 1, 2
        ORDER BY 1, 2
      `, [topicIds]),

      // سیگنال‌های هر موضوع
      c.query<{ topic: string; n: number }>(`
        SELECT topic, count(*)::int n FROM intel.signal
        WHERE topic IS NOT NULL GROUP BY topic
      `),
    ]);

    const byTopic: Record<number, typeof entityRows.rows> = {};
    for (const r of entityRows.rows) {
      if (!byTopic[r.topic_id]) byTopic[r.topic_id] = [];
      if (byTopic[r.topic_id].length < 25) byTopic[r.topic_id].push(r);
    }

    const docsByTopic: Record<number, typeof docRows.rows> = {};
    for (const r of docRows.rows) {
      if (!docsByTopic[r.topic_id]) docsByTopic[r.topic_id] = [];
      if (docsByTopic[r.topic_id].length < 6) docsByTopic[r.topic_id].push(r);
    }

    const timelineByTopic: Record<number, { month: string; n: number }[]> = {};
    for (const r of timelineRows.rows) {
      if (!timelineByTopic[r.topic_id]) timelineByTopic[r.topic_id] = [];
      timelineByTopic[r.topic_id].push({ month: r.ym, n: r.n });
    }

    const signalMap: Record<string, number> = {};
    for (const r of signalRows.rows) signalMap[r.topic] = r.n;

    return NextResponse.json({
      mode: "topic",
      concepts: topicRows.rows.map(r => ({
        id: r.topic_id, label: r.topic_name, docs: r.doc_count,
        signals: signalMap[r.topic_name] ?? 0,
        entities: (byTopic[r.topic_id] ?? []).map(e => ({
          id: e.entity_id, name: e.name, etype: e.etype, mentions: e.mentions,
        })),
        top_docs: (docsByTopic[r.topic_id] ?? []).map(d => ({
          id: d.doc_id, title: d.title, country: d.country,
          report_date: d.report_date, path: d.path,
        })),
        timeline: timelineByTopic[r.topic_id] ?? [],
      })),
    });
  } catch (err) {
    console.error("knowledge-tree:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
