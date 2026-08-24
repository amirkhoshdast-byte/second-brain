# DDL محصول B — سه‌لایه PostgreSQL

> **مبنا:** بخش ۴.۳ و ۴.۴ سند اجرایی `PLATFORM.md` — قاعده: `BPMS → Landing (خام) → Validated (پس از دروازه کیفیت) → Warehouse (مدل ابعادی)`.

**[پیشنهادی — نیازمند تأیید]**

## ترتیب اجرا

```bash
psql -U postgres -d orgplatform -f landing.sql
psql -U postgres -d orgplatform -f validated.sql
psql -U postgres -d orgplatform -f warehouse.sql
```

## فایل‌ها

| فایل | Schema | هدف |
|---|---|---|
| `landing.sql` | `landing` | داده خام از BPMS یا فرم موازی — append-only، بدون تغییر |
| `validated.sql` | `validated` | پس از دروازه‌های کیفیت و نرمال‌سازی شناسه‌ها |
| `warehouse.sql` | `warehouse` | مدل ستاره‌ای — مبنای داشبورد و AI — فقط رکوردهای approved |

## قواعد مهم

- هیچ سرویسی مستقیم از `landing` نمی‌خواند — فقط pipeline ingestion.
- تنها `warehouse` منبع مصرف داشبورد و AI است.
- `bridge_report_document` از روز اول باید وجود داشته باشد — اتصال محصول A و B به آن وابسته است.
- جداول `dim_*` قبل از جداول `fact_*` پر می‌شوند.
- `dim_period` با داده seed تقریبی برای ۱۴۰۵ آمده — تاریخ‌های دقیق با کتابخانه تقویم تأیید شوند.
