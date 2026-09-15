#!/bin/bash
# خط لوله شبانه — هر شب ساعت ۲ بامداد
# ترتیب: extract → entity_resolve → synthesize → reindex_qdrant
#
# اجرای دستی:
#   bash scripts/nightly_pipeline.sh
# لاگ‌ها:
#   ~/Library/Logs/orgplatform/nightly_YYYYMMDD_HHMM.log

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$HOME/Library/Logs/orgplatform"
DATE=$(date +%Y%m%d_%H%M)
LOG="$LOG_DIR/nightly_${DATE}.log"

mkdir -p "$LOG_DIR"

# بارگذاری متغیرهای محیطی
ENV_FILE="$PROJECT_DIR/dashboard/.env.local"
if [ -f "$ENV_FILE" ]; then
  while IFS='=' read -r key val; do
    [[ "$key" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$key" ]] && continue
    export "$key"="$val"
  done < "$ENV_FILE"
fi

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

log "=============================="
log "خط لوله شبانه — $DATE"
log "=============================="

# ۱. استخراج اسناد جدید از Vault
log "[1/4] extract.py — اسناد جدید Vault..."
python3 "$SCRIPT_DIR/extract.py" 2>&1 | tee -a "$LOG"
log "[1/4] تمام شد."

# ۲. ادغام موجودیت‌های تکراری
log "[2/4] entity_resolve.py --apply..."
python3 "$SCRIPT_DIR/entity_resolve.py" --apply --threshold 0.95 2>&1 | tee -a "$LOG"
log "[2/4] تمام شد."

# ۳. سنتز سیگنال‌های هوشمند
log "[3/4] synthesize.py..."
python3 "$SCRIPT_DIR/synthesize.py" 2>&1 | tee -a "$LOG"
log "[3/4] تمام شد."

# ۴. reindex در Qdrant
log "[4/4] sync_vault_to_qdrant.py..."
python3 "$SCRIPT_DIR/sync_vault_to_qdrant.py" 2>&1 | tee -a "$LOG"
log "[4/4] تمام شد."

log "=============================="
log "خط لوله شبانه با موفقیت تمام شد."
log "لاگ: $LOG"
log "=============================="
