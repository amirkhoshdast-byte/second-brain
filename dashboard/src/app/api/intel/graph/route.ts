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

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") ?? null;

  try {
    const c = db();

    if (country) {
      // ── حالت تک‌کشوری: فقط داده‌ی همان کشور ──────────────────────────────
      const [entities, cooccur, signals] = await Promise.all([
        c.query(`
          select e.id::text, e.etype, e.name, count(m.document_id)::int mentions
          from intel.entity e
          join intel.mention m on m.entity_id = e.id
          join intel.document d on d.id = m.document_id
          where e.etype in ('topic','person','org','event')
            and d.country = $1
          group by e.id having count(m.document_id) >= 2
          order by mentions desc limit 40
        `, [country]),
        c.query(`
          select m1.entity_id::text a, m2.entity_id::text b,
                 count(distinct m1.document_id)::int w
          from intel.mention m1
          join intel.mention m2
            on m1.document_id = m2.document_id
           and m1.entity_id < m2.entity_id
          join intel.document d on d.id = m1.document_id
          where d.country = $1
          group by 1, 2 having count(distinct m1.document_id) >= 2
          order by w desc limit 60
        `, [country]),
        c.query(`
          select id::text, stype, title, country, topic, confidence::float
          from intel.signal where country = $1
          order by confidence desc limit 8
        `, [country]),
      ]);
      return NextResponse.json({
        ready: true,
        mode: "single",
        centerCountry: country,
        countries: [{ country, n: 0 }],
        entities: entities.rows,
        cooccur: cooccur.rows,
        signals: signals.rows,
      });
    }

    // ── حالت چندکشوری: همه کشورها با موجودیت‌های برتر هر کدام ──────────────
    const [countries, entities, cooccur, signals, perCountryEnts] = await Promise.all([
      c.query(`
        select country, count(*)::int n
        from intel.document
        where country is not null and country <> ''
        group by country order by n desc limit 8
      `),
      c.query(`
        select e.id::text, e.etype, e.name, count(m.document_id)::int mentions
        from intel.entity e
        join intel.mention m on m.entity_id = e.id
        where e.etype in ('topic','person','org','event')
        group by e.id having count(m.document_id) >= 3
        order by mentions desc limit 48
      `),
      c.query(`
        select m1.entity_id::text a, m2.entity_id::text b,
               count(distinct m1.document_id)::int w
        from intel.mention m1
        join intel.mention m2
          on m1.document_id = m2.document_id
         and m1.entity_id < m2.entity_id
        group by 1, 2 having count(distinct m1.document_id) >= 3
        order by w desc limit 80
      `),
      c.query(`
        select id::text, stype, title, country, topic, confidence::float
        from intel.signal
        order by confidence desc limit 10
      `),
      // موجودیت‌های برتر هر کشور (برای چیدمان چندمرکزی)
      c.query(`
        with top_countries as (
          select country from intel.document
          where country is not null group by country order by count(*) desc limit 8
        ),
        ranked as (
          select d.country, e.id::text eid, e.name, e.etype,
                 count(m.document_id)::int mentions,
                 row_number() over (partition by d.country order by count(m.document_id) desc) rn
          from intel.mention m
          join intel.entity e on e.id = m.entity_id
          join intel.document d on d.id = m.document_id
          join top_countries tc on tc.country = d.country
          where e.etype in ('topic','person','org','event')
          group by d.country, e.id, e.name, e.etype
          having count(m.document_id) >= 2
        )
        select country, eid, name, etype, mentions from ranked where rn <= 6
      `),
    ]);

    return NextResponse.json({
      ready: true,
      mode: "multi",
      countries: countries.rows,
      entities: entities.rows,
      cooccur: cooccur.rows,
      signals: signals.rows,
      perCountry: perCountryEnts.rows,
    });
  } catch (err) {
    return NextResponse.json({ ready: false, error: String(err) }, { status: 200 });
  }
}
