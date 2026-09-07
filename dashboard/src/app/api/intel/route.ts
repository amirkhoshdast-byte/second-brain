import { NextResponse } from "next/server";
import { Pool } from "pg";

/**
 * داده‌ی داشبورد بین‌الملل از خروجی خط لوله‌ی استخراج.
 *
 * اگر خط لوله هنوز اجرا نشده باشد، `ready: false` برمی‌گردد و UI به‌جای
 * نمایش صفر، صریح می‌گوید که استخراج انجام نشده — عدد صفر و «هنوز محاسبه
 * نشده» دو چیز متفاوت‌اند و نباید یکسان دیده شوند.
 */

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

    const [docs, byFolder, entities, signals, regions, topics, flow, countries, recentDocs, entityList] = await Promise.all([
      c.query(`select count(*)::int n,
                      count(*) filter (where extracted_at > now() - interval '30 days')::int recent,
                      count(distinct country)::int countries,
                      round(avg(confidence)::numeric, 3)::float confidence,
                      count(*) filter (where report_date is not null)::int dated,
                      count(*) filter (where report_date is null)::int undated
               from intel.document`),
      c.query(`select coalesce(source_name,'نامشخص') src, count(*)::int n
               from intel.document group by 1 order by 2 desc limit 6`),
      c.query(`select etype, count(*)::int n from intel.entity group by 1`),
      c.query(`select s.id, s.stype, s.title, s.description, s.country, s.topic,
                      s.importance, s.confidence::float, s.direction,
                      count(e.document_id)::int evidence
               from intel.signal s
               left join intel.signal_evidence e on e.signal_id = s.id
               group by s.id
               order by s.confidence desc, evidence desc limit 12`),
      c.query(`select region, count(*)::int n, max(report_date) latest
               from intel.document where region is not null
               group by 1 order by 2 desc`),
      c.query(`select topic, reports::int, countries::int
               from intel.v_topic_stats order by reports desc limit 8`),
      // جریان ماهانه — پایه‌ی نمودار مرکزی
      c.query(`select to_char(date_trunc('month', report_date), 'YYYY-MM') m,
                      count(*)::int n
               from intel.document where report_date is not null
               group by 1 order by 1 desc limit 18`),
      c.query(`select country, count(*)::int n
               from intel.document where country is not null and country <> ''
               group by country order by n desc, country limit 24`),
      c.query(`select title, country, region, report_date, ai_summary, confidence::float
               from intel.document
               order by extracted_at desc nulls last, id desc limit 18`),
      c.query(`select e.etype, e.name, count(m.document_id)::int mentions
               from intel.entity e
               left join intel.mention m on m.entity_id = e.id
               group by e.id, e.etype, e.name
               order by mentions desc, e.name limit 48`),
    ]);

    const d = docs.rows[0];
    const ent: Record<string, number> = Object.fromEntries(
      entities.rows.map((r: { etype: string; n: number }) => [r.etype, r.n]));

    return NextResponse.json({
      ready: d.n > 0,
      documents: d.n,
      recent: d.recent,
      countries: d.countries,
      confidence: d.confidence,
      // اکثر پیکره تاریخ گزارش واقعی ندارد (فقط ۲ از ۴۹۲ سند)؛ UI باید این
      // را صریح بگوید نه اینکه نمودار جریان را با یک fallback ساختگی پر کند.
      datedDocuments: d.dated,
      undatedDocuments: d.undated,
      entities: {
        topic: ent.topic ?? 0, person: ent.person ?? 0,
        org: ent.org ?? 0, event: ent.event ?? 0,
      },
      sources: byFolder.rows,
      signals: signals.rows,
      regions: regions.rows,
      topics: topics.rows,
      flow: flow.rows.reverse(),
      countriesList: countries.rows,
      recentDocuments: recentDocs.rows,
      entityList: entityList.rows,
    });
  } catch (err) {
    // اسکیما ساخته نشده یا پایگاه در دسترس نیست — UI باید بداند، نه اینکه صفر ببیند
    return NextResponse.json(
      { ready: false, error: String(err) },
      { status: 200 }
    );
  }
}
