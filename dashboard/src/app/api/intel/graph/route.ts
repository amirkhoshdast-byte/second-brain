import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

let pool: Pool | null = null;
function db() {
  if (!pool) {
    pool = new Pool({
      host: process.env.POSTGRES_HOST ?? "localhost",
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      max: 4,
      idleTimeoutMillis: 20000,
    });
  }
  return pool;
}

// ── ساخت dynamic WHERE + params ───────────────────────────────────────────────
function buildFilter(opts: {
  dateFrom?: string | null;
  dateTo?:   string | null;
  topic?:    string | null;
  country?:  string | null;
}) {
  const clauses: string[] = [];
  const params: string[] = [];

  const p = () => { params.push(""); return `$${params.length}`; };
  const add = (val: string, clause: string) => {
    params[params.length] = val; // will be set below
    clauses.push(clause);
    params.push(val);
    clauses[clauses.length - 1] = clause.replace("__P__", `$${params.length}`);
    params.pop(); // we added it above, now do it properly
  };

  // clean builder
  const parts: { val: string; clause: string }[] = [];

  if (opts.dateFrom) parts.push({ val: opts.dateFrom, clause: "d.report_date >= __P__::date" });
  if (opts.dateTo)   parts.push({ val: opts.dateTo,   clause: "d.report_date <= __P__::date" });
  if (opts.topic)    parts.push({ val: opts.topic,    clause: `EXISTS (
    SELECT 1 FROM intel.mention _tm
    JOIN intel.entity _te ON _te.id = _tm.entity_id
    WHERE _tm.document_id = d.id AND _te.etype = 'topic' AND _te.name = __P__
  )` });
  if (opts.country)  parts.push({ val: opts.country,  clause: "d.country = __P__" });

  const values: string[] = [];
  const resolved = parts.map(({ val, clause }) => {
    values.push(val);
    return clause.replace("__P__", `$${values.length}`);
  });

  const where = resolved.length ? resolved.join(" AND ") : "TRUE";
  return { where, values };
}

export async function GET(req: NextRequest) {
  const country  = req.nextUrl.searchParams.get("country")  || null;
  const topic    = req.nextUrl.searchParams.get("topic")    || null;
  const dateFrom = req.nextUrl.searchParams.get("dateFrom") || null;
  const dateTo   = req.nextUrl.searchParams.get("dateTo")   || null;

  try {
    const c = db();

    const { where: docWhere, values: baseParams } = buildFilter({ dateFrom, dateTo, topic, country });

    // ── موضوعات برتر + بازه تاریخ — همیشه برگردان ───────────────────────────
    const [topTopicsRes, dateRangeRes] = await Promise.all([
      c.query(`
        SELECT e.name, count(distinct m.document_id)::int n
        FROM intel.entity e
        JOIN intel.mention m ON m.entity_id = e.id
        WHERE e.etype = 'topic'
        GROUP BY e.name HAVING count(distinct m.document_id) >= 5
        ORDER BY n DESC LIMIT 12
      `),
      c.query(`
        SELECT to_char(min(report_date),'YYYY-MM-DD') min_date,
               to_char(max(report_date),'YYYY-MM-DD') max_date
        FROM intel.document WHERE report_date IS NOT NULL
      `),
    ]);
    const topTopics = topTopicsRes.rows;
    const dateRange = dateRangeRes.rows[0] ?? { min_date: null, max_date: null };

    if (country) {
      // ── حالت تک‌کشوری ──────────────────────────────────────────────────────
      const { where: signalWhere, values: signalParams } = buildFilter({ topic, country });

      const [entities, cooccur, signals] = await Promise.all([
        c.query(`
          SELECT e.id::text, e.etype, e.name, count(m.document_id)::int mentions
          FROM intel.entity e
          JOIN intel.mention m ON m.entity_id = e.id
          JOIN intel.document d ON d.id = m.document_id
          WHERE e.etype IN ('topic','person','org','event')
            AND ${docWhere}
          GROUP BY e.id HAVING count(m.document_id) >= 2
          ORDER BY mentions DESC LIMIT 40
        `, baseParams),
        c.query(`
          SELECT m1.entity_id::text a, m2.entity_id::text b,
                 count(distinct m1.document_id)::int w
          FROM intel.mention m1
          JOIN intel.mention m2
            ON m1.document_id = m2.document_id
           AND m1.entity_id < m2.entity_id
          JOIN intel.document d ON d.id = m1.document_id
          WHERE ${docWhere}
          GROUP BY 1, 2 HAVING count(distinct m1.document_id) >= 2
          ORDER BY w DESC LIMIT 60
        `, baseParams),
        c.query(`
          SELECT s.id::text, s.stype, s.title, s.country, s.topic, s.confidence::float
          FROM intel.signal s
          WHERE ${signalWhere || "TRUE"}
          ORDER BY s.confidence DESC LIMIT 8
        `, signalParams),
      ]);
      return NextResponse.json({
        ready: true, mode: "single", centerCountry: country,
        countries: [{ country, n: 0 }],
        entities: entities.rows, cooccur: cooccur.rows, signals: signals.rows,
        topTopics, dateRange,
      });
    }

    // ── حالت چندکشوری ──────────────────────────────────────────────────────────
    const { where: signalWhere, values: signalParams } = buildFilter({ topic });

    const [countries, entities, cooccur, signals, perCountryEnts] = await Promise.all([
      c.query(`
        SELECT d.country, count(distinct d.id)::int n
        FROM intel.document d
        WHERE d.country IS NOT NULL AND d.country <> ''
          AND ${docWhere}
        GROUP BY d.country ORDER BY n DESC LIMIT 8
      `, baseParams),
      c.query(`
        SELECT e.id::text, e.etype, e.name, count(m.document_id)::int mentions
        FROM intel.entity e
        JOIN intel.mention m ON m.entity_id = e.id
        JOIN intel.document d ON d.id = m.document_id
        WHERE e.etype IN ('topic','person','org','event')
          AND ${docWhere}
        GROUP BY e.id HAVING count(m.document_id) >= 3
        ORDER BY mentions DESC LIMIT 48
      `, baseParams),
      c.query(`
        SELECT m1.entity_id::text a, m2.entity_id::text b,
               count(distinct m1.document_id)::int w
        FROM intel.mention m1
        JOIN intel.mention m2
          ON m1.document_id = m2.document_id
         AND m1.entity_id < m2.entity_id
        JOIN intel.document d ON d.id = m1.document_id
        WHERE ${docWhere}
        GROUP BY 1, 2 HAVING count(distinct m1.document_id) >= 3
        ORDER BY w DESC LIMIT 80
      `, baseParams),
      c.query(`
        SELECT s.id::text, s.stype, s.title, s.country, s.topic, s.confidence::float
        FROM intel.signal s
        WHERE ${signalWhere || "TRUE"}
        ORDER BY s.confidence DESC LIMIT 10
      `, signalParams),
      c.query(`
        WITH top_countries AS (
          SELECT d.country FROM intel.document d
          WHERE d.country IS NOT NULL AND ${docWhere}
          GROUP BY d.country ORDER BY count(*) DESC LIMIT 8
        ),
        ranked AS (
          SELECT d.country, e.id::text eid, e.name, e.etype,
                 count(m.document_id)::int mentions,
                 row_number() OVER (PARTITION BY d.country ORDER BY count(m.document_id) DESC) rn
          FROM intel.mention m
          JOIN intel.entity e ON e.id = m.entity_id
          JOIN intel.document d ON d.id = m.document_id
          JOIN top_countries tc ON tc.country = d.country
          WHERE e.etype IN ('topic','person','org','event')
            AND ${docWhere}
          GROUP BY d.country, e.id, e.name, e.etype
          HAVING count(m.document_id) >= 2
        )
        SELECT country, eid, name, etype, mentions FROM ranked WHERE rn <= 6
      `, baseParams),
    ]);

    return NextResponse.json({
      ready: true, mode: "multi",
      countries: countries.rows, entities: entities.rows,
      cooccur: cooccur.rows, signals: signals.rows,
      perCountry: perCountryEnts.rows,
      topTopics, dateRange,
    });
  } catch (err) {
    return NextResponse.json({ ready: false, error: String(err) }, { status: 200 });
  }
}
