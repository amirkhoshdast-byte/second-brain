"""
synthesize.py — مرحله‌ی دوم خط لوله: دانش ساخت‌یافته → هوش میان‌گزارشی.

تقسیم کار عمدی است: **الگو را SQL پیدا می‌کند، مدل فقط آن را می‌نویسد.**
اگر پیداکردن الگو به مدل سپرده شود، چیزی می‌سازد که در داده نیست. اینجا
هر سیگنال از یک شمارش واقعی می‌آید و اسناد پشتیبانش در signal_evidence
ثبت می‌شوند؛ سیگنال بدون شاهد اصلاً ساخته نمی‌شود.

اطمینان هم محاسبه می‌شود نه حدس: تابعی از تعداد شواهد مستقل.

اجرا:
    export $(grep -v '^#' dashboard/.env.local | xargs)
    python3 scripts/synthesize.py
"""
import json, os, sys, urllib.request
from datetime import date, timedelta

import psycopg2
import psycopg2.extras

OLLAMA = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
MODEL = os.environ.get("EXTRACT_MODEL", "qwen3:8b")

# آستانه‌ها — پایین‌تر از این، الگو آماری نیست و سیگنال ساخته نمی‌شود
# از محیط قابل تنظیم‌اند تا بشود خط لوله را روی داده‌ی کم راستی‌آزمایی کرد؛
# مقادیر پیش‌فرض برای پیکره‌ی کامل تنظیم شده‌اند.
MIN_TREND_DOCS = int(os.environ.get("MIN_TREND_DOCS", 4))
MIN_ACTOR_DOCS = int(os.environ.get("MIN_ACTOR_DOCS", 3))
MIN_SPREAD_COUNTRIES = int(os.environ.get("MIN_SPREAD_COUNTRIES", 3))

WRITE_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "description": {"type": "string"},
    },
    "required": ["title", "description"],
}


def connect():
    return psycopg2.connect(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=os.environ.get("POSTGRES_PORT", "5432"),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"])


def confidence_from(n_docs: int) -> float:
    """
    اطمینان از تعداد شواهد می‌آید، نه از حس مدل.
    چهار سند ≈ ۰.۷۴، ده سند ≈ ۰.۹۲، و هرگز به ۱ نمی‌رسد.
    """
    return round(min(0.95, 0.5 + 0.06 * n_docs), 3)


def write_up(kind: str, facts: str, evidence: list) -> dict:
    """
    مدل فقط الگوی از پیش یافته‌شده را عنوان و توضیح می‌دهد.

    عمداً از مدل خواسته نمی‌شود «الگو پیدا کن» — آن کار SQL است. اینجا فقط
    نگارش است، و متن شواهد جلوی چشمش گذاشته می‌شود تا از خودش نسازد.
    """
    body = (
        "در داده‌ی گزارش‌های سازمانی الگوی زیر شناسایی شده است.\n\n"
        f"واقعیت آماری:\n{facts}\n\n"
        "خلاصه‌ی اسناد پشتیبان:\n" + "\n".join(f"- {e}" for e in evidence[:6]) +
        "\n\nبر همین پایه بنویس:\n"
        "- title: عنوان کوتاه فارسی، حداکثر ۹ کلمه، که *محتوای* یافته را بگوید\n"
        "- description: دو جمله که بگوید چه چیزی مشاهده شده و چرا مهم است\n\n"
        "قواعد عنوان:\n"
        "- واژه‌های «سیگنال»، «روند»، «الگو»، «گزارش» را در عنوان نیاور.\n"
        "- عنوان باید موضوع و بازیگر مشخص را نام ببرد، نه دسته‌بندی را.\n\n"
        "فقط از آنچه بالا آمده استفاده کن. عدد یا ادعای تازه نساز. فقط JSON بده."
    )
    payload = {
        "model": MODEL, "stream": False, "format": WRITE_SCHEMA, "think": False,
        "options": {"temperature": 0.2, "num_predict": 600},
        "messages": [{"role": "user", "content": body}],
    }
    try:
        req = urllib.request.Request(
            f"{OLLAMA}/api/chat", data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(json.load(r)["message"]["content"])
    except Exception as exc:
        print(f"    ⚠ نگارش: {exc}", flush=True)
        return None


def norm_title(t: str) -> str:
    """
    کلید مقایسه‌ی عنوان.

    قید یکتایی پایگاه فقط تکرار دقیق را می‌گیرد؛ مدل اما «فیلم‌ساز» و
    «فیلم ساز» را جدا می‌نویسد. نیم‌فاصله و فاصله یکسان می‌شوند تا یک یافته
    دو ردیف نسازد.
    """
    t = t.replace("\u200c", " ")
    return " ".join(t.split()).strip(" .:،؛")


def save(cur, stype, title, desc, country, topic, importance, conf, direction,
         window_days, doc_ids):
    cur.execute("""
        insert into intel.signal
          (stype, title, description, country, topic, importance,
           confidence, direction, window_days)
        values (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        on conflict (stype, title) do update set
          description = excluded.description, confidence = excluded.confidence,
          importance = excluded.importance, direction = excluded.direction,
          created_at = now()
        returning id""",
        (stype, title[:300], desc, country, topic, importance, conf,
         direction, window_days))
    sid = cur.fetchone()[0]
    cur.execute("delete from intel.signal_evidence where signal_id=%s", (sid,))
    if doc_ids:
        psycopg2.extras.execute_values(
            cur, "insert into intel.signal_evidence (signal_id, document_id) values %s "
                 "on conflict do nothing",
            [(sid, d) for d in doc_ids])
    return sid


# ─── کاشف الگو: همه‌چیز از شمارش واقعی ────────────────────────────────────────
def find_trends(cur, days=180):
    """موضوع×کشور که در دوره‌ی اخیر نسبت به دوره‌ی قبل رشد یا افت کرده."""
    cur.execute("""
        with recent as (
          select d.country, e.name as topic, count(*) n, array_agg(d.id) ids
          from intel.document d
          join intel.mention m on m.document_id = d.id
          join intel.entity  e on e.id = m.entity_id and e.etype = 'topic'
          where d.country is not null
            and d.report_date >= current_date - %s::int
          group by 1,2
        ),
        prior as (
          select d.country, e.name as topic, count(*) n
          from intel.document d
          join intel.mention m on m.document_id = d.id
          join intel.entity  e on e.id = m.entity_id and e.etype = 'topic'
          where d.country is not null
            and d.report_date >= current_date - (%s::int * 2)
            and d.report_date <  current_date - %s::int
          group by 1,2
        )
        select r.country, r.topic, r.n, coalesce(p.n,0), r.ids
        from recent r left join prior p on p.country=r.country and p.topic=r.topic
        where r.n >= %s
        order by r.n desc limit 12
    """, (days, days, days, MIN_TREND_DOCS))
    return cur.fetchall()


def find_emerging_actors(cur):
    """سازمان یا شخصی که در چند سند مستقل تکرار شده — بازیگر نوظهور."""
    cur.execute("""
        select e.etype, e.name, count(distinct d.id) n,
               array_agg(distinct d.country) filter (where d.country is not null) cs,
               array_agg(d.id) ids
        from intel.entity e
        join intel.mention  m on m.entity_id = e.id
        join intel.document d on d.id = m.document_id
        where e.etype in ('org','person')
        group by 1,2
        having count(distinct d.id) >= %s
        order by n desc limit 10
    """, (MIN_ACTOR_DOCS,))
    return cur.fetchall()


def find_cross_country(cur):
    """موضوعی که هم‌زمان در چند کشور فعال است — الگوی فرامرزی."""
    cur.execute("""
        select e.name, count(distinct d.country) c, count(distinct d.id) n,
               array_agg(distinct d.country) cs, array_agg(d.id) ids
        from intel.entity e
        join intel.mention  m on m.entity_id = e.id
        join intel.document d on d.id = m.document_id
        where e.etype = 'topic' and d.country is not null
        group by 1
        having count(distinct d.country) >= %s
        order by c desc, n desc limit 8
    """, (MIN_SPREAD_COUNTRIES,))
    return cur.fetchall()


def summaries(cur, ids, k=6):
    cur.execute("""select ai_summary from intel.document
                   where id = any(%s) and ai_summary is not null limit %s""",
                (list(set(ids)), k))
    return [r[0] for r in cur.fetchall()]


def main():
    conn = connect(); conn.autocommit = True
    cur = conn.cursor()

    cur.execute("select count(*) from intel.document")
    n_docs = cur.fetchone()[0]
    print(f"پایه: {n_docs} سند استخراج‌شده\n", flush=True)
    if n_docs < 5:
        print("داده برای تحلیل میان‌گزارشی کافی نیست؛ اول extract.py را کامل کنید.")
        return 0

    made = 0
    seen_titles = set()

    # ── روندها ──
    print("روندها:", flush=True)
    for country, topic, n, prior, ids in find_trends(cur):
        direction = "up" if n > prior else "down" if n < prior else "flat"
        delta = n - prior
        facts = (f"موضوع «{topic}» در کشور {country}: {n} گزارش در دوره‌ی اخیر، "
                 f"{prior} گزارش در دوره‌ی پیشین (تغییر {delta:+d}).")
        w = write_up("روند", facts, summaries(cur, ids))
        if not w:
            continue
        key = norm_title(w["title"])
        if key in seen_titles:
            continue
        seen_titles.add(key)
        conf = confidence_from(n)
        save(cur, "trend", w["title"], w["description"], country, topic,
             "بالا" if n >= 8 else "متوسط", conf, direction, 180, ids)
        made += 1
        print(f"  ✓ {w['title'][:52]} · {country} · {n}↔{prior} · اطمینان {conf}", flush=True)

    # ── بازیگران نوظهور ──
    print("\nبازیگران نوظهور:", flush=True)
    for etype, name, n, countries, ids in find_emerging_actors(cur):
        kind = "سازمان" if etype == "org" else "شخص"
        cs = ", ".join([c for c in (countries or []) if c][:4]) or "چند کشور"
        facts = f"{kind} «{name}» در {n} گزارش مستقل ذکر شده است ({cs})."
        w = write_up("سیگنال بازیگر نوظهور", facts, summaries(cur, ids))
        if not w:
            continue
        key = norm_title(w["title"])
        if key in seen_titles:
            continue
        seen_titles.add(key)
        conf = confidence_from(n)
        save(cur, "signal", w["title"], w["description"],
             (countries or [None])[0], None,
             "بالا" if n >= 6 else "متوسط", conf, "up", None, ids)
        made += 1
        print(f"  ✓ {w['title'][:52]} · {n} سند · اطمینان {conf}", flush=True)

    # ── الگوی فرامرزی ──
    print("\nالگوهای فرامرزی:", flush=True)
    for topic, c, n, countries, ids in find_cross_country(cur):
        cs = ", ".join([x for x in (countries or []) if x][:6])
        facts = (f"موضوع «{topic}» در {c} کشور فعال است ({cs}) "
                 f"و مجموعاً {n} گزارش دارد.")
        w = write_up("الگوی فرامرزی", facts, summaries(cur, ids))
        if not w:
            continue
        key = norm_title(w["title"])
        if key in seen_titles:
            continue
        seen_titles.add(key)
        conf = confidence_from(n)
        save(cur, "insight", w["title"], w["description"], None, topic,
             "بالا" if c >= 5 else "متوسط", conf, "flat", None, ids)
        made += 1
        print(f"  ✓ {w['title'][:52]} · {c} کشور · اطمینان {conf}", flush=True)

    print(f"\nپایان. {made} استنتاج ثبت شد.", flush=True)
    cur.execute("select stype, count(*) from intel.signal group by 1 order by 2 desc")
    for st, k in cur.fetchall():
        print(f"  {st:12} {k}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
