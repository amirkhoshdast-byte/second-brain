"""
benchmark_embeddings.py — بنچمارک مدل‌های Embedding روی مجموعه پرسش طلایی
=============================================================================
مبنا: بخش ۶.۱ سند اجرایی PLATFORM.md
هدف: مقایسه BGE-M3، jina-embeddings-v3، و یک مدل بومی فارسی روی داده دامنه واقعی

نصب:
    pip install sentence-transformers qdrant-client pandas numpy tqdm

استفاده:
    python benchmark_embeddings.py \\
        --questions docs/eval/golden-questions.csv \\
        --docs_dir /path/to/sample-documents \\
        --output docs/eval/results.json

خروجی:
    - Recall@1, Recall@5, Recall@10
    - MRR (Mean Reciprocal Rank)
    - nDCG@10 (Normalized Discounted Cumulative Gain)
    - زمان embedding و زمان بازیابی به‌ازای هر پرسش
    - جدول مقایسه نهایی
"""

import argparse
import json
import os
import time
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from tqdm import tqdm

# ------------------------------------------------------------------
# تنظیمات مدل‌ها
# ------------------------------------------------------------------

MODELS = {
    "bge-m3": {
        "model_name": "BAAI/bge-m3",
        "description": "چندزبانه، hybrid search، مجوز MIT — پایه توصیه‌شده",
        "use_hybrid": True,   # BGE-M3 از dense+sparse هر دو پشتیبانی می‌کند
    },
    "jina-v3": {
        "model_name": "jinaai/jina-embeddings-v3",
        "description": "بالاترین میانگین در FaMTEB — رقیب برای آزمون",
        "use_hybrid": False,
    },
    # برای مدل بومی فارسی، نام مدل را اینجا وارد کنید:
    "fa-native": {
        "model_name": "TBD",  # مثال: "HooshvareLab/bert-fa-zwnj-base"
        "description": "مدل بومی فارسی — نام دقیق TBD",
        "use_hybrid": False,
    },
}

# ------------------------------------------------------------------
# توابع کمکی
# ------------------------------------------------------------------

def load_documents(docs_dir: str) -> list[dict]:
    """
    بارگذاری اسناد نمونه از یک پوشه.
    هر فایل .txt یا .md یک سند است.
    """
    docs = []
    docs_path = Path(docs_dir)
    for i, filepath in enumerate(sorted(docs_path.rglob("*.md")) + sorted(docs_path.rglob("*.txt"))):
        try:
            text = filepath.read_text(encoding="utf-8")
            docs.append({
                "doc_id": filepath.stem,
                "filepath": str(filepath),
                "text": text[:4000],  # برش به ۴۰۰۰ کاراکتر برای Chunking ساده
                "filename": filepath.name,
            })
        except Exception as e:
            print(f"⚠ خطا در خواندن {filepath}: {e}")
    print(f"✓ {len(docs)} سند بارگذاری شد از {docs_dir}")
    return docs


def load_questions(questions_path: str) -> pd.DataFrame:
    """بارگذاری مجموعه پرسش طلایی — فقط ردیف‌های پر شده."""
    df = pd.read_csv(questions_path)
    df = df[df["question_fa"].notna() & ~df["question_fa"].str.startswith("[خالی")]
    print(f"✓ {len(df)} پرسش فعال بارگذاری شد")
    return df


def reciprocal_rank(ranked_doc_ids: list[str], relevant_doc_id: str) -> float:
    """محاسبه Reciprocal Rank برای یک پرسش."""
    for rank, doc_id in enumerate(ranked_doc_ids, start=1):
        if doc_id == relevant_doc_id:
            return 1.0 / rank
    return 0.0


def recall_at_k(ranked_doc_ids: list[str], relevant_doc_id: str, k: int) -> float:
    """محاسبه Recall@k برای یک پرسش."""
    return 1.0 if relevant_doc_id in ranked_doc_ids[:k] else 0.0


def ndcg_at_k(ranked_doc_ids: list[str], relevant_doc_id: str, k: int) -> float:
    """محاسبه nDCG@k ساده برای یک پرسش با یک سند مرتبط."""
    for rank, doc_id in enumerate(ranked_doc_ids[:k], start=1):
        if doc_id == relevant_doc_id:
            # DCG = 1/log2(rank+1)؛ IDCG = 1/log2(2) = 1
            return 1.0 / np.log2(rank + 1)
    return 0.0


# ------------------------------------------------------------------
# کلاس بنچمارک
# ------------------------------------------------------------------

class EmbeddingBenchmark:
    def __init__(self, model_key: str, model_config: dict):
        self.model_key = model_key
        self.model_config = model_config
        self.model = None
        self.doc_embeddings = None
        self.docs = None

    def load_model(self):
        """بارگذاری مدل embedding."""
        from sentence_transformers import SentenceTransformer

        model_name = self.model_config["model_name"]
        if model_name == "TBD":
            print(f"⏭ مدل {self.model_key} هنوز تعریف نشده — رد شد")
            return False

        print(f"\n📦 بارگذاری مدل: {model_name}")
        t0 = time.time()
        self.model = SentenceTransformer(model_name, trust_remote_code=True)
        print(f"   زمان بارگذاری: {time.time() - t0:.1f}s")
        return True

    def embed_documents(self, docs: list[dict]):
        """ایجاد embedding برای همه اسناد."""
        self.docs = docs
        texts = [d["text"] for d in docs]

        print(f"   Embedding {len(texts)} سند...")
        t0 = time.time()
        self.doc_embeddings = self.model.encode(
            texts,
            batch_size=32,
            show_progress_bar=True,
            normalize_embeddings=True,
        )
        elapsed = time.time() - t0
        print(f"   زمان embedding اسناد: {elapsed:.1f}s ({elapsed/len(texts)*1000:.0f}ms هر سند)")
        return elapsed

    def retrieve(self, query: str, top_k: int = 10) -> tuple[list[str], float]:
        """
        بازیابی top_k سند مرتبط برای یک پرسش.
        برمی‌گرداند: (لیست doc_id مرتب‌شده، زمان ms)
        """
        t0 = time.time()
        query_embedding = self.model.encode(
            query,
            normalize_embeddings=True,
        )
        # شباهت cosine (چون normalize شده، dot product کافی است)
        scores = self.doc_embeddings @ query_embedding
        top_indices = np.argsort(scores)[::-1][:top_k]
        ranked_ids = [self.docs[i]["doc_id"] for i in top_indices]
        elapsed_ms = (time.time() - t0) * 1000
        return ranked_ids, elapsed_ms

    def run_benchmark(self, questions_df: pd.DataFrame) -> dict:
        """اجرای کامل بنچمارک روی همه پرسش‌ها."""
        results = {
            "model_key": self.model_key,
            "model_name": self.model_config["model_name"],
            "description": self.model_config["description"],
            "per_question": [],
            "metrics": {},
        }

        rr_scores = []
        recall_1 = []
        recall_5 = []
        recall_10 = []
        ndcg_10 = []
        retrieval_times_ms = []

        for _, row in tqdm(questions_df.iterrows(), total=len(questions_df), desc=self.model_key):
            question = row["question_fa"]
            # expected_doc_id از ستون expected_entity استخراج می‌شود
            # در عمل باید به doc_id واقعی در مجموعه نگاشت شود — اینجا تقریبی است
            expected_id = str(row.get("expected_entity", "")).strip()

            if not expected_id or expected_id == "nan":
                continue

            ranked_ids, t_ms = self.retrieve(question, top_k=10)
            retrieval_times_ms.append(t_ms)

            rr = reciprocal_rank(ranked_ids, expected_id)
            r1 = recall_at_k(ranked_ids, expected_id, 1)
            r5 = recall_at_k(ranked_ids, expected_id, 5)
            r10 = recall_at_k(ranked_ids, expected_id, 10)
            ndcg = ndcg_at_k(ranked_ids, expected_id, 10)

            rr_scores.append(rr)
            recall_1.append(r1)
            recall_5.append(r5)
            recall_10.append(r10)
            ndcg_10.append(ndcg)

            results["per_question"].append({
                "question_id": row["id"],
                "category": row["category"],
                "rr": rr,
                "recall@1": r1,
                "recall@5": r5,
                "recall@10": r10,
                "ndcg@10": ndcg,
                "retrieval_ms": round(t_ms, 1),
                "ranked_top5": ranked_ids[:5],
            })

        if rr_scores:
            results["metrics"] = {
                "MRR": round(float(np.mean(rr_scores)), 4),
                "Recall@1": round(float(np.mean(recall_1)), 4),
                "Recall@5": round(float(np.mean(recall_5)), 4),
                "Recall@10": round(float(np.mean(recall_10)), 4),
                "nDCG@10": round(float(np.mean(ndcg_10)), 4),
                "avg_retrieval_ms": round(float(np.mean(retrieval_times_ms)), 1),
                "num_questions": len(rr_scores),
            }

        return results


# ------------------------------------------------------------------
# تابع اصلی
# ------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="بنچمارک مدل‌های Embedding")
    parser.add_argument("--questions", default="golden-questions.csv")
    parser.add_argument("--docs_dir", required=True, help="پوشه حاوی اسناد نمونه (.md یا .txt)")
    parser.add_argument("--output", default="results.json")
    parser.add_argument("--models", nargs="+", default=list(MODELS.keys()),
                        help="مدل‌هایی که باید آزمون شوند")
    parser.add_argument("--top_k", type=int, default=10)
    args = parser.parse_args()

    # بارگذاری داده
    questions_df = load_questions(args.questions)
    docs = load_documents(args.docs_dir)

    if not docs:
        print("❌ هیچ سندی پیدا نشد. پوشه docs_dir را بررسی کنید.")
        return

    all_results = []
    summary_rows = []

    for model_key in args.models:
        if model_key not in MODELS:
            print(f"⚠ مدل ناشناخته: {model_key}")
            continue

        bench = EmbeddingBenchmark(model_key, MODELS[model_key])
        if not bench.load_model():
            continue

        bench.embed_documents(docs)
        result = bench.run_benchmark(questions_df)
        all_results.append(result)

        if result["metrics"]:
            m = result["metrics"]
            summary_rows.append({
                "مدل": model_key,
                "MRR": m["MRR"],
                "Recall@1": m["Recall@1"],
                "Recall@5": m["Recall@5"],
                "Recall@10": m["Recall@10"],
                "nDCG@10": m["nDCG@10"],
                "زمان بازیابی (ms)": m["avg_retrieval_ms"],
                "تعداد پرسش": m["num_questions"],
            })

    # ذخیره نتایج کامل
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print(f"\n✓ نتایج کامل در {args.output} ذخیره شد")

    # جدول خلاصه
    if summary_rows:
        print("\n" + "=" * 70)
        print("جدول مقایسه مدل‌ها")
        print("=" * 70)
        df_summary = pd.DataFrame(summary_rows)
        print(df_summary.to_string(index=False))
        print("=" * 70)
        print("\nتفسیر: Recall@5 ≥ 0.75 و MRR ≥ 0.65 حداقل قابل قبول برای تولید")

        # ذخیره خلاصه
        summary_path = args.output.replace(".json", "_summary.csv")
        df_summary.to_csv(summary_path, index=False, encoding="utf-8-sig")
        print(f"✓ خلاصه در {summary_path} ذخیره شد")


if __name__ == "__main__":
    main()
