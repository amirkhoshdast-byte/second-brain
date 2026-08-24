# SETUP.md — راه‌اندازی محیط توسعه محلی

> **هدف:** راه‌اندازی کامل پلتفرم هوش سازمانی روی macOS با Apple Silicon (M1/M2/M3).  
> **مبنا:** بخش ۳۱ سند محصول A و بخش ۶.۴ سند اجرایی `PLATFORM.md`.  
> **[پیشنهادی — نیازمند تأیید]**

---

## پیش‌نیازها

| ابزار | نسخه حداقل | نحوه نصب |
|---|---|---|
| macOS | Sequoia 15+ | — |
| Docker Desktop | 4.28+ | [docker.com/products/docker-desktop](https://docker.com) |
| Homebrew | هر نسخه | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` |
| Ollama | 0.3+ | [ollama.com](https://ollama.com) |
| Python | 3.11+ | `brew install python@3.11` |

---

## گام ۱ — کلون مخزن

```bash
git clone <url-repo> orgplatform
cd orgplatform
```

---

## گام ۲ — تنظیم متغیرهای محیطی

```bash
cp .env.example .env
```

فایل `.env` را باز کنید و **همه مقادیر `changeme-*`** را با رمزهای واقعی جایگزین کنید.  
این فایل را هرگز commit نکنید.

---

## گام ۳ — راه‌اندازی Ollama (Native — نه Docker)

Ollama باید روی macOS به‌صورت Native اجرا شود تا از GPU و ANE شتاب بگیرد:

```bash
# نصب (اگر نصب نشده)
brew install ollama

# اجرای سرویس
ollama serve
```

در یک ترمینال دیگر، مدل‌های لازم را دانلود کنید:

```bash
# مدل زبانی برای تست (روی ۱۸GB RAM)
ollama pull qwen3:8b

# مدل embedding BGE-M3
ollama pull bge-m3
# یا از طریق Python (توصیه‌شده برای benchmark):
pip install sentence-transformers
```

بررسی اجرا:
```bash
curl http://localhost:11434/api/tags
```

---

## گام ۴ — راه‌اندازی سرویس‌های Docker

```bash
docker compose up -d
```

بررسی وضعیت:
```bash
docker compose ps
```

همه سرویس‌ها باید `healthy` یا `running` باشند. اگر سرویسی `starting` ماند:
```bash
docker compose logs <service-name>
```

---

## گام ۵ — راه‌اندازی پایگاه داده

DDL سه‌لایه به‌صورت خودکار هنگام اولین اجرای PostgreSQL اجرا می‌شود (از طریق `docker-entrypoint-initdb.d`).

بررسی:
```bash
docker exec -it orgplatform-postgres psql -U orgplatform -c "\dn"
```

باید سه schema را ببینید: `landing`, `validated`, `warehouse`.

اگر Schema وجود نداشت، دستی اجرا کنید:
```bash
docker exec -i orgplatform-postgres psql -U orgplatform -d orgplatform \
  < docs/data-model/ddl/landing.sql

docker exec -i orgplatform-postgres psql -U orgplatform -d orgplatform \
  < docs/data-model/ddl/validated.sql

docker exec -i orgplatform-postgres psql -U orgplatform -d orgplatform \
  < docs/data-model/ddl/warehouse.sql
```

---

## گام ۶ — تست Qdrant

```bash
# بررسی سلامت
curl http://localhost:6333/readyz

# ایجاد Collection اولیه برای محصول A
curl -X PUT http://localhost:6333/collections/org_documents \
  -H "api-key: $(grep QDRANT_API_KEY .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": {
      "size": 1024,
      "distance": "Cosine"
    }
  }'
```

اندازه vector (`1024`) برای BGE-M3 است. برای jina-v3 عدد متفاوت است — مستندات مدل را بررسی کنید.

---

## گام ۷ — دسترسی به سرویس‌ها

| سرویس | آدرس | اعتبار |
|---|---|---|
| Open WebUI (رابط RAG) | http://localhost:3000 | طبق `.env` |
| n8n (Automation) | http://localhost:5678 | طبق `.env` |
| Qdrant Dashboard | http://localhost:6333/dashboard | API Key از `.env` |
| PostgreSQL | localhost:5432 | طبق `.env` |
| Redis | localhost:6379 | طبق `.env` |
| Ollama | http://localhost:11434 | بدون احراز هویت |

---

## گام ۸ — تست سریع Pipeline

### تست Ollama:
```bash
curl http://localhost:11434/api/generate \
  -d '{"model": "qwen3:8b", "prompt": "سلام، آیا فارسی می‌دانی؟", "stream": false}'
```

### تست Qdrant + Embedding (Python):
```python
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient

model = SentenceTransformer("BAAI/bge-m3")
client = QdrantClient("http://localhost:6333", api_key="<QDRANT_API_KEY>")

text = "دیپلماسی فرهنگی ترکیه در سال ۱۴۰۵"
vector = model.encode(text, normalize_embeddings=True).tolist()
print(f"Vector dim: {len(vector)}")  # باید ۱۰۲۴ باشد
```

---

## رفع مشکلات رایج

| مشکل | راه‌حل |
|---|---|
| Open WebUI به Ollama وصل نمی‌شود | مطمئن شوید `ollama serve` در حال اجراست؛ `host.docker.internal` روی Docker Desktop 4.28+ کار می‌کند |
| PostgreSQL DDL اجرا نشد | پوشه `docs/data-model/ddl/` را بررسی کنید — باید فقط `.sql` داشته باشد |
| Qdrant از حافظه خارج شد | حجم داده را کاهش دهید یا `QDRANT__STORAGE__MEMORY_LIMIT` را تنظیم کنید |
| n8n Secure Cookie Error | `N8N_HOST` باید `localhost` باشد نه IP |
| مدل embedding کند است | روی M3 Pro با BGE-M3 انتظار ~۲۰۰ms هر document داشته باشید — طبیعی است |

---

## کتابخانه تقویم شمسی (برای `dim_period`)

برای محاسبه دقیق مرز فصل‌های شمسی:

```bash
pip install jdatetime
```

```python
import jdatetime
from datetime import date

# تبدیل ابتدای ۱۴۰۵ به میلادی
start = jdatetime.date(1405, 1, 1).togregorian()
print(start)  # ۲۰۲۶-۰۳-۲۱
```

مقادیر seed در `warehouse.sql` را با خروجی این کد تأیید کنید.

---

## ساختار Obsidian Vault

Obsidian باید جداگانه روی macOS نصب شود. ساختار Vault:

```bash
mkdir -p ~/OrgBrain/{00_Inbox,01_Countries,02_Organizations,03_Persons}
mkdir -p ~/OrgBrain/{04_Topics,05_Religions,06_Events,07_Reports,08_Sources}
mkdir -p ~/OrgBrain/{09_Signals,10_Insights,11_Decisions,12_Actions}
mkdir -p ~/OrgBrain/{13_Projects,14_Meetings,15_Special-Cases,90_Templates,99_System}

# کپی الگوها به 90_Templates
cp docs/obsidian-templates/*.md ~/OrgBrain/90_Templates/
```

Obsidian را باز کنید و `~/OrgBrain` را به‌عنوان Vault انتخاب کنید.

---

## گام بعدی

پس از راه‌اندازی موفق، مرجع بعدی `docs/product-a-second-brain/INGESTION.md` است — Pipeline ورود اولین ۲۰ تا ۵۰ سند نمونه ترکیه به Qdrant و Obsidian.
