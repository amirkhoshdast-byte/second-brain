# چارچوب ارزیابی بازیابی — Retrieval Evaluation Framework

> **هدف:** انتخاب مستند مدل embedding و reranker مناسب فارسی، از روی داده دامنه واقعی — نه لیدربورد عمومی.

**مبنا:** بخش ۶.۱ سند اجرایی `PLATFORM.md`

---

## فایل‌ها

| فایل | هدف |
|---|---|
| `golden-questions.csv` | مجموعه ۵۰ پرسش طلایی — ۲۰ تا پر شده، ۳۰ تا خالی برای تکمیل |
| `benchmark_embeddings.py` | اسکریپت بنچمارک BGE-M3 در برابر jina-v3 و یک مدل بومی فارسی |

## روش استفاده

```bash
# نصب وابستگی‌ها
pip install sentence-transformers qdrant-client pandas numpy scikit-learn

# اجرای بنچمارک
python benchmark_embeddings.py \
  --questions golden-questions.csv \
  --docs_dir /path/to/sample-docs \
  --qdrant_url http://localhost:6333 \
  --output results.json

# خروجی: Recall@1, Recall@5, MRR, nDCG@10 برای هر مدل
```

## تفسیر نتایج

- **Recall@5 ≥ 0.75** — حداقل قابل قبول برای محیط تولیدی
- **MRR ≥ 0.65** — سند درست در رتبه‌های بالا ظاهر می‌شود
- **نتیجه بنچمارک بر لیدربورد عمومی اولویت دارد** — روی داده دامنه خودتان بسنجید

## مدل‌های پیشنهادی برای آزمون (بخش ۶.۱ سند اجرایی)

| مدل | نقش | دلیل |
|---|---|---|
| `BAAI/bge-m3` | پایه — **توصیه‌شده** | چندزبانه، hybrid search (dense+sparse)، مجوز MIT |
| `jinaai/jina-embeddings-v3` | رقیب برای آزمون | بالاترین میانگین در FaMTEB |
| `Tooka-SBERT` یا `Hakim` | رقیب بومی فارسی | مدل اختصاصی فارسی |
| `BAAI/bge-reranker-v2-m3` | Reranker | بهبود دقت پس از بازیابی اولیه |
