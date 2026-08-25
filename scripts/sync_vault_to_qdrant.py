"""
sync_vault_to_qdrant.py — فقط stdlib Python، بدون هیچ کتابخانه سنگینی
Ollama /api/embed  +  Qdrant REST API  =  بدون gRPC، بدون torch
"""

import os, hashlib, json, urllib.request, urllib.error
from pathlib import Path

VAULT      = Path(os.environ.get(
    "VAULT_PATH",
    "/Users/amirhossein/Documents/My Second Brain/Cultural Intelligence Hub"))
QDRANT     = os.environ.get("QDRANT_URL", "http://localhost:6333")
QKEY       = os.environ.get("QDRANT_API_KEY", "")
COLLECTION = "org_documents"
OLLAMA     = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
MODEL      = "bge-m3"
CHUNK_SIZE = 500
OVERLAP    = 60

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
        start += len(c) - OVERLAP
    return [c for c in result if len(c) > 40]


def fid(path, idx):
    return int(hashlib.md5(f"{path}:{idx}".encode()).hexdigest()[:15], 16)


def load_files():
    out = []
    for f in sorted(VAULT.rglob("*.md")):
        rel = f.relative_to(VAULT)
        folder = rel.parts[0] if rel.parts else ""
        dt = FOLDER_TYPE.get(folder)
        if dt is None:
            continue
        try:
            txt = f.read_text(encoding="utf-8")
        except:
            continue
        meta, body = parse_fm(txt)
        if body.strip():
            out.append({"path": str(rel), "name": f.stem, "folder": folder,
                        "doc_type": dt, "meta": meta, "body": body})
    return out


def qdrant(path, method="GET", body=None):
    return api(f"{QDRANT}{path}", method, body, {"api-key": QKEY})


def ensure_collection(dim):
    try:
        info = qdrant(f"/collections/{COLLECTION}")
        size = info["result"]["config"]["params"]["vectors"]["size"]
        if size != dim:
            qdrant(f"/collections/{COLLECTION}", "DELETE")
            raise Exception()
        print(f"✓ Collection موجود ({size}D, {info['result']['points_count']} points)")
    except:
        qdrant(f"/collections/{COLLECTION}", "PUT", {
            "vectors": {"size": dim, "distance": "Cosine"}
        })
        print(f"✓ Collection ایجاد شد ({dim}D)")


def main():
    print("=" * 50)
    print("Vault → Qdrant  (pure stdlib)")
    print("=" * 50)

    print("\n🔗 تست embedding...")
    test = embed("تست")
    dim = len(test)
    print(f"✓ ابعاد: {dim}")

    ensure_collection(dim)

    print("\n📖 خواندن Vault...")
    files = load_files()
    print(f"✓ {len(files)} فایل")

    batch, done, errors = [], 0, 0
    total = sum(len(chunks(f["body"])) for f in files)
    print(f"✓ تخمین chunks: {total}\n")

    for f in files:
        for i, chunk in enumerate(chunks(f["body"])):
            try:
                vec = embed(chunk)
            except Exception as e:
                print(f"  ⚠ [{f['name']}:{i}] {e}")
                errors += 1
                continue

            suffix = f" [{i+1}]" if len(chunks(f["body"])) > 1 else ""
            batch.append({
                "id": fid(f["path"], i),
                "vector": vec,
                "payload": {
                    "title": f["name"] + suffix,
                    "entity_type": f["doc_type"],
                    "entity_id": f["meta"].get("entity_id", ""),
                    "period_id":  f["meta"].get("period_id", ""),
                    "classification": f["meta"].get("classification", "internal"),
                    "doc_type": f["doc_type"],
                    "folder": f["folder"],
                    "path": f["path"],
                    "chunk_idx": i,
                    "text_preview": chunk[:200],
                    "source": "obsidian_vault",
                },
            })
            done += 1
            if done % 5 == 0:
                print(f"  {done}/{total}", flush=True)

            if len(batch) >= 10:
                qdrant(f"/collections/{COLLECTION}/points?wait=false", "PUT", {"points": batch})
                batch = []

    if batch:
        qdrant(f"/collections/{COLLECTION}/points?wait=false", "PUT", {"points": batch})

    info = qdrant(f"/collections/{COLLECTION}")
    print(f"\n✅ تمام! Points: {info['result']['points_count']}  خطا: {errors}")


if __name__ == "__main__":
    main()
