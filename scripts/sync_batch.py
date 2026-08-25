"""
sync_batch.py — sync N files at a time to avoid OOM kill
Usage:
  python3 sync_batch.py [start_idx] [count]
  python3 sync_batch.py --country افغانستان --start 0 --count 2
"""
import os, argparse, hashlib, json, re, urllib.request
from pathlib import Path

VAULT      = Path(os.environ.get(
    "VAULT_PATH",
    "/Users/amirhossein/Documents/My Second Brain/Cultural Intelligence Hub"))
QDRANT     = os.environ.get("QDRANT_URL", "http://localhost:6333")
QKEY       = os.environ.get("QDRANT_API_KEY", "")
COLLECTION = "org_documents"
OLLAMA     = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
# bge-m3 (1.2 GB) is too large for this Mac when Docker/Qdrant are also active.
# nomic-embed-text is 274 MB and keeps the existing 1024-dimension collection compatible.
MODEL      = "nomic-embed-text"
VECTOR_SIZE = 768
CHUNK_SIZE = 500
OVERLAP    = 60
UPSERT_BATCH = 8  # Keep vectors/payloads bounded even for very long reports.

FOLDER_TYPE = {
    "01-Countries": "country", "02-Religions": "religion", "02-Topic": "topic",
    "03-Organizations": "organization", "04-Person": "person",
    "05-Reports": "report", "05-Social-Listening": "signal",
    "06-Meetings": "meeting", "07-Insights": "insight",
    "08-Project": "project", "09-Event": "event", "10-Agents": "agent",
    "Dashboards": "dashboard", "Knowledge Hub": "knowledge",
    "Raw_Web": "raw_web", "00-templates": None,
}


def api(url, method="GET", body=None, headers={}):
    h = {"Content-Type": "application/json", **headers}
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)


def embed(text):
    r = api(f"{OLLAMA}/api/embed", "POST", {"model": MODEL, "input": text})
    return r["embeddings"][0]


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


def countries_from_frontmatter(text):
    """Read only the YAML `countries` list; no full YAML dependency required."""
    if not text.startswith("---"):
        return []
    parts = text.split("---", 2)
    if len(parts) < 3:
        return []
    lines = parts[1].splitlines()
    values, reading = [], False
    for line in lines:
        if re.match(r"^countries:\s*$", line):
            reading = True
            continue
        if reading and re.match(r"^[A-Za-z_][\w-]*:\s*", line):
            break
        if reading:
            match = re.search(r"\[\[([^\]]+)\]\]", line)
            if match:
                values.append(match.group(1).strip())
    return values


def chunks(text):
    if len(text) <= CHUNK_SIZE:
        return [text] if text.strip() else []
    result, start = [], 0
    while start < len(text):
        c = text[start:start + CHUNK_SIZE]
        nl = c.rfind("\n")
        if nl > CHUNK_SIZE // 2:
            c = c[:nl]
        if c.strip():
            result.append(c.strip())
        # The final slice can be shorter than OVERLAP.  Always advance at
        # least one character, otherwise a long document loops forever.
        start += max(1, len(c) - OVERLAP)
    return [c for c in result if len(c) > 40]


def fid(path, idx):
    return int(hashlib.md5(f"{path}:{idx}".encode()).hexdigest()[:15], 16)


def qdrant(path, method="GET", body=None):
    return api(f"{QDRANT}{path}", method, body, {"api-key": QKEY})


def ensure_collection():
    """Keep the empty collection compatible with the selected embedding model."""
    try:
        info = qdrant(f"/collections/{COLLECTION}")
        result = info["result"]
        size = result["config"]["params"]["vectors"]["size"]
        points = result["points_count"]
        if size == VECTOR_SIZE:
            return
        if points:
            raise RuntimeError(
                f"Collection is {size}D with {points} points; refusing to replace populated data."
            )
        qdrant(f"/collections/{COLLECTION}", "DELETE")
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            raise
    qdrant(f"/collections/{COLLECTION}", "PUT", {
        "vectors": {"size": VECTOR_SIZE, "distance": "Cosine"}
    })
    print(f"✓ collection ready: {VECTOR_SIZE} dimensions")


def file_index():
    """فقط مسیر و metadata فایل‌ها را بخوان؛ متن فقط برای batch انتخابی بارگذاری می‌شود."""
    out = []
    for f in sorted(VAULT.rglob("*.md")):
        rel = f.relative_to(VAULT)
        folder = rel.parts[0] if rel.parts else ""
        dt = FOLDER_TYPE.get(folder)
        if dt is None:
            continue
        # Obsidian می‌تواند فولدرهایی با پسوند .md داشته باشد؛ فقط فایل واقعی معتبر است.
        if f.is_file() and f.stat().st_size:
            out.append({"file": f, "path": str(rel), "name": f.stem,
                        "folder": folder, "doc_type": dt})
    return out


def load_document(ref):
    """متن یک فایل را فقط هنگام پردازش همان batch بخوان."""
    try:
        text = ref["file"].read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        print(f"  ⚠ cannot read {ref['name']}: {exc}")
        return None

    meta, body = parse_fm(text)
    if not body.strip():
        return None
    return {**ref, "meta": meta, "body": body}


def main():
    parser = argparse.ArgumentParser(description="Memory-bounded vault sync")
    parser.add_argument("start_idx", nargs="?", type=int, default=0)
    parser.add_argument("count", nargs="?", type=int, default=5)
    parser.add_argument("--country", help="only notes whose YAML countries includes this name")
    parser.add_argument("--start", type=int, help="offset within the filtered country list")
    parser.add_argument("--count", dest="option_count", type=int, help="batch size")
    args = parser.parse_args()
    start_idx = args.start if args.start is not None else args.start_idx
    count = args.option_count if args.option_count is not None else args.count

    ensure_collection()

    files = file_index()
    if args.country:
        selected = []
        for ref in files:
            try:
                countries = countries_from_frontmatter(ref["file"].read_text(encoding="utf-8"))
            except (OSError, UnicodeDecodeError):
                continue
            if args.country in countries:
                selected.append(ref)
        files = selected
    batch_refs = files[start_idx:start_idx + count]

    scope = f" for country «{args.country}»" if args.country else ""
    print(f"Syncing files {start_idx}–{start_idx + len(batch_refs) - 1} of {len(files)} total{scope}")

    batch, done, errors = [], 0, 0
    for ref in batch_refs:
        f = load_document(ref)
        if f is None:
            continue
        clist = chunks(f["body"])
        print(f"  {f['name']} ({len(clist)} chunks)")
        for i, chunk in enumerate(clist):
            try:
                vec = embed(chunk)
            except Exception as e:
                print(f"    ⚠ chunk {i}: {e}")
                errors += 1
                continue

            suffix = f" [{i+1}]" if len(clist) > 1 else ""
            batch.append({
                "id": fid(f["path"], i),
                "vector": vec,
                "payload": {
                    "title": f["name"] + suffix,
                    "entity_type": f["doc_type"],
                    "entity_id": f["meta"].get("entity_id", ""),
                    "period_id": f["meta"].get("period_id", ""),
                    "classification": f["meta"].get("classification", "internal"),
                    "doc_type": f["doc_type"],
                    "folder": f["folder"],
                    "path": f["path"],
                    "chunk_idx": i,
                    "chunk_text": chunk,
                    "text_preview": chunk[:200],
                    "source": "obsidian_vault",
                },
            })
            done += 1

            if len(batch) >= UPSERT_BATCH:
                qdrant(f"/collections/{COLLECTION}/points?wait=true", "PUT", {"points": batch})
                print(f"    ✓ upserted {len(batch)} points")
                batch = []

        if batch:
            qdrant(f"/collections/{COLLECTION}/points?wait=true", "PUT", {"points": batch})
            print(f"    ✓ upserted {len(batch)} points")
            batch = []

    info = qdrant(f"/collections/{COLLECTION}")
    print(f"\nDone. Total in collection: {info['result']['points_count']}  errors: {errors}")
    if args.country:
        print(f"Next batch: python3 sync_batch.py --country '{args.country}' --start {start_idx + count} --count {count}")
    else:
        print(f"Next batch: python3 sync_batch.py {start_idx + count} {count}")


if __name__ == "__main__":
    main()
