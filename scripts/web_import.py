"""
web_import.py — import مقاله از URL یا RSS feed به پایگاه دانش

نیازمندی‌ها:
    pip install trafilatura feedparser requests

اجرا:
    export $(grep -v '^#' dashboard/.env.local | xargs)

    # یک URL
    python3 scripts/web_import.py --url "https://example.com/article"

    # RSS feed (تمام مقالات جدید)
    python3 scripts/web_import.py --rss "https://example.com/feed.xml"

    # RSS با محدودیت و کشور پیش‌فرض
    python3 scripts/web_import.py --rss "https://example.com/feed.xml" \
        --country پاکستان --limit 10

    # لیست URLها از فایل (هر خط یک URL)
    python3 scripts/web_import.py --url-file urls.txt
"""
import argparse, hashlib, json, os, re, sys, time, urllib.request
from pathlib import Path
from typing import Optional
from datetime import datetime

import psycopg2
import psycopg2.extras

OLLAMA = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
MODEL  = os.environ.get("EXTRACT_MODEL", "qwen3:8b")

REGION = {
    "افغانستان": "شبه‌قاره", "پاکستان": "شبه‌قاره", "بنگلادش": "شبه‌قاره",
    "اندونزی": "جنوب شرق آسیا", "تایلند": "جنوب شرق آسیا",
    "چین": "شرق آسیا", "ژاپن": "شرق آسیا",
    "ترکیه": "غرب آسیا", "ایران": "غرب آسیا",
    "تاجیکستان": "آسیای مرکزی", "ازبکستان": "آسیای مرکزی",
}

SCHEMA = {
    "type": "object",
    "properties": {
        "title":      {"type": "string"},
        "country":    {"type": "string"},
        "region":     {"type": "string"},
        "report_date":{"type": "string"},
        "confidence": {"type": "number"},
        "ai_summary": {"type": "string"},
        "entities": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name":  {"type": "string"},
                    "etype": {"type": "string", "enum": ["person","org","event","topic"]},
                },
                "required": ["name","etype"],
            },
        },
    },
    "required": ["title","ai_summary","entities"],
}


# ── دریافت و استخراج متن از URL ──────────────────────────────────────────────

def fetch_url(url: str) -> Optional[tuple[str, str]]:
    """دریافت URL → (متن خالص, عنوان صفحه)"""
    try:
        import trafilatura  # type: ignore
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return None
        text = trafilatura.extract(
            downloaded,
            include_comments=False,
            include_tables=True,
            favor_precision=True,
        )
        # عنوان از متادیتا
        meta = trafilatura.extract_metadata(downloaded)
        title = meta.title if meta else None
        return (text or "", title or "")
    except ImportError:
        pass

    # fallback بدون trafilatura
    try:
        import urllib.request as ur
        req = ur.Request(url, headers={"User-Agent": "Mozilla/5.0 (research bot)"})
        with ur.urlopen(req, timeout=30) as r:
            html = r.read().decode("utf-8", errors="replace")
        text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.S)
        text = re.sub(r"<style[^>]*>.*?</style>",  "", text, flags=re.S)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"&\w+;",  " ", text)
        text = re.sub(r"\s{2,}", " ", text).strip()
        title_m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
        title = title_m.group(1).strip() if title_m else ""
        return (text[:8000], title)
    except Exception as e:
        print(f"  ❌ fetch error: {e}")
        return None


def fetch_rss(rss_url: str) -> list[dict]:
    """RSS → لیست آیتم‌ها با url و title"""
    try:
        import feedparser  # type: ignore
        feed = feedparser.parse(rss_url)
        return [
            {
                "url": e.get("link", ""),
                "title": e.get("title", ""),
                "published": e.get("published", ""),
            }
            for e in feed.entries
            if e.get("link")
        ]
    except ImportError:
        # fallback: parse RSS با regex
        req = urllib.request.Request(rss_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            xml = r.read().decode("utf-8", errors="replace")
        items = []
        for block in re.findall(r"<item>(.*?)</item>", xml, re.S):
            link = re.search(r"<link[^>]*>(.*?)</link>", block)
            title = re.search(r"<title[^>]*>(.*?)</title>", block)
            if link:
                items.append({
                    "url": link.group(1).strip(),
                    "title": title.group(1).strip() if title else "",
                    "published": "",
                })
        return items


# ── AI استخراج ───────────────────────────────────────────────────────────────

def llm_extract(text: str, meta: dict) -> Optional[dict]:
    sample = text[:3200]
    prompt = (
        "متن زیر یک مقاله یا خبر است. اطلاعات ساختاریافته را استخراج کن.\n\n"
        f"متن:\n{sample}\n\n"
        "- title: عنوان اصلی (حداکثر ۱۵ کلمه)\n"
        "- country: کشور اصلی\n"
        "- region: منطقه جغرافیایی\n"
        "- report_date: تاریخ انتشار YYYY-MM-DD\n"
        "- confidence: ۰ تا ۱\n"
        "- ai_summary: خلاصه دو جمله‌ای فارسی\n"
        "- entities: آرایه موجودیت‌های مهم (حداکثر ۲۰)\n"
    )
    if meta.get("country"):     prompt += f"کشور مشخص‌شده: {meta['country']}\n"
    if meta.get("topic"):       prompt += f"موضوع مشخص‌شده: {meta['topic']}\n"
    if meta.get("report_date"): prompt += f"تاریخ مشخص‌شده: {meta['report_date']}\n"
    prompt += "\nفقط JSON بده."

    payload = {
        "model": MODEL, "stream": False, "format": SCHEMA, "think": False,
        "options": {"temperature": 0.1, "num_predict": 1200},
        "messages": [{"role": "user", "content": prompt}],
    }
    try:
        req = urllib.request.Request(
            f"{OLLAMA}/api/chat", data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as r:
            content = json.load(r)["message"]["content"]
        data = json.loads(content)
        if meta.get("country"):     data["country"]     = meta["country"]
        if meta.get("topic"):       data["folder"]      = meta["topic"]
        if meta.get("report_date"): data["report_date"] = meta["report_date"]
        return data
    except Exception as e:
        print(f"  ⚠ AI: {e}", flush=True)
        return None


# ── ذخیره DB ─────────────────────────────────────────────────────────────────

def connect():
    return psycopg2.connect(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=os.environ.get("POSTGRES_PORT", "5432"),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"])


def save(cur, extracted: dict, text_hash: str, url: str) -> dict:
    cur.execute("select id from intel.document where content_hash=%s", (text_hash,))
    if cur.fetchone():
        return {"duplicate": True}

    # بررسی تکراری بودن URL
    cur.execute("select id from intel.document where source_url=%s", (url,))
    if cur.fetchone():
        return {"duplicate": True}

    country = extracted.get("country")
    region  = extracted.get("region") or REGION.get(country or "", None)
    slug = re.sub(r"[^\w\-]", "_", url.split("//")[-1])[:100]

    cur.execute("""
        insert into intel.document
          (path, title, country, region, folder, report_date, ai_summary,
           confidence, content_hash, model, source_name, source_url, doc_type)
        values (%s,%s,%s,%s,%s,%s::date,%s,%s,%s,%s,%s,%s,'web')
        returning id
    """, [
        f"web/{slug}",
        str(extracted.get("title", url))[:500],
        country, region,
        extracted.get("folder"),
        extracted.get("report_date") or None,
        str(extracted.get("ai_summary", ""))[:2000],
        float(extracted.get("confidence", 0.7)),
        text_hash, MODEL,
        re.sub(r"https?://([^/]+).*", r"\1", url),
        url,
    ])
    doc_id = cur.fetchone()[0]

    entities = extracted.get("entities") or []
    rows = []
    for e in entities:
        name = str(e.get("name", "")).strip()[:200]
        etype = e.get("etype", "org")
        if not name:
            continue
        cur.execute("""
            insert into intel.entity (etype, name) values (%s,%s)
            on conflict (etype, name) do update set name=excluded.name
            returning id
        """, (etype, name))
        rows.append((doc_id, cur.fetchone()[0]))

    if rows:
        psycopg2.extras.execute_values(
            cur,
            "insert into intel.mention (document_id, entity_id) values %s on conflict do nothing",
            rows)

    return {"docId": doc_id, "duplicate": False, "entityCount": len(rows)}


# ── پردازش یک URL ────────────────────────────────────────────────────────────

def process_url(cur, url: str, meta: dict) -> str:
    result = fetch_url(url)
    if result is None:
        return "fetch_failed"

    text, page_title = result
    if len(text.strip()) < 100:
        return "too_short"

    h = hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()

    # اگر عنوان صفحه داریم و کاربر عنوان نداده، به AI می‌دیم
    extract_meta = {**meta}
    if page_title and not extract_meta.get("title"):
        extract_meta["page_title"] = page_title

    extracted = llm_extract(text, extract_meta)
    if extracted is None:
        return "ai_failed"

    # اگر AI عنوان استخراج نکرد، از عنوان صفحه استفاده کن
    if not extracted.get("title") and page_title:
        extracted["title"] = page_title

    result = save(cur, extracted, h, url)
    if result.get("duplicate"):
        return "duplicate"

    ec = result.get("entityCount", 0)
    title = extracted.get("title", "—")
    print(f"  ✓ {title[:60]} ({ec} موجودیت)", flush=True)
    return "ok"


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="import مقاله از وب به پایگاه دانش")
    grp = ap.add_mutually_exclusive_group(required=True)
    grp.add_argument("--url",      help="URL مقاله")
    grp.add_argument("--rss",      help="URL فید RSS")
    grp.add_argument("--url-file", help="فایل حاوی لیست URLها (هر خط یک URL)")
    ap.add_argument("--country",   help="کشور پیش‌فرض")
    ap.add_argument("--topic",     help="موضوع پیش‌فرض")
    ap.add_argument("--date",      help="تاریخ پیش‌فرض YYYY-MM-DD")
    ap.add_argument("--limit",     type=int, help="حداکثر تعداد مقاله")
    ap.add_argument("--delay",     type=float, default=2.0,
                    help="تأخیر بین درخواست‌ها (ثانیه، پیش‌فرض: ۲)")
    args = ap.parse_args()

    meta = {
        "country": args.country,
        "topic":   args.topic,
        "report_date": args.date,
    }

    # ساخت لیست URL
    urls: list[str] = []
    if args.url:
        urls = [args.url]
    elif args.rss:
        print(f"📡 دریافت RSS: {args.rss}", flush=True)
        items = fetch_rss(args.rss)
        print(f"  {len(items)} مقاله در فید یافت شد")
        urls = [it["url"] for it in items]
    elif args.url_file:
        path = Path(args.url_file)
        urls = [l.strip() for l in path.read_text().splitlines() if l.strip() and not l.startswith("#")]
        print(f"📄 {len(urls)} URL از {path.name}")

    if args.limit:
        urls = urls[:args.limit]

    if not urls:
        print("هیچ URL‌ای برای پردازش یافت نشد.")
        return 1

    conn = connect()
    conn.autocommit = True
    cur = conn.cursor()

    ok = duplicate = failed = skipped = 0
    t0 = time.time()

    for i, url in enumerate(urls, 1):
        print(f"\n[{i}/{len(urls)}] {url[:80]}", flush=True)
        status = process_url(cur, url, meta)
        if   status == "ok":           ok += 1
        elif status == "duplicate":    duplicate += 1; print("  ♻ تکراری")
        elif status == "too_short":    skipped += 1;   print("  ⏭ متن کافی نیست")
        else:                          failed += 1

        if i < len(urls):
            time.sleep(args.delay)

    print(f"\n{'='*50}")
    print(f"پایان: {ok} ثبت · {duplicate} تکراری · {skipped} رد · {failed} خطا")
    print(f"زمان: {(time.time()-t0)/60:.1f} دقیقه")
    cur.execute("select count(*) from intel.document")
    print(f"کل اسناد در پایگاه: {cur.fetchone()[0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
