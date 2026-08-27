import { NextResponse } from "next/server";
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

export async function GET() {
  try {
    const c = db();

    const [countries, entities, cooccur, signals] = await Promise.all([
      // کشورها بر اساس تعداد گزارش
      c.query(`
        select country, count(*)::int n
        from intel.document
        where country is not null and country <> ''
        group by country order by n desc limit 8
      `),
      // موجودیت‌های برتر بر اساس تعداد ذکر
      c.query(`
        select e.id::text, e.etype, e.name, count(m.document_id)::int mentions
        from intel.entity e
        join intel.mention m on m.entity_id = e.id
        where e.etype in ('topic','person','org','event')
        group by e.id having count(m.document_id) >= 3
        order by mentions desc limit 48
      `),
      // هم‌ذکری: جفت موجودیت‌هایی که در یک سند ظاهر شده‌اند
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
      // سیگنال‌ها
      c.query(`
        select id::text, stype, title, country, topic, confidence::float
        from intel.signal
        order by confidence desc limit 10
      `),
    ]);

    return NextResponse.json({
      ready: true,
      countries: countries.rows,
      entities: entities.rows,
      cooccur: cooccur.rows,
      signals: signals.rows,
    });
  } catch (err) {
    return NextResponse.json({ ready: false, error: String(err) }, { status: 200 });
  }
}
