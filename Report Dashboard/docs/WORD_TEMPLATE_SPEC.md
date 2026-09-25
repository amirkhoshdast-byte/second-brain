# WORD_TEMPLATE_SPEC.md — مشخصات قالب Word گزارش ماهانه

> **هدف این فایل:** تعریف قالب `.docx` که از طریق BPMS به واحدها ارسال و به‌صورت Word برگشت داده می‌شود؛ نگاشت هر فیلد قالب به فیلدهای `REPORT_FORM_SPEC.md` و ستون‌های `landing.sql`؛ قواعد پارس و نسخه‌بندی.

**نسخه:** 0.1
**وضعیت:** **[پیشنهادی — نیازمند تأیید معاونت برنامه‌ریزی]**
**مبنا:** `REPORT_FORM_SPEC.md` (فرم پنج‌بخشی)، `INTEGRATION_CONTRACT.md` (شناسه و دوره)، `docs/data-model/ddl/landing.sql`

---

## ۱. چرا Word با Content Control

BPMS سازمان ابزاری بیرونی است؛ ما فرم را طراحی می‌کنیم، BPMS آن را در گردش کار ادارات کل و معاونت‌ها می‌چرخاند و خروجی را به‌صورت **فایل Word در قالب ثابت** تحویل می‌دهد.

اگر Word آزاد باشد، استخراج عدد به حدس AI وابسته می‌شود — که با قانون «عدد فقط از B و قطعی» (INTEGRATION_CONTRACT §۸) در تضاد است. پس:

> **هر فیلد داده‌ای قالب یک Content Control (SDT) با `tag` یکتا است. پارسر فقط tag را می‌خواند — نه متن اطراف، نه جای فیلد در صفحه.**

مزایا: استخراج ۱۰۰٪ قطعی، مستقل از فونت و چیدمان، قابل اعتبارسنجی نوع (Date Picker، Dropdown، Plain Text)، و مقاوم در برابر جابه‌جایی جدول‌ها.

---

## ۲. قواعد ساخت قالب

| قاعده | توضیح |
|---|---|
| قفل ساختار | سند با Restrict Editing محافظت می‌شود؛ فقط Content Controlها قابل ویرایش‌اند |
| Content Control قفل | ویژگی «Content control cannot be deleted» برای همه فیلدها فعال است |
| نوع کنترل | عدد و متن → Plain Text · enum → Dropdown List · تاریخ → Date Picker (شمسی، فرمت `yyyy/MM/dd`) |
| جدول‌های تکرارشونده | ردیف شاخص/پروژه/مانع با **Repeating Section Content Control**؛ هر ردیف tag پایه یکسان و اندیس ترتیبی دارد |
| فیلدهای ثابت | شاخص‌های اجباری هر واحد از پیش در قالب همان واحد پر و قفل‌شده‌اند (قالب per-unit تولید می‌شود) |
| زبان | راست‌به‌چپ؛ ارقام فارسی و لاتین هر دو پذیرفته و در پارس نرمال می‌شوند |
| پیوست | پیوست‌ها داخل Word جاسازی **نمی‌شوند**؛ به‌صورت فایل جدا از BPMS می‌آیند و در بخش ۵ فقط فهرست‌شان ثبت می‌شود |

---

## ۳. قرارداد نام‌گذاری tag

```
{section}.{field}                 ← فیلدهای تکی (Header، روایت)
{section}[{i}].{field}            ← ردیف‌های تکرارشونده (i از 1)
```

`section` ∈ `hdr` · `ind` · `prj` · `obs` · `nar` · `att`

قاعده: tag فقط حروف کوچک لاتین، رقم، نقطه و براکت. هر tag ناشناخته → هشدار دروازه کیفیت «نسخه قالب نامعتبر».

---

## ۴. نگاشت فیلدها

### Header — `hdr`

| tag | فیلد فرم | ستون landing | نوع کنترل | منبع مقدار |
|---|---|---|---|---|
| `hdr.template_version` | — | `raw_submission.payload` | Plain Text قفل | هنگام تولید قالب |
| `hdr.unit_id` | `unit_id` | `raw_submission.unit_id_raw` | Plain Text قفل | هنگام تولید قالب (per-unit) |
| `hdr.period_id` | `period_id` | `raw_submission.period_id_raw` | Plain Text قفل | هنگام تولید قالب، مثل `1405-M07` |
| `hdr.submitted_by` | `submitted_by` | `raw_submission.submitted_by_raw` | Plain Text | تکمیل‌کننده (یا از متادیتای BPMS) |
| `hdr.submitted_at` | `submitted_at` | `raw_submission.submitted_at_raw` | Date Picker | تکمیل‌کننده (یا از متادیتای BPMS) |
| `hdr.is_amendment` | `is_amendment` | `raw_submission.payload` | Dropdown (`بله`/`خیر`) | تکمیل‌کننده |
| `hdr.amendment_ref` | `amendment_ref` | `raw_submission.payload` | Plain Text | فقط اگر اصلاحیه |

`submission_id` و `status` در Word نیستند — سیستم تولید می‌کند (REPORT_FORM_SPEC: «نباید دستی باشد»).

### بخش ۱ — شاخص‌ها `ind[i]` → `landing.raw_indicator_value`

| tag | ستون landing |
|---|---|
| `ind[i].indicator_id` | `indicator_id_raw` (قفل، از پیش پر) |
| `ind[i].value_actual` | `value_actual_raw` |
| `ind[i].value_target` | `value_target_raw` (از پیش پر از `dim_indicator.default_target`، قابل ویرایش نیست) |
| `ind[i].unit_of_measure` | `unit_of_measure_raw` (قفل) |
| `ind[i].data_source` | `data_source_raw` |
| `ind[i].note` | `note_raw` |

`period_id` هر ردیف از `hdr.period_id` ارث می‌رسد.

### بخش ۲ — پروژه‌ها `prj[i]` → `landing.raw_project_status`

| tag | ستون landing | نوع کنترل |
|---|---|---|
| `prj[i].project_id` | `project_id_raw` | Plain Text قفل |
| `prj[i].progress_pct` | `progress_pct_raw` | Plain Text |
| `prj[i].status` | `status_raw` | Dropdown: مقادیر `status` در REPORT_FORM_SPEC |
| `prj[i].milestone_reached` | `milestone_reached` | Plain Text |
| `prj[i].next_milestone` | `next_milestone` | Plain Text |
| `prj[i].projected_completion` | `projected_completion_raw` | Date Picker |

### بخش ۳ — موانع `obs[i]` → `landing.raw_obstacle`

| tag | ستون landing | نوع کنترل |
|---|---|---|
| `obs[i].category` | `category_raw` | Dropdown: ۱۲ دسته REPORT_FORM_SPEC |
| `obs[i].severity` | `severity_raw` | Dropdown |
| `obs[i].status` | `status_raw` | Dropdown |
| `obs[i].description` | `description` | Plain Text چندخطی |
| `obs[i].affected_indicator_id` | `affected_indicator_id_raw` | Dropdown از شاخص‌های همان واحد |
| `obs[i].affected_project_id` | `affected_project_id_raw` | Dropdown از پروژه‌های همان واحد |
| `obs[i].proposed_action` | `proposed_action` | Plain Text |

Dropdownها برچسب فارسی نشان می‌دهند و **کد لاتین** (مثل `budget`) را در Value ذخیره می‌کنند؛ پارسر Value را می‌خواند.

### بخش ۴ — روایت `nar` → `landing.raw_submission.payload.narrative`

| tag | فیلد فرم |
|---|---|
| `nar.narrative_summary` | `narrative_summary` |
| `nar.context_notes` | `context_notes` |
| `nar.lessons_learned` | `lessons_learned` |

landing جدول جدا برای روایت ندارد؛ متن در `payload` نگه داشته می‌شود و پس از تأیید به محصول A می‌رود (INTEGRATION_CONTRACT §۷).

### بخش ۵ — فهرست پیوست‌ها `att[i]` → `landing.raw_document`

| tag | ستون landing |
|---|---|
| `att[i].file_name` | `file_name` — باید با نام فایل همراه از BPMS بخواند |
| `att[i].description` | `description` |
| `att[i].classification` | `classification_raw` (Dropdown: چهار سطح INTEGRATION_CONTRACT §۴) |

`file_type`، `file_size_bytes`، `storage_path` از خود فایل پیوست محاسبه می‌شوند.

---

## ۵. رفتار پارسر

```
Word از BPMS
   ↓ ۱. hash فایل (SHA-256) — اگر تکراری، رد با پیام «قبلاً دریافت شده»
   ↓ ۲. خواندن word/document.xml و استخراج همه w:sdt با w:tag
   ↓ ۳. بررسی hdr.template_version در فهرست نسخه‌های فعال
   ↓ ۴. نرمال‌سازی: ارقام فارسی→لاتین، حذف جداکننده هزارگان، trim
   ↓ ۵. درج در landing.* با source_system='bpms', ingestion_method='docx'
   ↓ ۶. کل tagها به‌صورت {tag: value} در raw_submission.payload (بدون تغییر)
   ↓ ۷. processing_status='pending' → دروازه کیفیت
```

- پارسر **هیچ AI ندارد.** مقدار خالی = خالی؛ حدس زده نمی‌شود.
- **مسیر fallback:** اگر فایل Content Control ندارد (واحد قالب را دور زده یا BPMS آن را به متن ساده تبدیل کرده)، فایل به صف «بازبینی دستی» می‌رود. AI می‌تواند **پیش‌نویس** استخراج را برای کارشناس آماده کند، اما عدد فقط پس از تأیید انسانی وارد landing می‌شود و `payload.extraction='ai_assisted_human_verified'` علامت می‌خورد.

**[پیشنهادی]** مقدار `docx` به فهرست توضیحی `ingestion_method` در `landing.sql` اضافه شود؛ `source_ref` شماره پیگیری/کارتابل BPMS را نگه می‌دارد.

---

## ۶. نسخه‌بندی قالب

- `template_version` با الگوی `B-{MAJOR}.{MINOR}` (مثل `B-1.0`).
- MINOR: تغییر متن راهنما یا چیدمان بدون تغییر tag.
- MAJOR: افزودن/حذف/تغییر نام tag — نیازمند نسخه جدید پارسر؛ پارسر نسخه‌های قبلی را تا پایان دوره جاری می‌پذیرد.
- قالب per-unit از روی «قالب مادر» + فهرست شاخص و پروژه‌های فعال واحد در `warehouse` تولید می‌شود — هیچ‌کس قالب واحد را دستی ویرایش نمی‌کند.

---

## ۷. فرض‌ها (ثبت در `ASSUMPTIONS.md`)

| کد | فرض | تأثیر اگر غلط باشد |
|---|---|---|
| A-6 | BPMS فایل Word را بدون تبدیل (با Content Controlها) منتقل می‌کند | اگر نه: پارس از روی جدول‌های با شناسه پنهان یا Bookmark؛ دقت کمتر |
| A-7 | BPMS می‌تواند پیوست‌ها را جدا از Word تحویل دهد | اگر نه: پیوست‌ها داخل Word جاسازی و استخراج می‌شوند |
| A-8 | متادیتای BPMS (فرستنده، زمان، شماره پیگیری) همراه فایل قابل دریافت است | اگر نه: از فیلدهای Header خوانده می‌شود و قابل جعل‌تر است |
