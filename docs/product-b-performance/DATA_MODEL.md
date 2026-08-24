# DATA_MODEL.md — مدل داده محصول B

> **هدف این فایل:** نمودار ابعادی (Dimensions/Facts)، شرح جداول، ارجاع به DDL، و کوئری‌های نمونه دروازه‌های کیفیت.

**نسخه:** 1.0  
**وضعیت:** **[پیشنهادی — نیازمند تأیید]**  
**مبنا:** بخش ۴.۴ و ۴.۶ سند اجرایی `PLATFORM.md`  
**DDL کامل:** [`docs/data-model/ddl/`](../data-model/ddl/)

---

## ۱. معماری سه‌لایه

```
BPMS / فرم گزارش
         ↓
┌─────────────────────┐
│   landing schema    │  خام، بدون تغییر، append-only
└─────────────────────┘
         ↓ دروازه‌های کیفیت (بخش ۴)
┌─────────────────────┐
│  validated schema   │  پس از اعتبارسنجی — هنوز normalized نشده
└─────────────────────┘
         ↓ تبدیل به مدل ابعادی
┌─────────────────────┐
│  warehouse schema   │  مدل ستاره‌ای — مبنای داشبورد و AI
└─────────────────────┘
```

قاعده: هیچ سرویس یا داشبوردی مستقیم از `landing` نمی‌خواند. فقط `warehouse` منبع مصرف است.

---

## ۲. نمودار ابعادی (Star Schema)

```
                        fact_indicator_value
                        ┌─────────────────────┐
                        │ submission_id (FK)   │
                        │ indicator_id (FK) ───┼──► dim_indicator
                        │ unit_id (FK) ────────┼──► dim_unit
                        │ period_id (FK) ───────┼──► dim_period
                        │ program_id (FK) ──────┼──► dim_program
                        │ value_actual          │
                        │ value_target          │
                        │ unit_of_measure       │
                        │ data_source           │
                        │ note                  │
                        └─────────────────────┘

                        fact_project_status
                        ┌─────────────────────┐
                        │ submission_id (FK)   │
                        │ project_id (FK) ──────┼──► dim_project
                        │ unit_id (FK)          │
                        │ period_id (FK)        │
                        │ progress_pct          │
                        │ status                │
                        │ milestone_reached     │
                        │ next_milestone        │
                        │ projected_completion  │
                        └─────────────────────┘

                        fact_submission
                        ┌─────────────────────┐
                        │ submission_id (PK)   │
                        │ unit_id (FK)          │
                        │ period_id (FK)        │
                        │ submitted_by (FK) ────┼──► dim_person
                        │ submitted_at          │
                        │ is_amendment          │
                        │ amendment_ref         │
                        │ status                │
                        │ approved_by           │
                        │ approved_at           │
                        └─────────────────────┘

                        fact_obstacle
                        ┌─────────────────────┐
                        │ obstacle_id (PK)     │
                        │ submission_id (FK)   │
                        │ unit_id (FK)          │
                        │ period_id (FK)        │
                        │ category              │
                        │ severity              │
                        │ status                │
                        │ description           │
                        │ affected_indicator_id │
                        │ affected_project_id   │
                        │ proposed_action       │
                        └─────────────────────┘

                        bridge_report_document
                        ┌─────────────────────┐
                        │ submission_id (FK)   │──────────► fact_submission
                        │ document_id          │──────────► محصول A (Obsidian/Qdrant)
                        │ document_type        │
                        │ section              │  کدام بخش فرم (4=روایت, 5=پیوست)
                        └─────────────────────┘
```

---

## ۳. شرح ابعاد

### `dim_unit` — واحد سازمانی
کلید مشترک با Entity Registry هسته مشترک (`UNT-HQ-XXXX`).

| ستون | نوع | توضیح |
|---|---|---|
| `unit_id` | varchar(20) PK | شناسه یکتا طبق INTEGRATION_CONTRACT |
| `unit_name_fa` | varchar(200) | نام فارسی رسمی |
| `unit_name_en` | varchar(200) | نام انگلیسی |
| `unit_type` | varchar(50) | `headquarter` / `representation` / `bureau` |
| `parent_unit_id` | varchar(20) | ارجاع به خود جدول — برای سلسله‌مراتب |
| `country_code` | char(2) | ISO 3166-1 alpha-2 — نال برای واحدهای ستادی |
| `is_active` | boolean | آیا در دوره جاری موظف به گزارش است |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `dim_period` — دوره زمانی
| ستون | نوع | توضیح |
|---|---|---|
| `period_id` | varchar(10) PK | مثال: `1405-Q1` |
| `period_type` | varchar(10) | `annual` / `quarterly` / `monthly` |
| `year_shamsi` | smallint | سال شمسی |
| `quarter_num` | smallint | شماره فصل (۱–۴)؛ نال برای ماهانه/سالانه |
| `month_num` | smallint | شماره ماه (۱–۱۲)؛ نال برای فصلی/سالانه |
| `start_date` | date | اول دوره میلادی |
| `end_date` | date | آخر دوره میلادی |
| `deadline_submission` | date | مهلت ارسال گزارش این دوره |

### `dim_indicator` — تعریف شاخص
| ستون | نوع | توضیح |
|---|---|---|
| `indicator_id` | varchar(20) PK | مثال: `IND-HQ-0001` |
| `indicator_version` | smallint | شماره نسخه تعریف |
| `name_fa` | varchar(300) | نام فارسی |
| `name_en` | varchar(300) | نام انگلیسی |
| `definition` | text | تعریف کامل |
| `formula` | text | فرمول محاسبه |
| `unit_of_measure` | varchar(50) | |
| `direction` | varchar(20) | `higher_is_better` / `lower_is_better` / `target_based` / `neutral` |
| `aggregation` | varchar(20) | `sum` / `count` / `average` / `last_value` |
| `period_grain` | varchar(20) | `monthly` / `quarterly` / `annual` |
| `allow_negative` | boolean | |
| `owner_unit_id` | varchar(20) FK | |
| `source_field` | varchar(200) | نام فیلد در فرم BPMS |
| `effective_from` | date | |
| `effective_to` | date | نال = نسخه جاری |
| `is_current` | boolean | برای جست‌وجوی سریع نسخه جاری |

### `dim_program` — برنامه / سرفصل بودجه
| ستون | نوع | توضیح |
|---|---|---|
| `program_id` | varchar(20) PK | |
| `program_name_fa` | varchar(300) | |
| `budget_year_shamsi` | smallint | |
| `owner_unit_id` | varchar(20) FK | |

### `dim_project` — پروژه / اقدام
| ستون | نوع | توضیح |
|---|---|---|
| `project_id` | varchar(20) PK | |
| `project_name_fa` | varchar(300) | |
| `unit_id` | varchar(20) FK | |
| `program_id` | varchar(20) FK | |
| `planned_start` | date | |
| `planned_end` | date | |
| `is_active` | boolean | |

### `dim_person` — مسئول (فقط نقش — بدون ارزیابی فردی)
| ستون | نوع | توضیح |
|---|---|---|
| `person_id` | varchar(20) PK | از SSO/LDAP |
| `display_name` | varchar(200) | نام نمایشی |
| `unit_id` | varchar(20) FK | واحد فعلی |
| `role` | varchar(100) | نقش در سازمان |

---

## ۴. کوئری‌های دروازه کیفیت (بخش ۴.۶ سند اجرایی)

### ۴.۱ دروازه اول — کامل بودن (Completeness)

```sql
-- واحدهایی که در دوره مشخص گزارش نداده‌اند
SELECT
    u.unit_id,
    u.unit_name_fa,
    p.period_id
FROM dim_unit u
CROSS JOIN dim_period p
LEFT JOIN fact_submission fs
    ON fs.unit_id = u.unit_id
    AND fs.period_id = p.period_id
    AND fs.status IN ('submitted', 'under_review', 'approved')
WHERE u.is_active = true
  AND p.period_id = :target_period
  AND fs.submission_id IS NULL
ORDER BY u.unit_name_fa;
```

```sql
-- گزارش‌هایی که شاخص‌های اجباری در آنها خالی است
SELECT
    fs.submission_id,
    u.unit_name_fa,
    i.name_fa AS missing_indicator,
    i.indicator_id
FROM fact_submission fs
JOIN dim_unit u ON u.unit_id = fs.unit_id
CROSS JOIN dim_indicator i
    ON i.is_current = true AND i.period_grain = 'quarterly'
LEFT JOIN fact_indicator_value fiv
    ON fiv.submission_id = fs.submission_id
    AND fiv.indicator_id = i.indicator_id
WHERE fs.period_id = :target_period
  AND fiv.indicator_id IS NULL
ORDER BY u.unit_name_fa, i.indicator_id;
```

### ۴.۲ دروازه دوم — به‌موقع بودن (Timeliness)

```sql
-- نرخ تأخیر به تفکیک واحد در هر دوره
SELECT
    fs.period_id,
    u.unit_name_fa,
    fs.submitted_at,
    p.deadline_submission,
    CASE
        WHEN fs.submitted_at::date <= p.deadline_submission THEN 'on_time'
        ELSE 'late'
    END AS timeliness,
    CASE
        WHEN fs.submitted_at::date > p.deadline_submission
        THEN (fs.submitted_at::date - p.deadline_submission)
        ELSE 0
    END AS days_late
FROM fact_submission fs
JOIN dim_unit u ON u.unit_id = fs.unit_id
JOIN dim_period p ON p.period_id = fs.period_id
WHERE fs.period_id = :target_period
  AND fs.is_amendment = false
ORDER BY days_late DESC;
```

```sql
-- شاخص کلی به‌موقع بودن دوره (IND-HQ-0012)
SELECT
    period_id,
    COUNT(*) FILTER (WHERE submitted_at::date <= p.deadline_submission) AS on_time_count,
    COUNT(*) AS total_required,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE submitted_at::date <= p.deadline_submission) / NULLIF(COUNT(*), 0),
        1
    ) AS timeliness_rate_pct
FROM fact_submission fs
JOIN dim_period p USING (period_id)
WHERE fs.period_id = :target_period
  AND fs.is_amendment = false
GROUP BY fs.period_id, p.deadline_submission;
```

### ۴.۳ دروازه سوم — سازگاری داخلی (Internal Consistency)

```sql
-- انحراف غیرعادی نسبت به همان دوره سال قبل (بیش از ۵۰٪)
WITH current_period AS (
    SELECT
        fiv.unit_id,
        fiv.indicator_id,
        fiv.value_actual AS val_current,
        fiv.period_id
    FROM fact_indicator_value fiv
    WHERE fiv.period_id = :target_period
),
prev_year_period AS (
    SELECT
        fiv.unit_id,
        fiv.indicator_id,
        fiv.value_actual AS val_prev,
        fiv.period_id
    FROM fact_indicator_value fiv
    -- فصل مشابه سال قبل — منطق دقیق وابسته به dim_period است
    JOIN dim_period p ON p.period_id = fiv.period_id
    WHERE p.quarter_num = (SELECT quarter_num FROM dim_period WHERE period_id = :target_period)
      AND p.year_shamsi = (SELECT year_shamsi - 1 FROM dim_period WHERE period_id = :target_period)
)
SELECT
    c.unit_id,
    u.unit_name_fa,
    c.indicator_id,
    i.name_fa,
    py.val_prev,
    c.val_current,
    ROUND(ABS(c.val_current - py.val_prev) / NULLIF(ABS(py.val_prev), 0) * 100, 1) AS change_pct,
    'WARNING: >50% change from same quarter last year' AS flag_message
FROM current_period c
JOIN prev_year_period py
    ON py.unit_id = c.unit_id AND py.indicator_id = c.indicator_id
JOIN dim_unit u ON u.unit_id = c.unit_id
JOIN dim_indicator i ON i.indicator_id = c.indicator_id AND i.is_current = true
WHERE ABS(c.val_current - py.val_prev) / NULLIF(ABS(py.val_prev), 0) > 0.5
ORDER BY change_pct DESC;
```

### ۴.۴ دروازه چهارم — پوشش (Coverage)

```sql
-- درصد پوشش گزارش‌دهی دوره به تفکیک نوع واحد
SELECT
    u.unit_type,
    COUNT(DISTINCT u.unit_id) AS total_units,
    COUNT(DISTINCT fs.unit_id) AS reported_units,
    ROUND(100.0 * COUNT(DISTINCT fs.unit_id) / NULLIF(COUNT(DISTINCT u.unit_id), 0), 1) AS coverage_pct
FROM dim_unit u
LEFT JOIN fact_submission fs
    ON fs.unit_id = u.unit_id
    AND fs.period_id = :target_period
    AND fs.status IN ('submitted', 'under_review', 'approved')
WHERE u.is_active = true
GROUP BY u.unit_type
ORDER BY coverage_pct;
```

### ۴.۵ دروازه پنجم — مقدار غیرمنفی

```sql
-- شاخص‌هایی که مقدار منفی دارند ولی نباید داشته باشند
SELECT
    fiv.submission_id,
    u.unit_name_fa,
    i.name_fa,
    fiv.value_actual
FROM fact_indicator_value fiv
JOIN dim_indicator i ON i.indicator_id = fiv.indicator_id AND i.is_current = true
JOIN fact_submission fs ON fs.submission_id = fiv.submission_id
JOIN dim_unit u ON u.unit_id = fs.unit_id
WHERE fiv.period_id = :target_period
  AND i.allow_negative = false
  AND fiv.value_actual < 0;
```

---

## ۵. ارتباط با محصول A

جدول `bridge_report_document` پل بین عدد (محصول B) و روایت (محصول A) است.

```sql
-- برای یک شاخص، بازیابی اسناد پشت آن عدد
SELECT
    fiv.value_actual,
    fiv.period_id,
    brd.document_id,
    brd.document_type,
    brd.section
FROM fact_indicator_value fiv
JOIN fact_submission fs ON fs.submission_id = fiv.submission_id
JOIN bridge_report_document brd ON brd.submission_id = fiv.submission_id
WHERE fiv.indicator_id = :indicator_id
  AND fiv.period_id = :period_id
  AND fs.unit_id = :unit_id
ORDER BY brd.section;
-- document_id سپس به سرویس محصول A برای بازیابی متن و embedding ارجاع می‌شود
```
