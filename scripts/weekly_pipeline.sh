#!/bin/bash
# خط لوله هفتگی: scrape → synthesize → reindex
# اجرا: هر شنبه ساعت ۳ بامداد

set -e

# بارگذاری متغیرهای محیطی از .env.local
ENV_FILE="$(dirname "$SCRIPT_DIR")/dashboard/.env.local"
if [ -f "$ENV_FILE" ]; then
  export $(grep -E '^POSTGRES_' "$ENV_FILE" | xargs)
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="/tmp"
DATE=$(date +%Y%m%d_%H%M)

echo "=============================="
echo "خط لوله هفتگی — $DATE"
echo "=============================="

# ۱. scrape
echo "[1/3] شروع scrape..."
python3 "$SCRIPT_DIR/scrape_farhangemelal.py" > "$LOG_DIR/scrape_$DATE.log" 2>&1
echo "[1/3] scrape تمام شد. لاگ: $LOG_DIR/scrape_$DATE.log"
tail -3 "$LOG_DIR/scrape_$DATE.log"

# ۲. synthesize
echo "[2/3] شروع synthesize..."
python3 "$SCRIPT_DIR/synthesize.py" > "$LOG_DIR/synthesize_$DATE.log" 2>&1
echo "[2/3] synthesize تمام شد."
tail -3 "$LOG_DIR/synthesize_$DATE.log"

# ۳. reindex
echo "[3/3] شروع reindex..."
python3 "$SCRIPT_DIR/reindex_bge.py" > "$LOG_DIR/reindex_$DATE.log" 2>&1
echo "[3/3] reindex تمام شد."
tail -3 "$LOG_DIR/reindex_$DATE.log"

echo "=============================="
echo "خط لوله هفتگی با موفقیت تمام شد — $(date)"
echo "=============================="
