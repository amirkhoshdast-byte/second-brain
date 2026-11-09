# مغز دوم سازمانی — راهنمای کامل نصب و راه‌اندازی

> نسخه: فاز ۴ کامل | آخرین بروزرسانی: نوامبر ۲۰۲۶  
> مخزن: https://github.com/amirkhoshdast-byte/second-brain

---

## معماری سیستم

```
┌─────────────────────────────────────────────────────┐
│                   داشبورد Next.js                    │
│              http://localhost:4000                   │
└──────────┬──────────────┬───────────────────────────┘
           │              │
    ┌──────▼──────┐  ┌────▼──────────┐
    │ PostgreSQL  │  │    Qdrant      │
    │  port 5434  │  │  port 6333     │
    │ (اسناد/     │  │ (vector store) │
    │  موجودیت‌ها)│  └───────────────┘
    └─────────────┘
           │
    ┌──────▼──────┐
    │   Ollama    │
    │ port 11434  │
    │ (LLM/embed) │
    └─────────────┘
```

---

## پیش‌نیازها

| نرم‌افزار | نسخه | توضیح |
|-----------|------|-------|
| Docker Desktop | ۲۹+ | برای PostgreSQL و Qdrant |
| Node.js | ۲۶+ | برای داشبورد |
| Python | ۳.۹+ | برای pipeline‌ها |
| Ollama | آخرین | برای LLM و embedding |

---

## مرحله ۱ — کلون کردن مخزن

```bash
git clone https://github.com/amirkhoshdast-byte/second-brain.git
cd second-brain
```

---

## مرحله ۲ — راه‌اندازی Docker (PostgreSQL + Qdrant)

```bash
# کپی فایل محیطی
cp .env.example .env

# ویرایش .env و تنظیم رمزها
# POSTGRES_PASSWORD=...
# QDRANT_API_KEY=...
# APP_PASSWORD=...
# AUTH_SECRET=...

# راه‌اندازی سرویس‌ها
docker compose up -d postgres qdrant
```

**بررسی:**
```bash
docker compose ps
# باید postgres و qdrant در وضعیت healthy باشند
```

---

## مرحله ۳ — نصب Ollama و مدل‌ها

```bash
# نصب Ollama از ollama.com
# سپس:
ollama pull qwen3:8b        # مدل اصلی چت/استخراج
ollama pull bge-m3           # مدل embedding
```

**بررسی:**
```bash
ollama list
# باید qwen3:8b و bge-m3 نشان دهد
```

---

## مرحله ۴ — راه‌اندازی داشبورد

```bash
cd dashboard
npm install
npm run dev
# داشبورد روی http://localhost:4000 بالا می‌آید
```

**متغیرهای محیطی داشبورد** (`dashboard/.env.local`):
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5434
POSTGRES_DB=orgplatform
POSTGRES_USER=orgplatform
POSTGRES_PASSWORD=<رمز شما>

QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=<کلید شما>

EMBEDDING_MODEL=bge-m3
QDRANT_COLLECTION=org_documents_bge

APP_PASSWORD=<رمز ورود داشبورد>
AUTH_SECRET=<یک رشته تصادفی ۶۴ کاراکتری>
```

---

## مرحله ۵ — ساخت collection در Qdrant

```bash
cd scripts
python3 reindex_bge.py --init-only
# collection org_documents_bge با ابعاد ۱۰۲۴ ساخته می‌شود
```

---

## مرحله ۶ — ساختار Vault (پایگاه اسناد)

اسناد باید در این مسیر باشند:
```
/Users/<شما>/Documents/My Second Brain/Cultural Intelligence Hub/
├── 05-Reports/          ← گزارش‌های رسمی
├── 05-Social-Listening/ ← پایش اجتماعی
├── 06-Meetings/         ← صورتجلسه رایزنی‌ها
├── 07-Insights/         ← تحلیل‌ها
├── 09-Event/            ← رویدادها
└── Raw_Web/             ← محتوای وب
```

> فرمت فایل‌ها: **Markdown (.md)**  
> برای PDF/Word: از صفحه آپلود داشبورد یا اسکریپت `bulk_import.py` استفاده کنید

---

## مرحله ۷ — اجرای pipeline اولیه

```bash
cd /path/to/second-brain

# متغیرهای محیطی
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5434
export POSTGRES_DB=orgplatform
export POSTGRES_USER=orgplatform
export POSTGRES_PASSWORD=<رمز>
export QDRANT_URL=http://localhost:6333
export QDRANT_API_KEY=<کلید>
export VAULT_PATH="/Users/<شما>/Documents/My Second Brain/Cultural Intelligence Hub"

# pipeline کامل
bash scripts/nightly_pipeline.sh
```

**یا هر مرحله جداگانه:**
```bash
python3 scripts/extract.py          # استخراج متن + خلاصه AI
python3 scripts/entity_resolve.py   # ادغام موجودیت‌های تکراری
python3 scripts/synthesize.py       # تولید سیگنال‌ها
python3 scripts/reindex_bge.py      # ایندکس vector
```

---

## مرحله ۸ — زمان‌بندی خودکار (Cron)

```bash
# هر شنبه ساعت ۲ بامداد
crontab -e
# اضافه کنید:
0 2 * * 6 /path/to/second-brain/scripts/nightly_pipeline.sh >> ~/Library/Logs/orgplatform/cron.log 2>&1
```

---

## ویژگی‌های سیستم

| ویژگی | مسیر | توضیح |
|-------|------|-------|
| چت RAG | `/` → دستیار هوشمند | پرسش از پایگاه دانش |
| داشبورد بین‌الملل | `/` → داشبورد بین‌الملل | آمار و فیلتر کشور |
| گراف هوشمند | `/` → گراف هوشمند | شبکه موجودیت‌ها |
| پیش‌بینی روند | `/` → پیش‌بینی روند | سری زمانی ماهانه |
| پوشش دانش | `/` → پوشش دانش | نقشه coverage |
| گزارش PDF | دکمه در داشبورد بین‌الملل | صادرات PDF |
| اسناد مشابه | در modal سند | vector similarity |
| دستیار صوتی | دکمه 🎙️ در چت | ورودی صوتی |
| API خارجی | `/api/v1/...` | با API key |

---

## API خارجی

**ساخت API key (از داشبورد با login):**
```bash
curl -X POST http://localhost:4000/api/admin/apikeys \
  -H "Cookie: sb_session=<token>" \
  -H "Content-Type: application/json" \
  -d '{"label":"نام کلید"}'
```

**استفاده:**
```bash
# لیست اسناد
curl "http://localhost:4000/api/v1/documents?country=افغانستان&limit=10" \
  -H "Authorization: Bearer sb_<کلید>"

# جستجوی semantic
curl "http://localhost:4000/api/v1/search?q=حقوق+زنان" \
  -H "Authorization: Bearer sb_<کلید>"

# سیگنال‌ها
curl "http://localhost:4000/api/v1/signals?limit=20" \
  -H "Authorization: Bearer sb_<کلید>"

# موجودیت‌ها
curl "http://localhost:4000/api/v1/entities?type=person&min_count=5" \
  -H "Authorization: Bearer sb_<کلید>"
```

---

## عیب‌یابی

| خطا | علت | راه‌حل |
|-----|-----|--------|
| `ECONNREFUSED 5434` | PostgreSQL خاموش | `docker compose up -d postgres` |
| `ECONNREFUSED 6333` | Qdrant خاموش | `docker compose up -d qdrant` |
| `connection refused 11434` | Ollama خاموش | `ollama serve` |
| `service-not-allowed` در ویس | میکروفون بلاک | Chrome → 🔒 → Microphone → Allow |
| داشبورد روی `/login` می‌ماند | cookie منقضی | دوباره لاگین کنید |

---

## بکاپ دیتابیس

```bash
# بکاپ PostgreSQL
docker exec orgplatform-postgres pg_dump -U orgplatform orgplatform \
  > backup_$(date +%Y%m%d).sql

# بکاپ Qdrant (volume)
docker run --rm -v orgplatform_qdrant_data:/data \
  -v $(pwd):/backup alpine \
  tar czf /backup/qdrant_backup_$(date +%Y%m%d).tar.gz /data
```

---

## اطلاعات فنی

- **مدل LLM:** qwen3:8b (Ollama)
- **مدل Embedding:** bge-m3 (1024 dim)
- **Vector Collection:** org_documents_bge
- **DB Schema:** intel.document, intel.entity, intel.mention, intel.signal, intel.api_keys
- **Auth:** HMAC-SHA256 cookie (sb_session)
- **Framework:** Next.js 16 + TypeScript
