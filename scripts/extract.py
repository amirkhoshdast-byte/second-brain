"""
extract.py — خط لوله‌ی استخراج: گزارش خام → دانش ساخت‌یافته.

اصل راهنما: از مدل فقط چیزی خواسته می‌شود که واقعاً نیاز به قضاوت دارد.
کشور، موضوع، عنوان و منبع در frontmatter و بخش «## Source» به‌صورت تدوین‌شده
موجودند و با پارس دقیق برداشته می‌شوند — دوباره‌پرسیدنشان از مدل یعنی
جایگزین‌کردن داده‌ی درست با حدس. مدل فقط اشخاص، سازمان‌ها، رویدادها و خلاصه
را استخراج می‌کند که در پیکره وجود ندارند.

اجرا:
    export $(grep -v '^#' dashboard/.env.local | xargs)
    python3 scripts/extract.py                 # همه‌ی اسناد استخراج‌نشده
    python3 scripts/extract.py --limit 20      # فقط ۲۰ سند
    python3 scripts/extract.py --force         # استخراج دوباره‌ی همه

اسناد بدون تغییر رد می‌شوند (مقایسه‌ی content_hash)، پس اجرای دوباره امن است
و اگر پروسه نصفه قطع شد، از همان‌جا ادامه می‌دهد.
"""
import argparse, hashlib, json, os, re, sys, time, urllib.request
from datetime import date
from pathlib import Path
from typing import Optional, Tuple

import psycopg2
import psycopg2.extras

VAULT = Path(os.environ.get(
    "VAULT_PATH",
    "/Users/amirhossein/Documents/My Second Brain/Cultural Intelligence Hub"))
OLLAMA = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
MODEL = os.environ.get("EXTRACT_MODEL", "qwen3:8b")

# پوشه‌هایی که سند واقعی دارند؛ الگوها و داشبوردها استخراج نمی‌شوند
CONTENT_FOLDERS = {
    "05-Reports", "05-Social-Listening", "07-Insights",
    "06-Meetings", "09-Event", "Raw_Web",
}

# نگاشت کشور به منطقه — قطعی، نه حدس مدل
REGION = {
    "افغانستان": "شبه‌قاره", "پاکستان": "شبه‌قاره", "بنگلادش": "شبه‌قاره",
    "هند": "شبه‌قاره", "سریلانکا": "شبه‌قاره",
    "اندونزی": "جنوب شرق آسیا", "تایلند": "جنوب شرق آسیا",
    "مالزی": "جنوب شرق آسیا", "فیلیپین": "جنوب شرق آسیا",
    "چین": "شرق آسیا", "ژاپن": "شرق آسیا",
    "ترکیه": "غرب آسیا", "Turkey": "غرب آسیا",
    "تاجیکستان": "آسیای مرکزی", "ازبکستان": "آسیای مرکزی",
    "قزاقستان": "آسیای مرکزی", "قرقیزستان": "آسیای مرکزی",
    "ترکمنستان": "آسیای مرکزی",
}

# نام‌های هم‌معنا که باید یک موجودیت بمانند؛ وگرنه «Turkey» و «ترکیه» دو
# گره جدا می‌شوند و تحلیل میان‌گزارشی همان‌جا می‌شکند.
CANON = {
    "turkey": "ترکیه", "türkiye": "ترکیه", "turkiye": "ترکیه",
    "iran": "ایران", "afghanistan": "افغانستان", "pakistan": "پاکستان",
    "china": "چین", "japan": "ژاپن", "indonesia": "اندونزی",
    "thailand": "تایلند", "bangladesh": "بنگلادش", "india": "هند",
}


def canon(name: str) -> str:
    n = name.strip().strip('"').strip("'")
    return CANON.get(n.lower(), n)


def dedupe(names):
    """
    نسخه‌های نزدیک را یکی می‌کند.

    مدل گاهی یک رویداد را با دو عبارت برمی‌گرداند («Allies in Ankara» و
    «Allies in Ankara official event hub»). اگر یکی پیشوند دیگری باشد،
    کوتاه‌ترین نگه داشته می‌شود.
    """
    out = []
    for n in sorted({canon(x) for x in names}, key=len):
        low = n.lower()
        if any(low.startswith(o.lower()) or o.lower().startswith(low) for o in out):
            continue
        out.append(n)
    return out


# آنچه مدل باید برگرداند — هرچه محدودتر، خروجی پایدارتر
SCHEMA = {
    "type": "object",
    "properties": {
        "persons":  {"type": "array", "items": {"type": "string"}},
        "orgs":     {"type": "array", "items": {"type": "string"}},
        "events":   {"type": "array", "items": {"type": "string"}},
        "summary":  {"type": "string"},
        "confidence": {"type": "number"},
    },
    "required": ["persons", "orgs", "events", "summary", "confidence"],
}

PROMPT = """از متن گزارش زیر، این موارد را استخراج کن:

- persons: نام اشخاص حقیقی که در متن آمده‌اند (فقط نام‌های واقعی، نه عناوین عمومی)
- orgs: نام سازمان‌ها، نهادها، دانشگاه‌ها و وزارتخانه‌ها
- events: رویدادهای مشخص (نشست، جشنواره، توافق، سفر) با نام یا توصیف کوتاه
- summary: خلاصه‌ی دو جمله‌ای از محتوای گزارش، به فارسی
- confidence: عددی بین ۰ و ۱ که نشان دهد چقدر از استخراج خود مطمئنی

قواعد:
- اگر موردی در متن نیست، آرایه را خالی بگذار. چیزی از خودت نساز.
- نام‌ها را دقیقاً همان‌طور که در متن آمده بنویس.
- فقط JSON بده.

متن:
"""


# ─── پارس قطعی ────────────────────────────────────────────────────────────────
def parse_fm(text: str) -> dict:
    """YAML سبکِ Obsidian: کلید ساده و لیست تورفته با خط تیره."""
    if not text.startswith("---"):
        return {}
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}
    out, key = {}, None
    for line in parts[1].splitlines():
        if not line.strip():
            continue
        if re.match(r"^\S.*?:", line):
            k, _, v = line.partition(":")
            key = k.strip()
            v = v.strip().strip('"').strip("'")
            out[key] = v if v else []
        elif line.strip().startswith("-") and key is not None:
            item = line.strip().lstrip("-").strip().strip('"').strip("'")
            item = re.sub(r"^\[\[|\]\]$", "", item).strip()
            if isinstance(out.get(key), list) and item:
                out[key].append(item)
    return out


def parse_source(text: str) -> Tuple[Optional[str], Optional[str]]:
    """URL و ناشر از بخش «## Source»."""
    url = re.search(r"^\s*-\s*URL:\s*(\S+)", text, re.M)
    pub = re.search(r"^\s*-\s*Publisher:\s*(.+)$", text, re.M)
    return (url.group(1) if url else None,
            pub.group(1).strip() if pub else None)


def body_text(text: str) -> str:
    """بدنه بدون frontmatter و بدون بلوک منبع — همان چیزی که مدل باید بخواند."""
    if text.startswith("---"):
        parts = text.split("---", 2)
        text = parts[2] if len(parts) >= 3 else text
    # بلوک Source حذف می‌شود تا URL توجه مدل را نگیرد
    text = re.sub(r"##\s*Source.*?(?=\n##\s|\Z)", "", text, flags=re.S)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)     # تصاویر
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)      # پیوند ویکی
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def find_date(fm: dict, text: str, file: Optional[Path] = None) -> Optional[date]:
    """
    تاریخ گزارش.

    اکثر گزارش‌های پیکره در frontmatter تاریخ ندارند. برای تحلیل روند، تاریخِ
    ورود سند به Vault (mtime) جانشین معناداری است — پرسش «چه چیزی تازه وارد
    شده» با همان پاسخ داده می‌شود. اولویت همیشه با تاریخ صریح متن است.
    """
    for k in ("created", "published", "date"):
        v = fm.get(k)
        if isinstance(v, str) and re.match(r"^\d{4}-\d{2}-\d{2}", v):
            try:
                return date.fromisoformat(v[:10])
            except ValueError:
                pass
    m = re.search(r"(20\d{2})-(\d{2})-(\d{2})", text)
    if m:
        try:
            return date.fromisoformat(m.group(0))
        except ValueError:
            pass
    if file is not None:
        try:
            return date.fromtimestamp(file.stat().st_mtime)
        except OSError:
            pass
    return None


# ─── مدل ──────────────────────────────────────────────────────────────────────
def llm_extract(body: str, retries: int = 2) -> Optional[dict]:
    """
    فراخوانی مدل با خروجی ساخت‌یافته.

    think=False چون qwen3 وگرنه بودجه‌ی توکن را صرف بلوک تفکر می‌کند و
    محتوای خالی برمی‌گرداند — و بدون تفکر خروجی هم سریع‌تر است هم دقیق‌تر.
    """
    payload = {
        "model": MODEL, "stream": False, "format": SCHEMA, "think": False,
        "options": {"temperature": 0, "num_predict": 1200},
        "messages": [{"role": "user", "content": PROMPT + body[:6000]}],
    }
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(
                f"{OLLAMA}/api/chat", data=json.dumps(payload).encode(),
                headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=300) as r:
                content = json.load(r)["message"]["content"]
            data = json.loads(content)
            # اعتبارسنجی: بدون این، ساختار خراب بی‌صدا وارد پایگاه می‌شود
            for k in ("persons", "orgs", "events"):
                if not isinstance(data.get(k), list):
                    raise ValueError(f"{k} آرایه نیست")
                data[k] = [str(x).strip() for x in data[k] if str(x).strip()][:20]
            if not isinstance(data.get("summary"), str):
                raise ValueError("summary رشته نیست")
            conf = data.get("confidence")
            data["confidence"] = float(conf) if isinstance(conf, (int, float)) else 0.5
            return data
        except Exception as exc:
            if attempt == retries:
                print(f"    ⚠ مدل: {exc}", flush=True)
                return None
            time.sleep(1.5)
    return None


# ─── پایگاه داده ──────────────────────────────────────────────────────────────
def connect():
    return psycopg2.connect(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=os.environ.get("POSTGRES_PORT", "5432"),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"])


def entity_id(cur, etype: str, name: str) -> int:
    cur.execute("""
        insert into intel.entity (etype, name) values (%s, %s)
        on conflict (etype, name) do update set name = excluded.name
        returning id""", (etype, name))
    return cur.fetchone()[0]


def store(cur, rec: dict, ents: dict):
    cur.execute("""
        insert into intel.document
          (path, title, folder, content_hash, country, region, producer,
           report_date, doc_type, source_name, source_url, ai_summary,
           confidence, model, extracted_at)
        values (%(path)s, %(title)s, %(folder)s, %(content_hash)s, %(country)s,
                %(region)s, %(producer)s, %(report_date)s, %(doc_type)s,
                %(source_name)s, %(source_url)s, %(ai_summary)s,
                %(confidence)s, %(model)s, now())
        on conflict (path) do update set
          title = excluded.title, content_hash = excluded.content_hash,
          country = excluded.country, region = excluded.region,
          producer = excluded.producer, report_date = excluded.report_date,
          doc_type = excluded.doc_type, source_name = excluded.source_name,
          source_url = excluded.source_url, ai_summary = excluded.ai_summary,
          confidence = excluded.confidence, model = excluded.model,
          extracted_at = now()
        returning id""", rec)
    doc_id = cur.fetchone()[0]

    # اشاره‌های قبلی پاک می‌شوند تا استخراج دوباره، تکراری نسازد
    cur.execute("delete from intel.mention where document_id = %s", (doc_id,))
    rows = []
    for etype, names in ents.items():
        for n in names:
            rows.append((doc_id, entity_id(cur, etype, n)))
    if rows:
        psycopg2.extras.execute_values(
            cur,
            "insert into intel.mention (document_id, entity_id) values %s "
            "on conflict do nothing",
            rows)
    return doc_id


# ─── اجرا ─────────────────────────────────────────────────────────────────────
def iter_docs():
    for f in sorted(VAULT.rglob("*.md")):
        rel = f.relative_to(VAULT)
        folder = rel.parts[0] if rel.parts else ""
        if folder not in CONTENT_FOLDERS or not f.is_file() or not f.stat().st_size:
            continue
        yield f, str(rel), folder


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    conn = connect()
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("select path, content_hash from intel.document")
    seen = dict(cur.fetchall())

    todo = []
    for f, rel, folder in iter_docs():
        try:
            text = f.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        h = hashlib.sha256(text.encode()).hexdigest()[:32]
        if not args.force and seen.get(rel) == h:
            continue
        todo.append((f, rel, folder, text, h))

    if args.limit:
        todo = todo[:args.limit]

    print(f"{len(todo)} سند برای استخراج (مدل: {MODEL})", flush=True)
    ok = skipped = failed = 0
    t0 = time.time()

    for i, (f, rel, folder, text, h) in enumerate(todo, 1):
        fm = parse_fm(text)
        body = body_text(text)
        if len(body) < 120:
            skipped += 1
            continue

        countries = fm.get("countries") or ([fm["country"]] if isinstance(fm.get("country"), str) and fm.get("country") else [])
        countries = [c for c in countries if isinstance(c, str)]
        topics = [t for t in (fm.get("topics") or []) if isinstance(t, str)]
        countries = dedupe(countries)
        country = countries[0] if countries else None
        url, publisher = parse_source(text)

        got = llm_extract(body)
        if got is None:
            failed += 1
            continue

        rec = {
            "path": rel,
            "title": (fm.get("title") if isinstance(fm.get("title"), str) else None) or f.stem,
            "folder": folder,
            "content_hash": h,
            "country": country,
            "region": REGION.get(country) if country else None,
            "producer": publisher,
            "report_date": find_date(fm, text, f),
            "doc_type": fm.get("type") if isinstance(fm.get("type"), str) else "report",
            "source_name": publisher,
            "source_url": url,
            "ai_summary": got["summary"][:2000],
            "confidence": round(min(1.0, max(0.0, got["confidence"])), 3),
            "model": MODEL,
        }
        ents = {
            "country": countries,
            "topic":   dedupe(topics),
            "person":  dedupe(got["persons"]),
            "org":     dedupe(got["orgs"]),
            "event":   dedupe(got["events"]),
        }
        store(cur, rec, ents)
        ok += 1

        if i % 5 == 0 or i == len(todo):
            el = time.time() - t0
            print(f"  [{i}/{len(todo)}] {ok} ثبت · {failed} خطا · "
                  f"{el/max(1,i):.1f}s هر سند · {el/60:.1f}m", flush=True)

    print(f"\nپایان. ثبت‌شده {ok} · رد‌شده {skipped} · ناموفق {failed}", flush=True)
    cur.execute("select count(*) from intel.document"); print("کل اسناد:", cur.fetchone()[0])
    cur.execute("select etype, count(*) from intel.entity group by etype order by 2 desc")
    for et, n in cur.fetchall():
        print(f"  {et:8} {n}")


if __name__ == "__main__":
    sys.exit(main())
