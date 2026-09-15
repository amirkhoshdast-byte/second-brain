#!/usr/bin/env python3
"""
entity_resolve.py — ادغام موجودیت‌های تکراری/مشابه

الگوریتم بهینه:
  ۱. موجودیت‌ها را بر اساس token اول گروه‌بندی کن (blocking)
  ۲. فقط داخل هر گروه مقایسه انجام بده
  ۳. اگر شباهت ≥ EXACT_THRESHOLD بود → اتوماتیک ادغام
  ۴. اگر ≥ REVIEW_THRESHOLD بود → گزارش برای بررسی دستی

استفاده:
  python3 scripts/entity_resolve.py              # dry-run
  python3 scripts/entity_resolve.py --apply      # اعمال ادغام‌های اتوماتیک
  python3 scripts/entity_resolve.py --threshold 0.85 --apply
"""

import os, sys, argparse, difflib
from collections import defaultdict
import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    "host":     os.getenv("POSTGRES_HOST", "localhost"),
    "port":     int(os.getenv("POSTGRES_PORT", "5434")),
    "dbname":   os.getenv("POSTGRES_DB",   "orgplatform"),
    "user":     os.getenv("POSTGRES_USER", "orgplatform"),
    "password": os.getenv("POSTGRES_PASSWORD",
                          "2bcbbb5a042c08f17e2e5edb35c8aefa973d3eef861b77f9"),
}

EXACT_THRESHOLD  = 0.95
REVIEW_THRESHOLD = 0.70


def normalize(name: str) -> str:
    name = name.strip().lower()
    name = name.replace("ك", "ک").replace("ي", "ی")
    name = name.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    name = " ".join(name.split())
    return name


def similarity(a: str, b: str) -> float:
    na, nb = normalize(a), normalize(b)
    if na == nb:
        return 1.0
    # یکی substring دیگری — فقط اگر نام کوتاه‌تر ≥ 5 کاراکتر
    shorter, longer = (na, nb) if len(na) <= len(nb) else (nb, na)
    if len(shorter) >= 5 and shorter in longer:
        ratio = len(shorter) / len(longer)
        return 0.85 + 0.15 * ratio
    # فقط اگر طول‌ها خیلی متفاوت نیستند
    if len(longer) > 2.5 * len(shorter) + 4:
        return 0.0
    return difflib.SequenceMatcher(None, na, nb).ratio()


def blocking_key(name: str) -> str:
    """کلید گروه‌بندی: دو کاراکتر اول نرمال‌شده"""
    n = normalize(name)
    tokens = n.split()
    return tokens[0][:3] if tokens else n[:3]


def find_candidates(entities, exact_thr, review_thr):
    # گروه‌بندی برای کاهش مقایسه‌ها
    blocks: dict[str, list] = defaultdict(list)
    for e in entities:
        blocks[blocking_key(e["name"])].append(e)

    seen = set()
    candidates = []
    for block in blocks.values():
        if len(block) < 2:
            continue
        n = len(block)
        for i in range(n):
            for j in range(i + 1, n):
                a, b = block[i], block[j]
                pair = (min(a["id"], b["id"]), max(a["id"], b["id"]))
                if pair in seen:
                    continue
                seen.add(pair)
                score = similarity(a["name"], b["name"])
                if score >= review_thr:
                    if a["mentions"] >= b["mentions"]:
                        canonical, duplicate = a, b
                    else:
                        canonical, duplicate = b, a
                    candidates.append({
                        "canonical": canonical,
                        "duplicate": duplicate,
                        "score": score,
                        "auto": score >= exact_thr,
                    })
    return sorted(candidates, key=lambda c: -c["score"])


def merge_entity(conn, canonical_id: int, duplicate_id: int):
    with conn.cursor() as cur:
        # انتقال mention‌هایی که conflict ایجاد نمی‌کنند
        cur.execute("""
            UPDATE intel.mention SET entity_id = %s
            WHERE entity_id = %s
              AND document_id NOT IN (
                SELECT document_id FROM intel.mention WHERE entity_id = %s
              )
        """, (canonical_id, duplicate_id, canonical_id))
        moved = cur.rowcount

        cur.execute("DELETE FROM intel.mention WHERE entity_id = %s", (duplicate_id,))
        dropped = cur.rowcount

        cur.execute("DELETE FROM intel.entity WHERE id = %s", (duplicate_id,))
    return moved, dropped


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true",
                        help="اعمال ادغام‌های اتوماتیک")
    parser.add_argument("--threshold", type=float, default=EXACT_THRESHOLD,
                        help=f"آستانه اتوماتیک (پیش‌فرض {EXACT_THRESHOLD})")
    parser.add_argument("--review-threshold", type=float, default=REVIEW_THRESHOLD,
                        help=f"آستانه بررسی دستی (پیش‌فرض {REVIEW_THRESHOLD})")
    args = parser.parse_args()

    exact_thr  = args.threshold
    review_thr = args.review_threshold

    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False

    print("در حال بارگذاری موجودیت‌ها از پایگاه داده…")
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT e.id, e.name, e.etype,
                   count(m.document_id)::int mentions
            FROM intel.entity e
            LEFT JOIN intel.mention m ON m.entity_id = e.id
            GROUP BY e.id, e.name, e.etype
            ORDER BY e.etype, mentions DESC
        """)
        rows = cur.fetchall()

    by_etype: dict[str, list] = defaultdict(list)
    for r in rows:
        by_etype[r["etype"]].append(dict(r))

    print(f"تعداد کل: {len(rows)} موجودیت در {len(by_etype)} نوع\n")

    total_auto   = 0
    total_review = 0
    merged_ids   = set()

    for etype, entities in sorted(by_etype.items()):
        candidates = find_candidates(entities, exact_thr, review_thr)
        if not candidates:
            continue

        print(f"\n{'─'*60}")
        print(f"  نوع: {etype}  ({len(entities)} موجودیت، {len(candidates)} کاندیدا)")
        print(f"{'─'*60}")

        for c in candidates:
            if c["duplicate"]["id"] in merged_ids or c["canonical"]["id"] in merged_ids:
                continue

            marker = "✅ اتوماتیک" if c["auto"] else "⚠️  بررسی"
            print(f"  {marker}  [{c['score']:.2f}]  "
                  f"{c['canonical']['name']!r} ← {c['duplicate']['name']!r}"
                  f"  (m={c['canonical']['mentions']} ← m={c['duplicate']['mentions']})")

            if c["auto"]:
                total_auto += 1
                if args.apply:
                    moved, dropped = merge_entity(conn, c["canonical"]["id"], c["duplicate"]["id"])
                    merged_ids.add(c["duplicate"]["id"])
                    print(f"       → ادغام: {moved} منتقل، {dropped} حذف")
            else:
                total_review += 1

    print(f"\n{'═'*60}")
    print(f"  کاندیدا اتوماتیک : {total_auto}")
    print(f"  نیاز به بررسی    : {total_review}")

    if args.apply:
        if total_auto > 0:
            conn.commit()
            print(f"  ✅ {total_auto} ادغام اعمال و commit شد.")
        else:
            print("  هیچ ادغامی انجام نشد.")
    else:
        print("  ℹ️  dry-run — برای اعمال: --apply")

    conn.close()


if __name__ == "__main__":
    main()
