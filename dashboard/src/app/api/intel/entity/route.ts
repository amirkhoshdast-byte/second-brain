import { NextRequest, NextResponse } from "next/server";
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

function clamp(v: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, Math.round(v))); }
function toFa(n: number | string) {
  return String(n).replace(/[0-9]/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]);
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const type = req.nextUrl.searchParams.get("type") ?? "";

  try {
    const c = db();

    // ── سیگنال / روند / بینش ─────────────────────────────────────────────────
    if (id.startsWith("s_")) {
      const sid = id.slice(2);
      const [sig, ev] = await Promise.all([
        c.query(`select stype,title,description,country,topic,
                        confidence::float,direction,window_days,importance
                 from intel.signal where id=$1`, [sid]),
        c.query(`select count(*)::int n from intel.signal_evidence where signal_id=$1`, [sid]),
      ]);
      if (!sig.rows.length) return NextResponse.json({ ready: false });
      const s = sig.rows[0];
      const conf = Math.round((s.confidence ?? 0) * 100);
      const evN = ev.rows[0]?.n ?? 0;
      return NextResponse.json({
        ready: true,
        name: s.title,
        gaugeValue: conf,
        trend: s.direction === "up" ? "up" : s.direction === "down" ? "down" : "flat",
        confidence: conf,
        facetValues: [clamp(evN * 12), conf, s.direction === "up" ? 80 : s.direction === "down" ? 20 : 50],
        metrics: [
          [toFa(evN), "گزارش پشتیبان"],
          [s.country ?? "—", "کشور"],
          [s.topic ?? "—", "موضوع"],
          [s.direction === "up" ? "صعودی" : s.direction === "down" ? "نزولی" : "ثابت", "روند"],
          [s.window_days ? `${toFa(s.window_days)} روز` : "—", "پنجره زمانی"],
          [`${toFa(conf)}٪`, "اطمینان"],
        ],
        description: s.description,
      });
    }

    // ── کشور ─────────────────────────────────────────────────────────────────
    if (id.startsWith("c_") || type === "country") {
      const country = id.startsWith("c_") ? id.slice(2) : id;
      const [docs, ents, sigs, total] = await Promise.all([
        c.query(`select count(*)::int n, round(avg(confidence)::numeric,2)::float avgc
                 from intel.document where country=$1`, [country]),
        c.query(`select e.etype, count(distinct m.entity_id)::int n
                 from intel.mention m
                 join intel.entity e on e.id=m.entity_id
                 join intel.document d on d.id=m.document_id
                 where d.country=$1
                 group by e.etype`, [country]),
        c.query(`select count(*)::int n from intel.signal where country=$1`, [country]),
        c.query(`select count(*)::int n from intel.document`),
      ]);
      const docN = docs.rows[0]?.n ?? 0;
      const totalN = total.rows[0]?.n ?? 1;
      const conf = Math.round((docs.rows[0]?.avgc ?? 0) * 100);
      const byEtype = Object.fromEntries((ents.rows as Array<{etype:string;n:number}>).map(r => [r.etype, r.n]));
      const pct = clamp(docN / totalN * 100 * 4); // normalized presence
      return NextResponse.json({
        ready: true,
        name: country,
        gaugeValue: pct,
        trend: "flat" as const,
        confidence: conf,
        facetValues: [clamp(pct), clamp((byEtype.topic ?? 0) * 5), 0],
        metrics: [
          [toFa(docN), "گزارش"],
          [toFa(byEtype.topic ?? 0), "موضوع"],
          [toFa(byEtype.person ?? 0), "شخص"],
          [toFa(byEtype.org ?? 0), "سازمان"],
          [toFa(byEtype.event ?? 0), "رویداد"],
          [toFa(sigs.rows[0]?.n ?? 0), "سیگنال"],
        ],
      });
    }

    // ── موجودیت (topic / person / org / event) ────────────────────────────────
    if (id.startsWith("e_")) {
      const eid = id.slice(2);
      const [ent, mentions, coocs] = await Promise.all([
        c.query(`select name, etype from intel.entity where id=$1`, [eid]),
        c.query(`select count(distinct m.document_id)::int docs,
                        count(distinct d.country)::int countries,
                        round(avg(d.confidence)::numeric,2)::float avgc
                 from intel.mention m
                 join intel.document d on d.id=m.document_id
                 where m.entity_id=$1`, [eid]),
        c.query(`select count(*)::int n
                 from intel.mention m1
                 join intel.mention m2 on m1.document_id=m2.document_id
                 where m1.entity_id=$1 and m2.entity_id<>$1`, [eid]),
      ]);
      if (!ent.rows.length) return NextResponse.json({ ready: false });
      const e = ent.rows[0];
      const m = mentions.rows[0] ?? { docs: 0, countries: 0, avgc: 0 };
      const conf = Math.round((m.avgc ?? 0) * 100);
      const docN = m.docs ?? 0;
      const coN = coocs.rows[0]?.n ?? 0;
      const gaugeValue = clamp(docN * 3 + (m.countries ?? 0) * 8);
      const eType = (e.etype ?? type) as string;
      const metricLabels: Record<string, string[]> = {
        topic:  ["گزارش", "کشور", "شخص", "سازمان", "رویداد", "هم‌ذکری"],
        person: ["گزارش", "کشور", "سازمان", "رویداد", "موضوع", "هم‌ذکری"],
        org:    ["گزارش", "کشور", "شخص", "رویداد", "موضوع", "هم‌ذکری"],
        event:  ["گزارش", "کشور", "شخص", "سازمان", "موضوع", "هم‌ذکری"],
      };
      const labels = metricLabels[eType] ?? metricLabels.topic;
      return NextResponse.json({
        ready: true,
        name: e.name,
        gaugeValue,
        trend: docN > 5 ? "up" : "flat" as const,
        confidence: conf,
        facetValues: [clamp(docN * 4), clamp((m.countries ?? 0) * 15), clamp(coN / 2)],
        metrics: [
          [toFa(docN), labels[0]],
          [toFa(m.countries ?? 0), labels[1]],
          ["—", labels[2]],
          ["—", labels[3]],
          ["—", labels[4]],
          [toFa(coN), labels[5]],
        ],
      });
    }

    return NextResponse.json({ ready: false });
  } catch (err) {
    return NextResponse.json({ ready: false, error: String(err) });
  }
}
