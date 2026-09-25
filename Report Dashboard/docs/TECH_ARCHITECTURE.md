# TECH_ARCHITECTURE.md — زبان‌ها و معماری فنی محصول B

> **هدف این فایل:** انتخاب زبان و فریم‌ورک هر لایه، اجزای سیستم، جریان داده از Word تا داشبورد، جداول جدید، استقرار و تست.

**نسخه:** 0.1
**وضعیت:** **[پیشنهادی — نیازمند تأیید]**
**مبنا:** `docker-compose.yml`، `dashboard/`، `scripts/`، `DATA_MODEL.md`، `WORD_TEMPLATE_SPEC.md`

---

## ۱. اصل راهنما

> **هیچ فناوری جدیدی اضافه نمی‌شود.** محصول B روی همان زیرساختی سوار می‌شود که مغز دوم (محصول A) روی آن کار می‌کند.

زیرساخت موجود (`docker-compose.yml`): PostgreSQL 16 · Qdrant · Redis · n8n · Open WebUI — و Ollama به‌صورت بومی روی macOS برای شتاب GPU.

---

## ۲. زبان‌ها و فریم‌ورک‌ها

| لایه | زبان / فریم‌ورک | دلیل |
|---|---|---|
| داشبورد و API | **TypeScript** — Next.js 16 (App Router)، React 19، Tailwind 4، shadcn | اپ موجود `dashboard/`؛ ماژول B به‌صورت route group `/performance` با همان احراز هویت (`src/middleware.ts`) و کامپوننت‌های `components/ds` و `Gauge.tsx` |
| پردازش داده | **Python 3.12** — `lxml`، `pydantic`، `psycopg`، `jdatetime` | هم‌الگوی `scripts/*.py` (extract، synthesize) و `social-flow-analysis`؛ پارس XML سند Word و کار داده در Python بالغ‌تر است |
| پایگاه داده | **SQL — PostgreSQL 16** | DDL سه‌لایه آماده در `docs/data-model/ddl/`؛ فرمول امتیاز به‌صورت view/تابع SQL قطعی و قابل بازبینی |
| تولید Word/PDF | `python-docx` + `lxml`؛ LibreOffice headless برای PDF | پشتیبانی RTL و ساخت Content Control |
| هوش مصنوعی | Ollama محلی — `qwen3:8b` (استخراج/تحلیل)، مدل گفتگوی فعلی RAG؛ بردار با bge (`scripts/reindex_bge.py`) | محرمانگی: داده `restricted`/`confidential` از سازمان خارج نمی‌شود |

---

## ۳. اجزای سیستم

```
BPMS (بیرونی) ──Word + پیوست──► ورودی: آپلود در داشبورد │ پوشه inbox │ n8n (ایمیل/API در آینده)
                                     ↓
                      [perf-ingest]  پارس Content Control → landing.*
                                     ↓   صف کار: ops.job (SELECT … FOR UPDATE SKIP LOCKED)
                      [perf-quality] دروازه‌های کیفیت → validated.*  │  خطا → نامه برگشت برای BPMS
                                     ↓
                      [perf-etl]     validated → warehouse (star schema)
                                     ↓
             ┌───────────────────────┼──────────────────────────┐
   [perf-score]               [perf-ai]                    [perf-bridge]
   امتیاز قطعی ماهانه         Ollama + JSON Schema          روایت/موانع → محصول A
   SQL + Python               خلاصه، طبقه‌بندی، تناقض       (vault Obsidian + Qdrant)
             └───────────────────────┼──────────────────────────┘
                                     ↓
       Next.js  /api/perf/*  (فقط از schema warehouse می‌خواند)
                                     ↓
       صفحات L0–L5 داشبورد  │  [perf-report] گزارش ماهانه Word/PDF
```

| جزء | محل در مخزن | ورودی → خروجی |
|---|---|---|
| `perf-ingest` | `scripts/perf/ingest.py` | فایل `.docx` → `landing.raw_*` (طبق `WORD_TEMPLATE_SPEC.md` §۵) |
| `perf-quality` | `scripts/perf/quality.py` | `landing` → `validated` + فهرست خطا/هشدار |
| `perf-etl` | `scripts/perf/etl.py` | `validated` → `warehouse.fact_*` |
| `perf-score` | `scripts/perf/score.py` + `ddl/warehouse.sql` | `warehouse.fact_*` → `warehouse.fact_unit_score` (طبق `EVALUATION_MODEL.md`) |
| `perf-ai` | `scripts/perf/analyze.py` | روایت + موانع + اعداد → `warehouse.ai_insight` |
| `perf-bridge` | `scripts/perf/bridge.py` | روایت تأییدشده → vault محصول A → `sync_vault_to_qdrant.py` موجود |
| `perf-report` | `scripts/perf/report.py` | warehouse → گزارش ماهانه رئیس + نامه بازخورد هر واحد |
| `perf-template` | `scripts/perf/template.py` | قالب مادر + شاخص/پروژه واحد → قالب Word per-unit |
| API و UI | `dashboard/src/app/api/perf/*`، `dashboard/src/app/performance/*` | warehouse → صفحات L0–L5 |

---

## ۴. اجرا و زمان‌بندی

- **بدون سرویس دائمی جدید.** workerها اسکریپت Python هستند.
- **رویدادمحور:** آپلود Word در داشبورد → فایل ذخیره و یک ردیف در `ops.job` → اجرای ingest و quality (فراخوانی از API مثل الگوی فعلی آپلود).
- **دوره‌ای:** `scripts/monthly_pipeline.sh` هم‌الگوی `nightly_pipeline.sh` (cron):
  - روز ۱ ماه: تولید قالب‌های per-unit دوره جدید
  - روز ۵ ماه (مهلت ارسال): یادآوری به واحدهایی که گزارش نداده‌اند
  - روز ۱۰ ماه (بستن دوره): etl → score → analyze → bridge → report
  - تقویم کامل: `BPMS_INTEGRATION.md` §۵
- **n8n** (موجود) برای خواندن صندوق ایمیل/پوشه اشتراکی BPMS و در آینده webhook.

---

## ۵. قواعد AI در کد

1. خروجی مدل فقط از طریق **JSON Schema** (الگوی `dashboard/src/app/api/upload/route.ts`) — متن آزاد پارس نمی‌شود.
2. **هیچ ستون عددی یا امتیاز از AI پر نمی‌شود.** AI فقط در `warehouse.ai_insight` می‌نویسد.
3. هر insight دارای `model`، `prompt_version`، `source_tags` (tagهای Word منبع) و `confidence` است.
4. طبقه‌بندی موانع توسط AI فقط **پیشنهاد** است وقتی واحد `other` انتخاب کرده؛ کارشناس تأیید می‌کند.
5. پرامپت‌ها در `scripts/perf/prompts/` نسخه‌بندی می‌شوند؛ تغییر پرامپت = `prompt_version` جدید.

---

## ۶. جداول جدید (پیشنهادی)

| جدول | هدف | ستون‌های کلیدی |
|---|---|---|
| `ops.job` | صف کار | `job_id`، `kind`، `payload jsonb`، `status`، `attempts`، `locked_at` |
| `ops.template_version` | نسخه‌های فعال قالب | `template_version`، `valid_from_period`، `valid_to_period`، `tag_manifest jsonb` |
| `ops.file_registry` | جلوگیری از دریافت تکراری | `sha256`، `raw_submission_id`، `bpms_ref` |
| `warehouse.fact_unit_score` | کارنامه ماهانه | `unit_id`، `period_id`، `score_total`، اجزای پنج‌گانه، `formula_version`، `data_completeness` |
| `warehouse.ai_insight` | خروجی‌های AI | `unit_id`، `period_id`، `kind`، `content jsonb`، `model`، `prompt_version`، `source_tags` |
| `warehouse.score_appeal` | اعتراض واحد | `unit_id`، `period_id`، `reason`، `status`، `decided_by` |
| `ops.audit_log` | ردپای دسترسی و تغییر | `actor`، `action`، `object_ref`، `at` |

DDL این جداول پس از تأیید به `docs/data-model/ddl/` اضافه می‌شود (فایل جدید `ops.sql`).

---

## ۷. امنیت و دسترسی

| نقش | دسترسی |
|---|---|
| کارشناس واحد | فقط داده و کارنامه واحد خودش؛ ثبت اعتراض |
| مدیر کل / معاون | واحدهای زیرمجموعه (از `dim_unit.parent_unit_id`) |
| معاونت برنامه‌ریزی | همه واحدها؛ تأیید/رد گزارش؛ مدیریت قالب و وزن‌ها |
| دفتر رئیس | L0–L1 همه سازمان؛ گزارش ماهانه |

- RBAC در لایه API (`/api/perf/*`) اعمال می‌شود، نه فقط در UI.
- احراز هویت فعلی (کوکی HMAC در `middleware.ts`) برای پایلوت کافی است؛ پیش از گسترش سراسری → SSO/LDAP (فرض A-2).
- فایل‌های ورودی در ذخیره‌ساز محلی رمزگذاری‌شده؛ هیچ داده‌ای به مدل ابری ارسال نمی‌شود.

---

## ۸. تست

| چه چیزی | ابزار | روش |
|---|---|---|
| پارسر Word | `pytest` | مجموعه golden files: Word سالم، فیلد خالی، ارقام فارسی، tag ناشناخته، نسخه قدیمی، فایل بدون Content Control |
| دروازه کیفیت | `pytest` | یک تست برای هر قاعده REPORT_FORM_SPEC |
| فرمول امتیاز | `pytest` + SQL | داده ساختگی با امتیاز از پیش محاسبه‌شده دستی |
| AI | `docs/eval/` (الگوی موجود) | مجموعه برچسب‌خورده موانع و تناقض‌ها؛ دقت پیش از فعال‌سازی |
| داشبورد | `eslint` + `next build` + بررسی مرورگر | |
