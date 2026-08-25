"""
reindex_bge.py — ایندکس مجدد کل Vault در یک کالکشن ۱۰۲۴ بعدی با bge-m3.

دلیل وجود: کالکشن org_documents با nomic-embed-text (۷۶۸ بعد) ساخته شده بود و
روی متن فارسی قدرت تفکیک نداشت — سند مرتبط و نامرتبط هر دو حدود ۰.۸۰ امتیاز
می‌گرفتند. bge-m3 چندزبانه است و همان جفت را با فاصله‌ی ۰.۲۴ جدا می‌کند.

منطق chunk و payload عیناً از sync_batch.py گرفته شده تا خروجی دو اسکریپت
قابل‌مقایسه بماند.

پیکربندی از محیط خوانده می‌شود تا کلید Qdrant وارد مخزن نشود:

    export $(grep -v '^#' dashboard/.env.local | xargs)
    python3 scripts/reindex_bge.py

ادامه پس از قطع شدن: python3 scripts/reindex_bge.py --from 120
"""
import os, hashlib, json, sys, time, urllib.request, urllib.error
from pathlib import Path

VAULT      = Path(os.environ.get(
    "VAULT_PATH",
    "/Users/amirhossein/Documents/My Second Brain/Cultural Intelligence Hub"))
QDRANT     = os.environ.get("QDRANT_URL", "http://localhost:6333")
QKEY       = os.environ.get("QDRANT_API_KEY", "")
COLLECTION = "org_documents_bge"
OLLAMA     = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
MODEL      = "bge-m3"
CHUNK_SIZE = 500
OVERLAP    = 60
UPSERT_EVERY = 24          # نقاط انباشته پیش از هر upsert؛ کوچک تا اگر پروسه
                           # قطع شد، کار کمتری از دست برود

FOLDER_TYPE = {
    "01-Countries": "country", "02-Religions": "religion", "02-Topic": "topic",
    "03-Organizations": "organization", "04-Person": "person",
    "05-Reports": "report", "05-Social-Listening": "signal",
    "06-Meetings": "meeting", "07-Insights": "insight",
    "08-Project": "project", "09-Event": "event", "10-Agents": "agent",
    "Dashboards": "dashboard", "Knowledge Hub": "knowledge",
    "Raw_Web": "raw_web", "00-templates": None,
}


def api(url, method="GET", body=None, headers=None):
    h = {"Content-Type": "application/json", **(headers or {})}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def embed(text):
    return api(f"{OLLAMA}/api/embed", "POST", {"model": MODEL, "input": text})["embeddings"][0]


def qdrant(path, method="GET", body=None):
    return api(f"{QDRANT}{path}", method, body, {"api-key": QKEY})


def ensure_collection():
    """کالکشن جدید را بدون دست‌زدن به کالکشن قبلی بساز یا اعتبارسنجی کن."""
    try:
        info = qdrant(f"/collections/{COLLECTION}")
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            raise
        qdrant(f"/collections/{COLLECTION}", "PUT", {
            "vectors": {"size": 1024, "distance": "Cosine"},
        })
        print(f"✓ کالکشن جدید «{COLLECTION}» ساخته شد (1024 بعد)", flush=True)
        return

    size = info["result"]["config"]["params"]["vectors"]["size"]
    if size != 1024:
        raise RuntimeError(
            f"کالکشن «{COLLECTION}» {size} بعدی است؛ برای جلوگیری از پاک‌شدن داده، متوقف شد."
        )
    print(f"✓ کالکشن «{COLLECTION}» آماده است ({size} بعد)", flush=True)


def parse_fm(text):
    meta, body = {}, text
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            body = parts[2].strip()
            for line in parts[1].strip().splitlines():
                if ":" in line:
                    k, _, v = line.partition(":")
                    meta[k.strip()] = v.strip()
    return meta, body


def chunks(text):
    if len(text) <= CHUNK_SIZE:
        return [text] if text.strip() else []
    out, start = [], 0
    while start < len(text):
        c = text[start:start + CHUNK_SIZE]
        nl = c.rfind("\n")
        if nl > CHUNK_SIZE // 2:
            c = c[:nl]
        if c.strip():
            out.append(c.strip())
        # قطعهٔ پایانی ممکن است کوتاه‌تر از OVERLAP باشد.
        start += max(1, len(c) - OVERLAP)
    return [c for c in out if len(c) > 40]


def fid(path, idx):
    return int(hashlib.md5(f"{path}:{idx}".encode()).hexdigest()[:15], 16)


def file_index():
    """فقط مسیرها را برمی‌گرداند؛ متن هنگام پردازش هر فایل خوانده می‌شود."""
    out = []
    for f in sorted(VAULT.rglob("*.md")):
        rel = f.relative_to(VAULT)
        folder = rel.parts[0] if rel.parts else ""
        dt = FOLDER_TYPE.get(folder)
        if dt is None:
            continue
        # Obsidian می‌تواند پوشه‌ای با پسوند .md داشته باشد؛ فقط فایل واقعی معتبر است.
        if f.is_file() and f.stat().st_size:
            out.append({"file": f, "path": str(rel), "name": f.stem,
                        "folder": folder, "doc_type": dt})
    return out


def flush(batch):
    if not batch:
        return
    qdrant(f"/collections/{COLLECTION}/points?wait=true", "PUT", {"points": batch})


def main():
    start_at = 0
    if "--from" in sys.argv:
        start_at = int(sys.argv[sys.argv.index("--from") + 1])
    # محیط اجرا پروسه‌های طولانی پایتون را با SIGKILL قطع می‌کند، بنابراین کار
    # به بخش‌های کوتاه تقسیم می‌شود و هر اجرا پیش از رسیدن به آن مرز تمام می‌شود.
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])

    ensure_collection()
    everything = file_index()
    files = everything[start_at:]
    if limit is not None:
        files = files[:limit]
    total = len(files)
    print(f"(فایل {start_at} تا {start_at + total} از {len(everything)})", flush=True)
    print(f"شروع ایندکس {total} فایل در «{COLLECTION}» با {MODEL}", flush=True)

    batch, done, errors, t0 = [], 0, 0, time.time()

    for n, ref in enumerate(files, 1):
        try:
            text = ref["file"].read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            print(f"  ⚠ خواندن نشد {ref['name']}: {exc}", flush=True)
            errors += 1
            continue

        meta, body = parse_fm(text)
        if not body.strip():
            continue

        clist = chunks(body)
        for i, chunk in enumerate(clist):
            try:
                vec = embed(chunk)
            except Exception as exc:
                print(f"  ⚠ chunk {i} از {ref['name']}: {exc}", flush=True)
                errors += 1
                continue

            suffix = f" [{i+1}]" if len(clist) > 1 else ""
            batch.append({
                "id": fid(ref["path"], i),
                "vector": vec,
                "payload": {
                    "title": ref["name"] + suffix,
                    "entity_type": ref["doc_type"],
                    "entity_id": meta.get("entity_id", ""),
                    "period_id": meta.get("period_id", ""),
                    "classification": meta.get("classification", "internal"),
                    "doc_type": ref["doc_type"],
                    "folder": ref["folder"],
                    "path": ref["path"],
                    "chunk_idx": i,
                    "chunk_text": chunk,
                    "text_preview": chunk[:200],
                    "source": "obsidian_vault",
                },
            })
            done += 1

            if len(batch) >= UPSERT_EVERY:
                flush(batch); batch = []

        if n % 10 == 0 or n == total:
            el = time.time() - t0
            rate = done / el if el else 0
            print(f"  [{n}/{total}] فایل · {done} chunk · {rate:.1f}/s · {el/60:.1f}m", flush=True)

    flush(batch)

    info = qdrant(f"/collections/{COLLECTION}")
    print(f"\nپایان. {done} chunk ایندکس شد · خطا: {errors}", flush=True)
    print(f"کل نقاط کالکشن: {info['result']['points_count']}", flush=True)


if __name__ == "__main__":
    main()
