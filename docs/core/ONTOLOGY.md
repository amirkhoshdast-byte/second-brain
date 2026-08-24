# ONTOLOGY.md — هستان‌شناسی موجودیت‌های پلتفرم

> **هدف این فایل:** مدل کامل موجودیت‌های مشترک بین محصول A و B، روابط معنادار بین آنها، قواعد نام‌گذاری، و سیستم Alias/Entity Resolution.

**نسخه:** 1.0  
**وضعیت:** **[پیشنهادی — نیازمند تأیید]**  
**مبنا:** بخش ۵ سند اجرایی + بخش ۱۲ سند محصول A

---

## ۱. نمودار کلان موجودیت‌ها

```
═══════════════════════════════════════════════════════════════
                   موجودیت‌های بیرونی (محصول A محور)
═══════════════════════════════════════════════════════════════

Country ──────────────────────────────────────────────────────
    │                                                         │
    ├──► Organization ──► Person                              │
    │         │                                               │
    │         └──► Event                                      │
    │                                                         │
    ├──► Topic                                                │
    ├──► Religion                                             │
    │                                                         │
    ├──► Report ──────────────────────────────────────────────┤
    │       │                                                  │
    ├──► Source (وب، رسانه، اندیشکده)                         │
    │                                                         │
    ├──► Signal                                               │
    │       ↓                                                 │
    └──► Insight                                              │
                                                              │
═══════════════════════════════════════════════════════════════
              موجودیت‌های عملیاتی (مشترک A و B)
═══════════════════════════════════════════════════════════════
                                                              │
Issue ◄───── (از Signal یا انحراف داشبورد B) ─────────────────┘
    │
    ├──► Decision
    │        │
    │        ├──► Resolution  (مصوبه)
    │        └──► Directive   (دستور)
    │
    └──► Action / Project
              │
              └──► Outcome ──► Organizational Memory

═══════════════════════════════════════════════════════════════
              موجودیت‌های سازمانی داخلی (محصول B محور)
═══════════════════════════════════════════════════════════════

Unit (واحد داخلی) ──► Indicator (شاخص)
    │                      │
    ├──► Program            └──► IndicatorValue (مقدار دوره‌ای)
    └──► Project

SpecialCase ──► [Issue, Report, Signal, Meeting, Decision, ...]
```

---

## ۲. تعریف موجودیت‌ها

### ۲.۱ Country — کشور

**دامنه:** محصول A  
**شناسه:** `CTY-{CC}-0001` (یک رکورد per کشور)

| فیلد | نوع | توضیح |
|---|---|---|
| `entity_id` | string | `CTY-TR-0001` |
| `name_fa` | string | نام فارسی رسمی |
| `name_en` | string | نام انگلیسی |
| `iso_code` | char(2) | ISO 3166-1 alpha-2 |
| `region` | string | منطقه جغرافیایی |
| `languages` | list | زبان‌های رسمی |
| `tags` | list | برچسب‌های موضوعی |
| `classification` | enum | سطح محرمانگی |

**روابط:**
- `HAS_REPRESENTATION` → Representation (نمایندگی/رایزنی)
- `HAS_ORGANIZATION` → Organization (سازمان‌های کشور)
- `HAS_TOPIC` → Topic (موضوعات فعال)
- `HAS_RELIGION` → Religion

---

### ۲.۲ Organization — سازمان / نهاد بیرونی

**دامنه:** محصول A  
**شناسه:** `ORG-{CC}-XXXX`

| فیلد | نوع | توضیح |
|---|---|---|
| `entity_id` | string | |
| `name_fa` | string | |
| `name_en` | string | |
| `aliases` | list | نام‌های دیگر و مخفف‌ها (برای Entity Resolution) |
| `country` | ref | ارجاع به Country |
| `org_type` | enum | `government` / `ngo` / `academic` / `cultural` / `media` / `religious` / `private` |
| `topics` | list | موضوعات مرتبط |
| `website` | string | |
| `reliability` | enum | `high` / `medium` / `low` / `unknown` |
| `classification` | enum | |

**روابط:**
- `LOCATED_IN` → Country
- `EMPLOYS` → Person
- `RELATED_TO` → Topic
- `PARTICIPATED_IN` → Event

---

### ۲.۳ Person — شخص

**دامنه:** محصول A  
**شناسه:** `PRS-{CC}-XXXX`

| فیلد | نوع | توضیح |
|---|---|---|
| `entity_id` | string | |
| `name_fa` | string | |
| `name_en` | string | |
| `aliases` | list | |
| `country` | ref | کشور اصلی |
| `organization` | ref | سازمان اصلی |
| `role` | string | نقش/سمت |
| `topics` | list | حوزه‌های تخصصی |
| `influence_level` | enum | `high` / `medium` / `low` |
| `classification` | enum | |

---

### ۲.۴ Topic — موضوع / حوزه

**دامنه:** محصول A  
**شناسه:** `TOP-HQ-XXXX`

موضوعات مرجع پلتفرم — مثال: `دیپلماسی فرهنگی`، `گفتگوی ادیان`، `آموزش زبان فارسی`.

---

### ۲.۵ Event — رویداد

**دامنه:** محصول A  
**شناسه:** `EVT-{CC}-XXXX`

| فیلد | نوع | توضیح |
|---|---|---|
| `entity_id` | string | |
| `title_fa` | string | |
| `country` | ref | |
| `date` | date | |
| `organizations` | list | |
| `persons` | list | |
| `topics` | list | |
| `outcome` | string | خلاصه نتیجه |

---

### ۲.۶ Report — گزارش

**دامنه:** هر دو محصول (محصول A = دانش؛ محصول B = گزارش دوره‌ای)

**شناسه:** `RPT-{UNIT}-XXXX`

| فیلد | نوع | توضیح |
|---|---|---|
| `entity_id` | string | |
| `title_fa` | string | |
| `report_type` | enum | `periodic` / `analytical` / `monitoring` / `special` |
| `country` | ref | اگر کشورمحور است |
| `unit_id` | ref | واحد تهیه‌کننده |
| `period_id` | string | دوره گزارش |
| `date` | date | تاریخ تهیه |
| `source` | ref | منبع اصلی |
| `topics` | list | |
| `organizations` | list | |
| `persons` | list | |
| `reliability` | enum | |
| `classification` | enum | |

---

### ۲.۷ Signal — سیگنال

**دامنه:** محصول A  
**شناسه:** `SIG-{CC}-XXXX`

مشاهده‌ای نسبتاً خام از منابع بیرونی. یک Signal تنها می‌تواند به Insight تبدیل شود — نه مستقیم به Decision.

| فیلد | نوع | توضیح |
|---|---|---|
| `entity_id` | string | |
| `country` | ref | |
| `date` | date | |
| `source` | ref | |
| `topic` | ref | |
| `sentiment` | enum | `positive` / `neutral` / `negative` / `mixed` |
| `importance` | enum | `high` / `medium` / `low` |
| `entities` | list | موجودیت‌های مرتبط |
| `is_processed` | boolean | آیا به Insight تبدیل شده |

---

### ۲.۸ Insight — بینش تحلیلی

**دامنه:** محصول A  
**شناسه:** `INS-{CC}-XXXX`

نتیجه تحلیل یک یا چند Signal در کنار دانش قبلی. باید به منابع مولد خود Link شود.

| فیلد | نوع | توضیح |
|---|---|---|
| `entity_id` | string | |
| `country` | ref | |
| `date` | date | |
| `derived_from` | list | ارجاع به Signals و Reports مولد |
| `topics` | list | |
| `confidence` | enum | `high` / `medium` / `low` |
| `recommended_action` | string | |
| `is_human_verified` | boolean | آیا تأیید انسانی شده |

**⚠ قانون:** Insight بدون `derived_from` معتبر نیست. AI می‌تواند پیشنهاد Insight بدهد اما تا تأیید انسانی، برچسب `AI_SUGGESTED` می‌خورد.

---

### ۲.۹ Unit — واحد سازمانی داخلی ✦ جدید در نسخه ۱.۰

**دامنه:** مشترک A و B  
**شناسه:** `UNT-{PARENT}-XXXX`

این موجودیت در سند اصلی محصول A نبود — طبق بخش ۵ سند اجرایی اضافه می‌شود.

| فیلد | نوع | توضیح |
|---|---|---|
| `entity_id` | string | `UNT-HQ-0003` |
| `unit_name_fa` | string | |
| `unit_name_en` | string | |
| `unit_type` | enum | `headquarter` / `representation` / `bureau` |
| `parent_unit_id` | ref | واحد مادر |
| `country_code` | string | برای نمایندگی‌ها |
| `is_active` | boolean | |

**روابط:**
- `MANAGES` → Project
- `REPORTS_ON` → Indicator
- `HAS_REPRESENTATION_AT` → Country (برای نمایندگی‌ها)

---

### ۲.۱۰ Indicator — شاخص عملکردی ✦ جدید در نسخه ۱.۰

**دامنه:** مشترک A و B  
**شناسه:** `IND-HQ-XXXX`

تعریف شاخص به‌عنوان موجودیت دانشی — نه فقط یک ردیف در جدول. محصول A باید بتواند به تعریف شاخص ارجاع دهد.

**فیلدها:** طبق `METRIC_LAYER.md` — اینجا فقط رابطه‌ها:

**روابط:**
- `OWNED_BY` → Unit
- `MEASURED_FOR` → Unit
- `RELATED_TO` → Topic

---

### ۲.۱۱ Issue — مسئله ✦ نقطه اتصال رسمی A و B

**دامنه:** مشترک A و B  
**شناسه:** `ISS-HQ-XXXX`

مهم‌ترین موجودیت پلتفرم. یک انحراف در داشبورد B یا یک سیگنال در A می‌توانند Issue تولید کنند و از آن به بعد یک پرونده واحد دارند.

| فیلد | نوع | توضیح |
|---|---|---|
| `entity_id` | string | |
| `title_fa` | string | عنوان مسئله |
| `status` | enum | `identified` / `under_analysis` / `in_decision` / `resolved` / `closed` |
| `priority` | enum | `critical` / `high` / `medium` / `low` |
| `unit_id` | ref | واحد مسئول اصلی |
| `country` | ref | اگر کشورمحور است |
| `period_id` | string | دوره شناسایی |
| `source_type` | enum | `dashboard_anomaly` / `signal` / `manual` / `report` |
| `source_ref` | string | ارجاع به منشأ (شناسه انحراف B یا Signal A) |
| `classification` | enum | |

**روابط:**
- `HAS_EVIDENCE` → Report / Signal / Insight / IndicatorValue
- `LED_TO` → Decision
- `ASSIGNED_TO` → Unit / Person
- `RELATED_TO` → SpecialCase

---

### ۲.۱۲ Decision — تصمیم ✦ جدید در نسخه ۱.۰

**دامنه:** مشترک A و B  
**شناسه:** `DEC-HQ-XXXX`

| فیلد | نوع | توضیح |
|---|---|---|
| `entity_id` | string | |
| `title_fa` | string | |
| `issue_id` | ref | Issue مربوطه |
| `meeting` | ref | جلسه‌ای که تصمیم در آن گرفته شد |
| `owner` | ref | Person مسئول |
| `unit_id` | ref | واحد مسئول اجرا |
| `date` | date | |
| `status` | enum | `pending` / `in_execution` / `completed` / `cancelled` |
| `evidence` | list | ارجاع به شواهد مورد استناد |
| `classification` | enum | |

**روابط:**
- `RESOLVES` → Issue
- `RESULTS_IN` → Resolution / Directive / Action

---

### ۲.۱۳ Resolution — مصوبه ✦ جدید در نسخه ۱.۰

**دامنه:** مشترک A و B  
**شناسه:** `RES-HQ-XXXX`

| فیلد | نوع | توضیح |
|---|---|---|
| `entity_id` | string | |
| `title_fa` | string | |
| `decision_id` | ref | Decision مادر |
| `issued_by` | ref | مقام صادرکننده |
| `issued_at` | date | |
| `effective_from` | date | |
| `body` | text | متن مصوبه |
| `classification` | enum | |

---

### ۲.۱۴ Directive — دستور ✦ جدید در نسخه ۱.۰

**دامنه:** مشترک A و B  
**شناسه:** `DIR-HQ-XXXX`

| فیلد | نوع | توضیح |
|---|---|---|
| `entity_id` | string | |
| `title_fa` | string | |
| `decision_id` | ref | Decision مادر |
| `addressed_to` | list | واحد یا شخص مخاطب |
| `deadline` | date | مهلت اجرا |
| `body` | text | متن دستور |
| `status` | enum | `issued` / `acknowledged` / `in_progress` / `completed` / `overdue` |
| `classification` | enum | |

---

### ۲.۱۵ SpecialCase — پرونده ویژه

**دامنه:** مشترک A و B  
**شناسه:** `SPC-HQ-XXXX`

Container بلندمدت برای موضوعات پیچیده که چندین Issue، Report، Decision را در بر می‌گیرد. نقطه اتصال مهم بین Second Brain و Management OS.

---

## ۳. جدول خلاصه موجودیت‌ها

| موجودیت | شناسه | محصول | درجه‌یک |
|---|---|---|---|
| Country | `CTY-CC-XXXX` | A | ✓ |
| Organization | `ORG-CC-XXXX` | A | ✓ |
| Person | `PRS-CC-XXXX` | A | ✓ |
| Topic | `TOP-HQ-XXXX` | A | ✓ |
| Religion | `REL-HQ-XXXX` | A | ✓ |
| Event | `EVT-CC-XXXX` | A | ✓ |
| Report | `RPT-UNIT-XXXX` | A+B | ✓ |
| Source | `SRC-CC-XXXX` | A | ✓ |
| Signal | `SIG-CC-XXXX` | A | ✓ |
| Insight | `INS-CC-XXXX` | A | ✓ |
| **Unit** | `UNT-HQ-XXXX` | **A+B** | **✓ جدید** |
| **Indicator** | `IND-HQ-XXXX` | **A+B** | **✓ جدید** |
| **Issue** | `ISS-HQ-XXXX` | **A+B** | **✓** |
| **Decision** | `DEC-HQ-XXXX` | **A+B** | **✓ جدید** |
| **Resolution** | `RES-HQ-XXXX` | **A+B** | **✓ جدید** |
| **Directive** | `DIR-HQ-XXXX` | **A+B** | **✓ جدید** |
| SpecialCase | `SPC-HQ-XXXX` | A+B | ✓ |
| Project | `PRJ-UNIT-XXXX` | B | ✓ |
| Meeting | داخلی | A | — |
| Action | داخلی | A+B | — |

---

## ۴. سیستم Alias و Entity Resolution

### ۴.۱ مسئله

```
Yunus Emre Institute
Yunus Emre
YEE
موسسه یونس امره
یونس امره انستیتو
```
باید به یک `entity_id` واحد نگاشت شوند.

### ۴.۲ ساختار

هر موجودیت یک **Canonical Name** دارد و می‌تواند چندین Alias داشته باشد:

```yaml
# در Obsidian Note:
aliases:
  - "Yunus Emre"
  - "YEE"
  - "موسسه یونس امره"
  - "یونس امره انستیتو"
```

در Entity Registry (هسته مشترک) یک جدول Alias نگهداری می‌شود:

```
entity_id       canonical_name              alias               lang
ORG-TR-0042     Yunus Emre Institute        YEE                 en
ORG-TR-0042     Yunus Emre Institute        موسسه یونس امره     fa
ORG-TR-0042     Yunus Emre Institute        یونس امره انستیتو   fa
```

### ۴.۳ قواعد Entity Resolution

1. **اول جست‌وجو کن.** قبل از ایجاد موجودیت جدید، جدول Alias را با نام جدید بررسی کن.
2. **Curator تصمیم می‌گیرد.** اگر AI یک موجودیت جدید پیشنهاد داد، Knowledge Curator تأیید یا ادغام می‌کند.
3. **هر دو محصول یک Registry.** Entity Registry بخشی از هسته مشترک است — محصول A و B هر دو از همان جدول می‌خوانند.
4. **Alias حذف نمی‌شود.** حتی اگر سازمانی تغییر نام داد، Alias قدیمی برای جست‌وجوی تاریخی باقی می‌ماند.

---

## ۵. قواعد نام‌گذاری فایل Obsidian

| نوع موجودیت | الگوی نام فایل | مثال |
|---|---|---|
| Country | `CTY - {name_en}.md` | `CTY - Turkey.md` |
| Organization | `ORG - {name_en}.md` | `ORG - Yunus Emre Institute.md` |
| Person | `PRS - {name_en}.md` | `PRS - Ali Yilmaz.md` |
| Report | `RPT - {YYYY-MM} - {title_short}.md` | `RPT - 2026-08 - Turkey Cultural Q2.md` |
| Signal | `SIG - {YYYY-MM-DD} - {topic}.md` | `SIG - 2026-08-15 - Cultural Diplomacy.md` |
| Insight | `INS - {YYYY-MM-DD} - {title_short}.md` | |
| Issue | `ISS - {id} - {title_short}.md` | `ISS-HQ-0021 - Visa Delays Istanbul.md` |
| Decision | `DEC - {id} - {title_short}.md` | |
| Unit | `UNT - {name_fa}.md` | `UNT - نمایندگی ترکیه.md` |
| Indicator | `IND - {id} - {name_fa}.md` | `IND-HQ-0001 - رویدادهای فرهنگی.md` |

**قاعده کلی:**
- نام فایل انگلیسی برای موجودیت‌های بیرونی (Country, Org, Person)
- نام فارسی برای موجودیت‌های داخلی (Unit, Directive)
- هرگز فاصله با underscore جایگزین نشود — از فاصله معمولی استفاده شود
- اعداد ترتیبی برای موجودیت‌هایی که نام یکتا ندارند

---

## ۶. بُعد زمانی اجباری روی موجودیت‌های عملیاتی

طبق بخش ۵ سند اجرایی، همه یادداشت‌های عملیاتی باید `period_id` داشته باشند:

```yaml
# موجودیت‌هایی که period_id اجباری است:
- Report (گزارش دوره‌ای)
- Signal
- Insight
- Issue
- IndicatorValue
- ProjectStatus

# موجودیت‌هایی که period_id اختیاری یا بی‌معنی است:
- Country
- Organization
- Person
- Topic
```
