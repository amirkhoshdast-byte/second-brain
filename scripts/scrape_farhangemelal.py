"""
scrape_farhangemelal.py — کرول سایت farhangemelal.icro.ir و import مقالات جدید

هر صفحه کشور را باز می‌کند، URLهای مقالات را جمع می‌کند، و از طریق
web_import.py به پایگاه دانش وارد می‌کند. مقالات تکراری خودکار رد می‌شوند.

اجرا:
    export $(grep -v '^#' dashboard/.env.local | xargs)
    python3 scripts/scrape_farhangemelal.py              # همه کشورها
    python3 scripts/scrape_farhangemelal.py --country پاکستان  # فقط یک کشور
    python3 scripts/scrape_farhangemelal.py --dry-run    # فقط URL جمع‌آوری، بدون import
    python3 scripts/scrape_farhangemelal.py --limit 20   # حداکثر ۲۰ مقاله جدید
"""
import argparse, hashlib, json, os, re, sys, time, urllib.request, urllib.parse
from typing import Optional

# ── کشورها و URLهای صفحه‌شان ───────────────────────────────────────────────
BASE = "https://farhangemelal.icro.ir"

COUNTRY_PAGES: list[tuple[str, str, str]] = [
    # (country_fa, region_fa, service_path)
    # شبه قاره
    ("پاکستان",         "شبه‌قاره",        "/service/subcontinent/Pakestan"),
    ("هند",             "شبه‌قاره",        "/service/subcontinent/india"),
    ("افغانستان",       "شبه‌قاره",        "/service/subcontinent/Afganestan"),
    ("بنگلادش",         "شبه‌قاره",        "/service/subcontinent/Bangeladesh"),
    ("سریلانکا",        "شبه‌قاره",        "/service/subcontinent/Serilanka"),
    # شرق آسیا
    ("چین",             "شرق آسیا",        "/service/East%20Asia/chin"),
    ("ژاپن",            "شرق آسیا",        "/service/East%20Asia/Japan"),
    ("اندونزی",         "جنوب شرق آسیا",  "/service/East%20Asia/Andoneziya"),
    ("تایلند",          "جنوب شرق آسیا",  "/service/East%20Asia/Tayland"),
    ("مالزی",           "جنوب شرق آسیا",  "/service/East%20Asia/Maleziya"),
    ("فیلیپین",         "جنوب شرق آسیا",  "/service/East%20Asia/Philipin"),
    # آسیای مرکزی و قفقاز
    ("ترکیه",           "غرب آسیا",        "/service/Central%20Asia/torky"),
    ("آذربایجان",       "آسیای مرکزی",    "/service/Central%20Asia/Azarbaijan"),
    ("ازبکستان",        "آسیای مرکزی",    "/service/Central%20Asia/ozbakestan"),
    ("ترکمنستان",       "آسیای مرکزی",    "/service/Central%20Asia/Torkman"),
    ("قزاقستان",        "آسیای مرکزی",    "/service/Central%20Asia/Ghazag"),
    ("قرقیزستان",       "آسیای مرکزی",    "/service/Central%20Asia/Gherghizestan"),
    ("ارمنستان",        "قفقاز",           "/service/Central%20Asia/ArmanestaN"),
    ("گرجستان",         "قفقاز",           "/service/Central%20Asia/Gorjestan"),
    # جهان عرب
    ("عراق",            "خاورمیانه",       "/service/Arabi/Iraq"),
    ("سوریه",           "خاورمیانه",       "/service/Arabi/Suria"),
    ("لبنان",           "خاورمیانه",       "/service/Arabi/Lobnan"),
    ("فلسطین",          "خاورمیانه",       "/service/Arabi/felestine"),
    ("مصر",             "آفریقای شمالی",  "/service/Arabi/Egypt"),
    ("تونس",            "آفریقای شمالی",  "/service/Arabi/Tones"),
    ("الجزایر",         "آفریقای شمالی",  "/service/Arabi/Aljazayer"),
    ("قطر",             "خلیج فارس",       "/service/Arabi/ghatar"),
    ("کویت",            "خلیج فارس",       "/service/Arabi/koveit"),
    ("عمان",            "خلیج فارس",       "/service/Arabi/oman"),
    # آفریقا
    ("نیجریه",          "آفریقا",          "/service/Africa/Nigeria"),
    ("کنیا",            "آفریقا",          "/service/Africa/Keniya"),
    ("اتیوپی",          "آفریقا",          "/service/Africa/Etupi"),
    ("غنا",             "آفریقا",          "/service/Africa/ghana"),
    ("سنگال",           "آفریقا",          "/service/Africa/Senegal"),
    ("تانزانیا",        "آفریقا",          "/service/Africa/Tanzania"),
    ("اوگاندا",         "آفریقا",          "/service/Africa/Oganda"),
    ("زیمبابوه",        "آفریقا",          "/service/Africa/zimbave"),
    ("آفریقای جنوبی",   "آفریقا",          "/service/Africa/South-Africa"),
    # اروپای شرقی
    ("روسیه",           "اروپای شرقی",    "/service/East-Eur/Rusha"),
    ("بوسنی",           "اروپای شرقی",    "/service/East-Eur/Bosny"),
    ("صربستان",         "اروپای شرقی",    "/service/East-Eur/Serbestan"),
    ("بلغارستان",       "اروپای شرقی",    "/service/East-Eur/Bolghrestan"),
    ("بلاروس",          "اروپای شرقی",    "/service/East-Eur/Blarus"),
    ("رومانی",          "اروپای شرقی",    "/service/East-Eur/romani"),
    # اروپای غربی
    ("آلمان",           "اروپای غربی",    "/service/West-USA/Germany"),
    ("فرانسه",          "اروپای غربی",    "/service/West-USA/France"),
    ("انگلیس",          "اروپای غربی",    "/service/West-USA/England"),
    ("ایتالیا",         "اروپای غربی",    "/service/West-USA/Itily"),
    ("اسپانیا",         "اروپای غربی",    "/service/West-USA/Espanish"),
    ("اتریش",           "اروپای غربی",    "/service/West-USA/Otrish"),
    ("سوئد",            "اروپای غربی",    "/service/West-USA/Soed"),
    ("یونان",           "اروپای غربی",    "/service/West-USA/Yonan"),
    # آمریکای لاتین
    ("برزیل",           "آمریکای لاتین",  "/service/amrika/Brazil"),
    ("ونزوئلا",         "آمریکای لاتین",  "/service/amrika/Venezuela"),
]


# ── crawl یک صفحه کشور ─────────────────────────────────────────────────────

def fetch_html(url: str) -> Optional[str]:
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (research bot; +farhangemelal-scraper)"}
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  ⚠ fetch {url}: {e}")
        return None


def get_article_urls(service_path: str) -> list[str]:
    """URLs مقالات را از صفحه کشور استخراج می‌کند."""
    html = fetch_html(BASE + service_path)
    if not html:
        return []
    # تمام لینک‌های /news/{id}/...
    ids_seen = set()
    urls = []
    for m in re.finditer(r'href=["\'](/news/(\d+)/[^"\']*)["\']', html):
        path, article_id = m.group(1), m.group(2)
        if article_id not in ids_seen:
            ids_seen.add(article_id)
            urls.append(BASE + path)
    return urls


# ── بررسی تکراری بودن در DB ────────────────────────────────────────────────

def get_known_urls(cur) -> set[str]:
    cur.execute("SELECT source_url FROM intel.document WHERE source_url LIKE '%farhangemelal%'")
    return {row[0] for row in cur.fetchall() if row[0]}


# ── import با web_import ───────────────────────────────────────────────────

def import_articles(urls_with_meta: list[tuple[str, dict]], delay: float, limit: Optional[int]):
    """ایمپورت مقالات با استفاده از منطق web_import."""
    sys.path.insert(0, str(__file__).rsplit("/", 1)[0])
    from web_import import connect, process_url  # type: ignore

    def fresh_cursor():
        conn = connect()
        conn.autocommit = True
        return conn, conn.cursor()

    conn, cur = fresh_cursor()

    # فیلتر URLهای از پیش موجود
    known = get_known_urls(cur)
    new_urls = [(u, m) for u, m in urls_with_meta if u not in known]

    print(f"\n📋 {len(urls_with_meta)} مقاله یافت شد، {len(new_urls)} جدید")

    if limit:
        new_urls = new_urls[:limit]
        print(f"   (محدود به {limit} مقاله)")

    ok = dup = fail = skip = 0
    t0 = time.time()

    for i, (url, meta) in enumerate(new_urls, 1):
        country = meta.get("country", "")
        print(f"\n[{i}/{len(new_urls)}] {country} | {url[:70]}", flush=True)
        # reconnect در صورت قطع اتصال
        try:
            cur.execute("SELECT 1")
        except Exception:
            print("  ↻ reconnect به DB…", flush=True)
            try:
                conn.close()
            except Exception:
                pass
            conn, cur = fresh_cursor()

        try:
            status = process_url(cur, url, meta)
        except Exception as e:
            print(f"  ❌ خطا: {e}", flush=True)
            try:
                conn.close()
            except Exception:
                pass
            conn, cur = fresh_cursor()
            status = "error"

        if   status == "ok":        ok   += 1
        elif status == "duplicate": dup  += 1; print("  ♻ تکراری")
        elif status == "too_short": skip += 1; print("  ⏭ متن کوتاه")
        else:                       fail += 1

        if i < len(new_urls):
            time.sleep(delay)

    print(f"\n{'='*55}")
    print(f"✅ {ok} ثبت · ♻ {dup} تکراری · ⏭ {skip} رد · ❌ {fail} خطا")
    print(f"⏱ {(time.time()-t0)/60:.1f} دقیقه")
    cur.execute("SELECT count(*) FROM intel.document")
    print(f"📦 کل اسناد در پایگاه: {cur.fetchone()[0]}")


# ── main ───────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="کرول farhangemelal.icro.ir و import مقالات جدید")
    ap.add_argument("--country",  help="فقط این کشور (نام فارسی، مثلاً: پاکستان)")
    ap.add_argument("--limit",    type=int, help="حداکثر تعداد مقاله جدید")
    ap.add_argument("--delay",    type=float, default=2.5, help="تأخیر بین درخواست‌ها (ثانیه)")
    ap.add_argument("--dry-run",  action="store_true", help="فقط URL جمع‌آوری کن، چیزی import نکن")
    args = ap.parse_args()

    # انتخاب کشورها
    pages = COUNTRY_PAGES
    if args.country:
        pages = [(c, r, p) for c, r, p in COUNTRY_PAGES if c == args.country]
        if not pages:
            print(f"❌ کشور '{args.country}' یافت نشد.")
            print("کشورهای موجود:", ", ".join(set(c for c, _, _ in COUNTRY_PAGES)))
            return 1

    # حذف مسیرهای تکراری (ترکیه دو بار ذکر شده)
    seen_paths = set()
    unique_pages = []
    for c, r, p in pages:
        if p not in seen_paths:
            seen_paths.add(p)
            unique_pages.append((c, r, p))

    print(f"🌐 کرول {len(unique_pages)} صفحه کشوری از farhangemelal.icro.ir\n")

    all_urls: list[tuple[str, dict]] = []
    seen_urls: set[str] = set()

    for country, region, path in unique_pages:
        print(f"  📂 {country} ({path})", end=" ", flush=True)
        article_urls = get_article_urls(path)
        new_count = 0
        for url in article_urls:
            if url not in seen_urls:
                seen_urls.add(url)
                all_urls.append((url, {"country": country, "region": region}))
                new_count += 1
        print(f"→ {new_count} مقاله")
        time.sleep(1)

    print(f"\n📊 جمع: {len(all_urls)} مقاله از {len(unique_pages)} کشور")

    if args.dry_run:
        print("\n--- dry-run: لیست URLها ---")
        for url, meta in all_urls[:20]:
            print(f"  {meta['country']:12s} | {url}")
        if len(all_urls) > 20:
            print(f"  ... و {len(all_urls)-20} مقاله دیگر")
        return 0

    import_articles(all_urls, delay=args.delay, limit=args.limit)
    return 0


if __name__ == "__main__":
    sys.exit(main())
