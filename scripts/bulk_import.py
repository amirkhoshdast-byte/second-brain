"""
bulk_import.py — import دسته‌جمعی فایل‌های PDF / DOCX / TXT / HTML

اجرا:
    export $(grep -v '^#' dashboard/.env.local | xargs)
    python3 scripts/bulk_import.py --dir /path/to/articles/
    python3 scripts/bulk_import.py --dir /path/ --country پاکستان
    python3 scripts/bulk_import.py --dir /path/ --limit 20 --dry-run
"""
import argparse, hashlib, json, os, sys, time, urllib.request
from pathlib import Path
from typing import Optional

import psycopg2
import psycopg2.extras

OLLAMA = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
MODEL  = os.environ.get("EXTRACT_MODEL", "qwen3:8b")

SUPPORTED = {".pdf", ".docx", ".txt", ".html", ".htm", ".md"}

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


# ── استخراج متن ──────────────────────────────────────────────────────────────

def extract_text(path: Path) -> str:
    ext = path.suffix.lower()
    buf = path.read_bytes()

    if ext == ".pdf":
        try:
            import pdfminer.high_level as pml  # type: ignore
            import io
            return pml.extract_text(io.BytesIO(buf)) or ""
        except ImportError:
            pass
        try:
            import pypdf  # type: ignore
            import io
            r = pypdf.PdfReader(io.BytesIO(buf))
            return "\n".join(p.extract_text() or "" for p in r.pages)
        except ImportError:
            pass
        # fallback: pdf-parse via Node — نیازی نیست
        raise RuntimeError("برای PDF نیاز به pdfminer.six یا pypdf دارید:\n  pip install pdfminer.six")

    if ext == ".docx":
        try:
            import mammoth  # type: ignore
            import io
            return mammoth.extract_raw_text({"file": io.BytesIO(buf)}).value
        except ImportError:
            raise RuntimeError("برای DOCX نیاز به mammoth دارید:\n  pip install mammoth")

    # TXT / HTML / MD
    for enc in ("utf-8", "utf-16", "latin-1"):
        try:
            text = buf.decode(enc)
            # HTML: تگ‌ها را پاک می‌کنیم
            if ext in (".html", ".htm"):
                import re
                text = re.sub(r"<[^>]+>", " ", text)
                text = re.sub(r"&\w+;", " ", text)
            return text
        except UnicodeDecodeError:
            continue
    return buf.decode("utf-8", errors="replace")


# ── AI استخراج ───────────────────────────────────────────────────────────────

def llm_extract(text: str, meta: dict) -> Optional[dict]:
    sample = text[:3200]
    prompt = (
        "متن زیر یک سند سازمانی است. اطلاعات ساختاریافته را استخراج کن.\n\n"
        f"متن:\n{sample}\n\n"
        "- title: عنوان اصلی (حداکثر ۱۵ کلمه)\n"
        "- country: کشور اصلی که سند درباره آن است\n"
        "- region: منطقه جغرافیایی\n"
        "- report_date: تاریخ سند YYYY-MM-DD اگر در متن باشد\n"
        "- confidence: ۰ تا ۱\n"
        "- ai_summary: خلاصه دو جمله‌ای فارسی\n"
        "- entities: آرایه موجودیت‌های مهم (حداکثر ۲۰)\n"
    )
    if meta.get("country"):    prompt += f"کشور مشخص‌شده: {meta['country']}\n"
    if meta.get("topic"):      prompt += f"موضوع مشخص‌شده: {meta['topic']}\n"
    if meta.get("report_date"):prompt += f"تاریخ مشخص‌شده: {meta['report_date']}\n"
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
        print(f"    ⚠ AI: {e}", flush=True)
        return None


# ── ذخیره DB ─────────────────────────────────────────────────────────────────

def connect():
    return psycopg2.connect(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=os.environ.get("POSTGRES_PORT", "5432"),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"])


def save(cur, extracted: dict, text_hash: str, file_path: Path, source_dir: Path) -> dict:
    # dedup
    cur.execute("select id from intel.document where content_hash=%s", (text_hash,))
    row = cur.fetchone()
    if row:
        return {"docId": row[0], "duplicate": True}

    country = extracted.get("country")
    region  = extracted.get("region") or REGION.get(country or "", None)
    rel_path = f"bulk/{source_dir.name}/{file_path.name}"

    cur.execute("""
        insert into intel.document
          (path, title, country, region, folder, report_date, ai_summary,
           confidence, content_hash, model, source_name, doc_type)
        values (%s,%s,%s,%s,%s,%s::date,%s,%s,%s,%s,%s,'bulk')
        returning id
    """, [
        rel_path,
        str(extracted.get("title", file_path.stem))[:500],
        country, region,
        extracted.get("folder"),
        extracted.get("report_date") or None,
        str(extracted.get("ai_summary", ""))[:2000],
        float(extracted.get("confidence", 0.7)),
        text_hash, MODEL, "bulk-import",
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


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="import دسته‌جمعی فایل‌ها به پایگاه دانش")
    ap.add_argument("--dir",      required=True, help="پوشه‌ی حاوی فایل‌ها")
    ap.add_argument("--country",  help="کشور پیش‌فرض (در صورت عدم تشخیص AI)")
    ap.add_argument("--topic",    help="موضوع پیش‌فرض")
    ap.add_argument("--date",     help="تاریخ پیش‌فرض YYYY-MM-DD")
    ap.add_argument("--limit",    type=int, help="حداکثر تعداد فایل")
    ap.add_argument("--dry-run",  action="store_true", help="فقط فایل‌ها را شمارش کن")
    ap.add_argument("--recursive",action="store_true", default=True, help="جستجوی بازگشتی (پیش‌فرض: فعال)")
    args = ap.parse_args()

    source_dir = Path(args.dir)
    if not source_dir.exists():
        print(f"❌ پوشه یافت نشد: {source_dir}")
        return 1

    pattern = "**/*" if args.recursive else "*"
    files = [f for f in source_dir.glob(pattern)
             if f.is_file() and f.suffix.lower() in SUPPORTED]

    if args.limit:
        files = files[:args.limit]

    print(f"📂 {len(files)} فایل یافت شد در {source_dir}")
    if args.dry_run:
        for f in files:
            print(f"  {f.relative_to(source_dir)}")
        return 0

    conn = connect()
    conn.autocommit = True
    cur = conn.cursor()

    meta = {
        "country": args.country,
        "topic": args.topic,
        "report_date": args.date,
    }

    ok = skipped = failed = duplicate = 0
    t0 = time.time()

    for i, f in enumerate(files, 1):
        print(f"\n[{i}/{len(files)}] {f.name}", flush=True)
        try:
            text = extract_text(f)
            if len(text.strip()) < 50:
                print("  ⏭ متن کافی نیست")
                skipped += 1
                continue

            h = hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()
            print(f"  🤖 AI استخراج…", flush=True)
            extracted = llm_extract(text, meta)
            if extracted is None:
                failed += 1
                continue

            result = save(cur, extracted, h, f, source_dir)
            if result["duplicate"]:
                print(f"  ♻ تکراری — رد شد")
                duplicate += 1
            else:
                ec = result.get("entityCount", 0)
                print(f"  ✓ ثبت شد (id={result['docId']}, {ec} موجودیت)")
                ok += 1

        except Exception as e:
            print(f"  ❌ خطا: {e}", flush=True)
            failed += 1

        elapsed = time.time() - t0
        if i % 5 == 0:
            print(f"\n  ── پیشرفت: {ok}✓ {duplicate}♻ {failed}✗ {elapsed/60:.1f}m ──\n", flush=True)

    print(f"\n{'='*50}")
    print(f"پایان: {ok} ثبت · {duplicate} تکراری · {skipped} رد · {failed} خطا")
    print(f"زمان: {(time.time()-t0)/60:.1f} دقیقه")
    cur.execute("select count(*) from intel.document")
    print(f"کل اسناد در پایگاه: {cur.fetchone()[0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
