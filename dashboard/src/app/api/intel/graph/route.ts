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
  const topic   = req.nextUrl.searchParams.get("topic")   ?? null;

  try {
    const c = db();

    // ── موضوعات برتر — همیشه برگردان (برای چیپ‌های فیلتر) ──────────────────
    const topTopicsRes = await c.query(`
      select e.name, count(distinct m.document_id)::int n
      from intel.entity e
      join intel.mention m on m.entity_id = e.id
      where e.etype = 'topic'
      group by e.name having count(distinct m.document_id) >= 5
      order by n desc limit 12
    `);
    const topTopics = topTopicsRes.rows;

    // ── ساخت شرط فیلتر مشترک ─────────────────────────────────────────────────
    // وقتی topic داده شده، اسناد را به آنهایی که این موضوع را دارند محدود می‌کنیم
    const topicJoin = topic
      ? `join intel.mention tm on tm.document_id = d.id
         join intel.entity  te on te.id = tm.entity_id and te.etype='topic' and te.name=$1`
      : "";
    const topicParam = topic ? [topic] : [];

    if (country) {
      // ── حالت تک‌کشوری (با فیلتر اختیاری موضوع) ─────────────────────────────
      const countryParam = topic ? [topic, country] : [country];
      const countryIdx   = topic ? "$2" : "$1";

      const [entities, cooccur, signals] = await Promise.all([
        c.query(`
          select e.id::text, e.etype, e.name, count(m.document_id)::int mentions
          from intel.entity e
          join intel.mention m on m.entity_id = e.id
          join intel.document d on d.id = m.document_id
          ${topicJoin}
          where e.etype in ('topic','person','org','event')
            and d.country = ${countryIdx}
          group by e.id having count(m.document_id) >= 2
          order by mentions desc limit 40
        `, countryParam),
        c.query(`
          select m1.entity_id::text a, m2.entity_id::text b,
                 count(distinct m1.document_id)::int w
          from intel.mention m1
          join intel.mention m2
            on m1.document_id = m2.document_id
           and m1.entity_id < m2.entity_id
          join intel.document d on d.id = m1.document_id
          ${topicJoin}
          where d.country = ${countryIdx}
          group by 1, 2 having count(distinct m1.document_id) >= 2
          order by w desc limit 60
        `, countryParam),
        c.query(`
          select id::text, stype, title, country, topic, confidence::float
          from intel.signal where country = ${countryIdx}
          ${topic ? `and topic = $1` : ""}
          order by confidence desc limit 8
        `, countryParam),
      ]);
      return NextResponse.json({
        ready: true, mode: "single", centerCountry: country,
        countries: [{ country, n: 0 }],
        entities: entities.rows, cooccur: cooccur.rows, signals: signals.rows,
        topTopics,
      });
    }

    // ── حالت چندکشوری (با فیلتر اختیاری موضوع) ─────────────────────────────
    const [countries, entities, cooccur, signals, perCountryEnts] = await Promise.all([
      c.query(`
        select d.country, count(distinct d.id)::int n
        from intel.document d
        ${topicJoin}
        where d.country is not null and d.country <> ''
        group by d.country order by n desc limit 8
      `, topicParam),
      c.query(`
        select e.id::text, e.etype, e.name, count(m.document_id)::int mentions
        from intel.entity e
        join intel.mention m on m.entity_id = e.id
        join intel.document d on d.id = m.document_id
        ${topicJoin}
        where e.etype in ('topic','person','org','event')
        group by e.id having count(m.document_id) >= 3
        order by mentions desc limit 48
      `, topicParam),
      c.query(`
        select m1.entity_id::text a, m2.entity_id::text b,
               count(distinct m1.document_id)::int w
        from intel.mention m1
        join intel.mention m2
          on m1.document_id = m2.document_id
         and m1.entity_id < m2.entity_id
        join intel.document d on d.id = m1.document_id
        ${topicJoin}
        group by 1, 2 having count(distinct m1.document_id) >= 3
        order by w desc limit 80
      `, topicParam),
      c.query(`
        select id::text, stype, title, country, topic, confidence::float
        from intel.signal
        ${topic ? `where topic = $1` : ""}
        order by confidence desc limit 10
      `, topicParam),
      c.query(
        topic
          ? `
            with top_countries as (
              select d.country from intel.document d
              join intel.mention tm on tm.document_id = d.id
              join intel.entity  te on te.id = tm.entity_id and te.etype='topic' and te.name=$1
              where d.country is not null group by d.country order by count(*) desc limit 8
            ),
            ranked as (
              select d.country, e.id::text eid, e.name, e.etype,
                     count(m.document_id)::int mentions,
                     row_number() over (partition by d.country order by count(m.document_id) desc) rn
              from intel.mention m
              join intel.entity e on e.id = m.entity_id
              join intel.document d on d.id = m.document_id
              join intel.mention tm on tm.document_id = d.id
              join intel.entity  te on te.id = tm.entity_id and te.etype='topic' and te.name=$1
              join top_countries tc on tc.country = d.country
              where e.etype in ('topic','person','org','event')
              group by d.country, e.id, e.name, e.etype
              having count(m.document_id) >= 2
            )
            select country, eid, name, etype, mentions from ranked where rn <= 6
          `
          : `
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
          `,
        topicParam
      ),
    ]);

    return NextResponse.json({
      ready: true, mode: "multi",
      countries: countries.rows, entities: entities.rows,
      cooccur: cooccur.rows, signals: signals.rows,
      perCountry: perCountryEnts.rows,
      topTopics,
    });
  } catch (err) {
    return NextResponse.json({ ready: false, error: String(err) }, { status: 200 });
  }
}
