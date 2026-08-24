# METRIC_LAYER.md — لایه معنایی شاخص‌ها

> **هدف این فایل:** تعریف قواعد شاخص‌گذاری، نسخه‌بندی، مالکیت، و کاتالوگ ۱۵ شاخص نمونه متناسب با یک سازمان فرهنگی بین‌المللی با نمایندگی‌های خارجی.

**نسخه:** 1.0  
**وضعیت:** **[پیشنهادی — نیازمند تأیید معاونت برنامه‌ریزی]**  
**مبنا:** بخش ۴.۵ سند اجرایی `PLATFORM.md`

---

## ۱. قاعده اصلی: یک تعریف، یک شاخص

هر شاخص باید **یک** تعریف واحد، مکتوب، نسخه‌دار و مصوب داشته باشد.

اگر دو واحد یک عدد را دو جور محاسبه کنند، مشکل از نبود تعریف مصوب است، نه از واحدها. داشبورد روی شاخص تعریف‌نشده بی‌معنا است — قبل از ساختن هر چارت، فایل تعریف شاخص باید موجود باشد.

---

## ۲. ساختار تعریف شاخص

هر شاخص در یک بلوک YAML با این فیلدها تعریف می‌شود:

```yaml
indicator_id: IND-HQ-XXXX          # شناسه یکتا طبق INTEGRATION_CONTRACT.md بخش ۲
name_fa: ""                         # نام فارسی رسمی — همین چیزی که روی داشبورد نشان داده می‌شود
name_en: ""                         # نام انگلیسی برای مستندات فنی
definition: ""                      # تعریف دقیق: چه چیزی محاسبه می‌شود و چه چیزی نه
formula: ""                         # فرمول یا قاعده محاسبه؛ اگر شمارشی است: شرط دقیق
unit_of_measure: ""                 # واحد سنجش: عدد، درصد، میلیون ریال، ساعت، ...
direction: higher_is_better         # higher_is_better | lower_is_better | target_based | neutral
aggregation: sum                    # sum | count | average | max | min | last_value
period_grain: quarterly             # monthly | quarterly | annual
source_field: ""                    # نام فیلد در فرم گزارش BPMS (بخش ۱ فرم)
owner_unit: ""                      # واحد سازمانی مسئول تعریف و نگهداری
target_source: ""                   # منبع هدف: سند بودجه سالانه، مصوبه مدیریت، ...
allow_negative: false               # آیا مقدار منفی مجاز است؟
version: 1                          # شماره نسخه تعریف؛ با هر تغییر معنایی ++
effective_from: ""                  # تاریخ شمسی آغاز اعتبار این نسخه (YYYY-MM-DD)
effective_to: null                  # null = تعریف جاری است
interpretation_traps:               # تله‌های تفسیری — چرا این عدد ممکن است گمراه‌کننده باشد
  - ""
notes: ""                           # یادداشت اضافی برای Knowledge Curator
```

---

## ۳. قواعد نسخه‌بندی شاخص

### ۳.۱ چه زمانی نسخه بالا می‌رود

- تغییر `definition` یا `formula` به‌گونه‌ای که مقادیر قبلی با نسخه جدید قابل مقایسه نباشند: **MAJOR** (نسخه از ۱ به ۲).
- تغییر `target_source` یا `direction` یا `unit_of_measure`: **MAJOR**.
- افزودن `interpretation_traps` جدید یا اصلاح `notes`: **MINOR** (نیاز به تغییر `version` ندارد، فقط تاریخ ویرایش).
- تغییر `source_field` به دلیل بازطراحی فرم BPMS: **MAJOR** (مقادیر قدیمی ممکن است با منبع جدید ناسازگار باشند).

### ۳.۲ رویه

1. تعریف قدیمی با `effective_to` بسته می‌شود.
2. تعریف جدید با `version` بالاتر و `effective_from` جدید باز می‌شود.
3. مقادیر تاریخی با `version` نسخه‌ای که زیر آن ثبت شده‌اند نگه‌داری می‌شوند — نه بازمحاسبه.
4. داشبورد در مقایسه دوره‌ای اخطار می‌دهد اگر دو دوره زیر نسخه‌های مختلف یک شاخص باشند.

### ۳.۳ مالکیت

- **تعریف‌کننده:** واحدی که `owner_unit` آن شاخص است — پیشنهاد تغییر می‌دهد.
- **تصویب‌کننده:** معاونت برنامه‌ریزی — بدون تصویب، نسخه جدید وارد `dim_indicator` نمی‌شود.
- هر تغییر MAJOR باید با ADR در `docs/decisions/` ثبت شود.

---

## ۴. ارتباط با Obsidian (محصول A)

هر تعریف شاخص باید در Obsidian نیز به‌صورت Note وجود داشته باشد تا مغز دوم بتواند به آن ارجاع دهد. وقتی مدیر می‌پرسد «این عدد یعنی چه؟»، AI پاسخ را از این فایل می‌خواند، نه از حافظه مدل.

الگوی Note مرتبط در `docs/obsidian-templates/`.

---

## ۵. کاتالوگ شاخص‌های نمونه

### **[پیشنهادی — نیازمند تأیید معاونت برنامه‌ریزی]**

این ۱۵ شاخص پیش‌نویس‌اند و به تأیید سازمان نیاز دارند. اعداد هدف با `TBD` علامت‌گذاری شده‌اند.

---

#### IND-HQ-0001 — تعداد رویدادهای فرهنگی برگزارشده

```yaml
indicator_id: IND-HQ-0001
name_fa: تعداد رویدادهای فرهنگی برگزارشده
name_en: Number of Cultural Events Held
definition: >
  رویدادی که با مجوز یا حمایت رسمی نمایندگی/واحد سازمان برگزار شده باشد،
  با حضور حداقل ۲۰ نفر، و در مهلت گزارش‌دهی به اتمام رسیده باشد.
  رویدادهای مجازی نیز در صورت ثبت رسمی و حضور حداقل ۲۰ نفر مشمول است.
formula: count(events where status='held' AND attendance >= 20 AND organizer IN (unit, representation))
unit_of_measure: عدد
direction: higher_is_better
aggregation: sum
period_grain: quarterly
source_field: bpms.report_form.section1.field_001
owner_unit: معاونت برنامه‌ریزی
target_source: سند بودجه سالانه — پیوست اهداف عملکردی
allow_negative: false
version: 1
effective_from: "1405-01-01"
effective_to: null
interpretation_traps:
  - یک رویداد بزرگ با ۵۰۰ نفر و ده رویداد کوچک با ۲۰ نفر هر کدام عدد برابر می‌دهند اما ارزش یکسانی ندارند — همیشه کنار عدد به تعداد شرکت‌کنندگان هم نگاه کنید.
  - رویدادهایی که نمایندگی فقط مشارکت کرده (نه برگزارکننده اصلی) نباید شمرده شوند مگر به‌صورت صریح توافق شده باشد.
notes: برای مقایسه بین واحدها باید به مقیاس نمایندگی (شهر بزرگ در برابر شهر کوچک) توجه کرد.
```

---

#### IND-HQ-0002 — تعداد شرکت‌کنندگان در رویدادهای فرهنگی

```yaml
indicator_id: IND-HQ-0002
name_fa: تعداد شرکت‌کنندگان در رویدادهای فرهنگی
name_en: Total Cultural Event Attendance
definition: >
  مجموع تعداد افرادی که در رویدادهای فرهنگی شمرده‌شده در IND-HQ-0001 شرکت کرده‌اند.
  ثبت دوباره یک نفر در چند رویداد مجاز است — این شاخص نفر-بار است، نه نفر یکتا.
formula: sum(attendance FOR events counted in IND-HQ-0001)
unit_of_measure: نفر-بار
direction: higher_is_better
aggregation: sum
period_grain: quarterly
source_field: bpms.report_form.section1.field_002
owner_unit: معاونت برنامه‌ریزی
target_source: سند بودجه سالانه — پیوست اهداف عملکردی
allow_negative: false
version: 1
effective_from: "1405-01-01"
effective_to: null
interpretation_traps:
  - این شاخص «ریچ» (دسترسی) را اندازه می‌گیرد نه «اثر» — حضور با تأثیرگذاری یکی نیست.
  - در رویدادهای مجازی تعداد ثبت‌نامی‌ها با تعداد واقعی حاضر ممکن است بسیار متفاوت باشد؛ عدد باید حضور واقعی باشد نه ثبت‌نام.
notes: همیشه کنار IND-HQ-0001 خوانده شود.
```

---

#### IND-HQ-0003 — درصد اجرای برنامه سالانه فرهنگی

```yaml
indicator_id: IND-HQ-0003
name_fa: درصد اجرای برنامه سالانه فرهنگی
name_en: Annual Cultural Program Execution Rate
definition: >
  نسبت تعداد برنامه‌های فرهنگی اجراشده به تعداد برنامه‌های تعریف‌شده در برنامه سالانه مصوب،
  بیان‌شده به درصد. «اجراشده» یعنی وضعیت پروژه در بخش ۲ فرم برابر 'completed' است.
formula: (count(programs WHERE status='completed') / count(programs IN annual_plan)) * 100
unit_of_measure: درصد
direction: higher_is_better
aggregation: last_value
period_grain: quarterly
source_field: bpms.report_form.section2 (aggregate)
owner_unit: معاونت برنامه‌ریزی
target_source: TBD — هدف پیشنهادی ≥ ۸۰٪ در پایان سال
allow_negative: false
version: 1
effective_from: "1405-01-01"
effective_to: null
interpretation_traps:
  - اگر واحدی برنامه اولیه کمتری ثبت کند، این نسبت بالاتری خواهد داشت — کیفیت و کمیت برنامه سالانه در این عدد نمی‌آید.
  - در Q1 و Q2 این عدد طبیعتاً پایین‌تر است؛ مقایسه بین‌فصلی بدون تعدیل گمراه‌کننده است.
notes: TBD
```

---

#### IND-HQ-0004 — تعداد توافقنامه و تفاهم‌نامه منعقدشده

```yaml
indicator_id: IND-HQ-0004
name_fa: تعداد توافقنامه و تفاهم‌نامه منعقدشده
name_en: Number of MOUs / Agreements Signed
definition: >
  تعداد توافقنامه‌ها یا تفاهم‌نامه‌های رسمی امضاشده با سازمان‌ها/نهادهای خارجی
  که در این دوره به مرحله امضای نهایی رسیده‌اند. توافق‌های در حال مذاکره شامل نمی‌شود.
formula: count(agreements WHERE status='signed' AND signing_date IN period)
unit_of_measure: عدد
direction: higher_is_better
aggregation: sum
period_grain: quarterly
source_field: bpms.report_form.section1.field_004
owner_unit: معاونت بین‌الملل
target_source: TBD
allow_negative: false
version: 1
effective_from: "1405-01-01"
effective_to: null
interpretation_traps:
  - یک تفاهم‌نامه جامع با یک سازمان معتبر ارزش بیشتری از ده توافق کم‌اهمیت دارد — عدد تنها کمیت را می‌گوید.
  - تفاهم‌نامه تمدیدشده با تفاهم‌نامه جدید یکسان نیست؛ باید در تعریف مشخص شود که تمدید شامل می‌شود یا نه. [TBD — نیازمند تصویب]
notes: TBD
```

---

#### IND-HQ-0005 — تعداد دوره‌های آموزشی و کارگاه‌های زبانی

```yaml
indicator_id: IND-HQ-0005
name_fa: تعداد دوره‌های آموزشی و کارگاه‌های زبانی برگزارشده
name_en: Number of Language / Educational Courses Held
definition: >
  تعداد دوره‌های آموزشی، کلاس‌های زبان، یا کارگاه‌های فرهنگی که در این دوره
  آغاز شده‌اند (نه لزوماً به اتمام رسیده‌اند). دوره‌ای حداقل باید ۴ ساعت آموزشی داشته باشد.
formula: count(courses WHERE start_date IN period AND total_hours >= 4)
unit_of_measure: عدد
direction: higher_is_better
aggregation: sum
period_grain: quarterly
source_field: bpms.report_form.section1.field_005
owner_unit: معاونت آموزشی
target_source: TBD
allow_negative: false
version: 1
effective_from: "1405-01-01"
effective_to: null
interpretation_traps:
  - دوره ۱۰۰ ساعته با ۱ ثبت می‌شود، دوره ۴ ساعته هم با ۱ — برای عمق آموزش به IND-HQ-0006 هم نگاه کنید.
notes: TBD
```

---

#### IND-HQ-0006 — تعداد شرکت‌کنندگان در دوره‌های آموزشی

```yaml
indicator_id: IND-HQ-0006
name_fa: تعداد شرکت‌کنندگان در دوره‌های آموزشی
name_en: Total Educational Course Enrollment
definition: >
  مجموع تعداد ثبت‌نام‌های فعال در دوره‌های شمرده‌شده در IND-HQ-0005.
  «فعال» یعنی ثبت‌نامی که تا پایان دوره انصراف نداده است.
  این عدد نفر-بار است.
formula: sum(active_enrollment FOR courses counted in IND-HQ-0005)
unit_of_measure: نفر-بار
direction: higher_is_better
aggregation: sum
period_grain: quarterly
source_field: bpms.report_form.section1.field_006
owner_unit: معاونت آموزشی
target_source: TBD
allow_negative: false
version: 1
effective_from: "1405-01-01"
effective_to: null
interpretation_traps:
  - ثبت‌نام با تکمیل دوره یکی نیست — نرخ ریزش (dropout) در این شاخص نمی‌آید.
notes: TBD
```

---

#### IND-HQ-0007 — تعداد انتشارات فرهنگی

```yaml
indicator_id: IND-HQ-0007
name_fa: تعداد انتشارات فرهنگی منتشرشده
name_en: Number of Cultural Publications Released
definition: >
  تعداد کتاب، مجله، گزارش، یا محتوای رسانه‌ای (ویدیو، پادکست) که در این دوره
  توسط نمایندگی/واحد تولید و منتشر شده‌اند. ترجمه، نشر مجدد، و محتوای بازنشر‌شده
  از منابع دیگر شامل نمی‌شود.
formula: count(publications WHERE type IN ('book','journal','report','video','podcast') AND published_date IN period AND producer = unit)
unit_of_measure: عدد
direction: higher_is_better
aggregation: sum
period_grain: quarterly
source_field: bpms.report_form.section1.field_007
owner_unit: معاونت انتشارات
target_source: TBD
allow_negative: false
version: 1
effective_from: "1405-01-01"
effective_to: null
interpretation_traps:
  - یک کتاب ۳۰۰ صفحه‌ای با یک ویدیو ۵ دقیقه‌ای هر دو «۱ انتشار» می‌شوند.
  - ترجمه ممکن است ارزش بالاتری از تألیف داشته باشد اما در این شاخص نمی‌آید — نیازمند تصمیم سازمانی درباره شمول ترجمه [TBD].
notes: TBD
```

---

#### IND-HQ-0008 — تعداد نشست‌ها و دیدارهای دیپلماسی فرهنگی

```yaml
indicator_id: IND-HQ-0008
name_fa: تعداد نشست‌های دیپلماسی فرهنگی
name_en: Number of Cultural Diplomacy Meetings
definition: >
  تعداد جلسات رسمی یا نیمه‌رسمی برگزارشده با نهادهای دولتی، سازمان‌های فرهنگی،
  یا شخصیت‌های کلیدی کشور میزبان با هدف پیشبرد اهداف فرهنگی سازمان.
  جلسات صرفاً اداری (تنظیم قرارداد مالی، امور اداری داخلی) شامل نمی‌شود.
formula: count(meetings WHERE purpose='cultural_diplomacy' AND date IN period AND participant_type IN ('government','ngo','cultural_org','key_person'))
unit_of_measure: عدد
direction: higher_is_better
aggregation: sum
period_grain: quarterly
source_field: bpms.report_form.section1.field_008
owner_unit: معاونت بین‌الملل
target_source: TBD
allow_negative: false
version: 1
effective_from: "1405-01-01"
effective_to: null
interpretation_traps:
  - ۱۰ جلسه با مقامات سطح پایین ارزش کمتری از یک جلسه با وزیر دارد — این شاخص سطح مخاطبان را نمی‌سنجد.
  - مرز «دیپلماسی فرهنگی» با «امور اداری» ذهنی است — راهنمای تکمیل فرم باید مثال‌های روشن داشته باشد.
notes: TBD
```

---

#### IND-HQ-0009 — درصد اجرای بودجه برنامه‌ای

```yaml
indicator_id: IND-HQ-0009
name_fa: درصد اجرای بودجه برنامه‌ای
name_en: Program Budget Execution Rate
definition: >
  نسبت بودجه هزینه‌شده (تعهد یا پرداخت — TBD) به بودجه تخصیص‌یافته برای این دوره،
  بیان‌شده به درصد. فقط ردیف‌های بودجه برنامه‌ای (نه اداری) شامل می‌شود.
formula: (actual_expenditure / allocated_budget) * 100
unit_of_measure: درصد
direction: target_based
aggregation: last_value
period_grain: quarterly
source_field: bpms.report_form.section1.field_009
owner_unit: معاونت مالی
target_source: TBD — هدف پیشنهادی ۸۵–۱۰۰٪ (هم کم‌خرجی هم اضافه‌خرجی نامطلوب است)
allow_negative: false
version: 1
effective_from: "1405-01-01"
effective_to: null
interpretation_traps:
  - اجرای ۱۰۰٪ بودجه لزوماً خوب نیست — پول ممکن است صرف فعالیت‌های کم‌اثر شده باشد.
  - تفاوت «تعهد» (commitment) و «پرداخت» (payment) مهم است؛ تعریف باید صریح باشد [TBD].
  - نمایندگی‌هایی که بودجه تخصیص‌شده کمتری دارند ممکن است اجرای درصدی بالاتری نشان دهند.
notes: این شاخص نیازمند دسترسی به داده مالی سازمان است که ممکن است در BPMS نباشد [TBD].
```

---

#### IND-HQ-0010 — تعداد مخاطبان شبکه‌های اجتماعی

```yaml
indicator_id: IND-HQ-0010
name_fa: تعداد مخاطبان/دنبال‌کنندگان رسانه‌های اجتماعی
name_en: Social Media Followers / Reach
definition: >
  مجموع دنبال‌کنندگان حساب‌های رسمی نمایندگی در پایان دوره گزارش (نه مجموع رشد).
  حساب‌هایی که نمایندگی مالک یا مدیر رسمی آنهاست شامل می‌شود.
formula: sum(follower_count FOR accounts WHERE owner=unit AND snapshot_date = last_day_of_period)
unit_of_measure: نفر
direction: higher_is_better
aggregation: last_value
period_grain: quarterly
source_field: bpms.report_form.section1.field_010
owner_unit: معاونت رسانه
target_source: TBD
allow_negative: false
version: 1
effective_from: "1405-01-01"
effective_to: null
interpretation_traps:
  - دنبال‌کننده با مخاطب فعال یکی نیست — نرخ تعامل (engagement rate) جداگانه باید پایش شود.
  - پلتفرم‌های مختلف (اینستاگرام، یوتیوب، تلگرام) مقایسه‌پذیر نیستند — جمع‌آوری آنها گمراه‌کننده است مگر اینکه صریحاً پذیرفته شده باشد.
  - تعداد دنبال‌کننده تحت تأثیر محدودیت‌های پلتفرم در کشور میزبان است که خارج از کنترل واحد است.
notes: برای نمایندگی‌هایی که در کشور میزبان محدودیت شبکه‌های اجتماعی وجود دارد، این شاخص ممکن است قابل اجرا نباشد [TBD].
```

---

#### IND-HQ-0011 — تعداد گزارش‌های تحلیلی ارسالی به ستاد

```yaml
indicator_id: IND-HQ-0011
name_fa: تعداد گزارش‌های تحلیلی ارسالی به ستاد
name_en: Number of Analytical Reports Submitted to HQ
definition: >
  تعداد گزارش‌های تحلیلی (کشوری، موضوعی، رصدی) که نمایندگی در این دوره
  به‌صورت رسمی به ستاد ارسال کرده و در سیستم ثبت شده‌اند.
  گزارش‌های دوره‌ای اجباری (این فرم) جداگانه شمرده می‌شوند و شامل نمی‌شوند.
formula: count(reports WHERE type='analytical' AND submitted_to='HQ' AND submission_date IN period AND status='received')
unit_of_measure: عدد
direction: higher_is_better
aggregation: sum
period_grain: quarterly
source_field: bpms.report_form.section1.field_011
owner_unit: معاونت پژوهش و رصد
target_source: TBD
allow_negative: false
version: 1
effective_from: "1405-01-01"
effective_to: null
interpretation_traps:
  - یک گزارش عمیق ۵۰ صفحه‌ای با یک یادداشت ۲ صفحه‌ای هر دو «۱» می‌شوند.
  - انگیزه گزارش‌دهی کمّی (برای رسیدن به هدف) ممکن است کیفیت را پایین بیاورد.
notes: TBD
```

---

#### IND-HQ-0012 — درصد به‌موقع بودن گزارش‌دهی دوره‌ای

```yaml
indicator_id: IND-HQ-0012
name_fa: درصد به‌موقع بودن گزارش‌دهی دوره‌ای
name_en: Reporting Timeliness Rate
definition: >
  نسبت تعداد گزارش‌های دوره‌ای ارسال‌شده در مهلت مقرر به تعداد کل گزارش‌های
  موظف آن دوره، بیان‌شده به درصد.
  «مهلت مقرر» تاریخی است که توسط معاونت برنامه‌ریزی برای آن دوره اعلام می‌شود.
formula: (count(submissions WHERE submitted_at <= deadline) / count(required_submissions)) * 100
unit_of_measure: درصد
direction: higher_is_better
aggregation: last_value
period_grain: quarterly
source_field: محاسبه‌شده توسط سیستم — نه ورودی دستی
owner_unit: معاونت برنامه‌ریزی
target_source: TBD — هدف پیشنهادی ≥ ۹۰٪
allow_negative: false
version: 1
effective_from: "1405-01-01"
effective_to: null
interpretation_traps:
  - «به‌موقع» بودن کیفیت گزارش را نمی‌سنجد — گزارش ناقص ارسال‌شده در مهلت هم ۱۰۰٪ می‌دهد.
notes: این شاخص توسط سیستم محاسبه می‌شود، نه توسط واحد — واحد نمی‌تواند آن را دستکاری کند. این یکی از اولین شاخص‌های داشبورد L0 است.
```

---

#### IND-HQ-0013 — تعداد نمایشگاه‌ها و حضور در رویدادهای بین‌المللی

```yaml
indicator_id: IND-HQ-0013
name_fa: تعداد نمایشگاه‌ها و حضور در رویدادهای بین‌المللی
name_en: International Exhibition and Event Presence
definition: >
  تعداد نمایشگاه‌ها، جشنواره‌ها، یا رویدادهای بین‌المللی که سازمان در آنها
  با غرفه، بخش، یا حضور رسمی شرکت کرده است.
  حضور صرفاً برای بازدید (بدون غرفه یا نقش رسمی) شامل نمی‌شود.
formula: count(events WHERE type IN ('exhibition','festival','international_event') AND participation_type != 'visitor' AND date IN period)
unit_of_measure: عدد
direction: higher_is_better
aggregation: sum
period_grain: quarterly
source_field: bpms.report_form.section1.field_013
owner_unit: معاونت بین‌الملل
target_source: TBD
allow_negative: false
version: 1
effective_from: "1405-01-01"
effective_to: null
interpretation_traps:
  - حضور در یک نمایشگاه ملی کشور میزبان و حضور در نمایشگاه بین‌المللی وزن یکسانی ندارند.
notes: TBD
```

---

#### IND-HQ-0014 — تعداد بورس و فرصت‌های تحصیلی اعطاشده

```yaml
indicator_id: IND-HQ-0014
name_fa: تعداد بورس و فرصت‌های تحصیلی اعطاشده
name_en: Number of Scholarships and Study Opportunities Granted
definition: >
  تعداد بورس‌های تحصیلی، فرصت‌های مطالعاتی، یا دوره‌های تخصصی که در این دوره
  به اتباع کشور میزبان اعطا شده‌اند (نه فقط معرفی‌شده‌اند).
  «اعطاشده» یعنی قرارداد امضا شده یا حکم رسمی صادر شده است.
formula: count(scholarships WHERE status='granted' AND grant_date IN period)
unit_of_measure: عدد
direction: higher_is_better
aggregation: sum
period_grain: quarterly
source_field: bpms.report_form.section1.field_014
owner_unit: معاونت دانشجویی و آموزشی
target_source: TBD
allow_negative: false
version: 1
effective_from: "1405-01-01"
effective_to: null
interpretation_traps:
  - بورس اعطاشده با بورس استفاده‌شده یکی نیست — برخی دریافت‌کنندگان ممکن است نروند.
  - بورس یک‌ساله و بورس یک‌ماهه در این شاخص برابرند.
notes: TBD
```

---

#### IND-HQ-0015 — تعداد مخاطبان ایرانی ساکن کشور میزبان در تماس با سازمان

```yaml
indicator_id: IND-HQ-0015
name_fa: تعداد ایرانیان مقیم دریافت‌کننده خدمات فرهنگی
name_en: Iranian Diaspora Reached by Cultural Services
definition: >
  تعداد افراد ایرانی مقیم (دارای شناسنامه ایرانی یا دوتابعیتی با تأیید نمایندگی)
  که در این دوره حداقل یک بار از خدمات یا رویدادهای فرهنگی نمایندگی استفاده کرده‌اند.
  هر فرد یک بار شمرده می‌شود — نفر یکتا است، نه نفر-بار.
formula: count(DISTINCT person_id WHERE is_iranian=true AND service_date IN period)
unit_of_measure: نفر یکتا
direction: higher_is_better
aggregation: sum
period_grain: quarterly
source_field: bpms.report_form.section1.field_015
owner_unit: معاونت ایرانیان خارج از کشور
target_source: TBD
allow_negative: false
version: 1
effective_from: "1405-01-01"
effective_to: null
interpretation_traps:
  - شناسایی «ایرانی مقیم» در برخی کشورها حساسیت حریم خصوصی دارد — باید با مشاوره حقوقی طراحی شود.
  - این شاخص به سیستم ثبت مخاطبان نیاز دارد که ممکن است هنوز وجود نداشته باشد.
notes: این شاخص پیچیدگی داده بیشتری از بقیه دارد و ممکن است در فاز اول حذف یا ساده‌سازی شود [TBD].
```

---

## ۶. جدول خلاصه کاتالوگ

| شناسه | نام | واحد سنجش | جهت | دانه‌بندی | مالک |
|---|---|---|---|---|---|
| IND-HQ-0001 | رویدادهای فرهنگی برگزارشده | عدد | ↑ | فصلی | برنامه‌ریزی |
| IND-HQ-0002 | شرکت‌کنندگان رویدادهای فرهنگی | نفر-بار | ↑ | فصلی | برنامه‌ریزی |
| IND-HQ-0003 | درصد اجرای برنامه سالانه | درصد | ↑ | فصلی | برنامه‌ریزی |
| IND-HQ-0004 | توافقنامه‌ها و تفاهم‌نامه‌ها | عدد | ↑ | فصلی | بین‌الملل |
| IND-HQ-0005 | دوره‌های آموزشی و کارگاه‌ها | عدد | ↑ | فصلی | آموزش |
| IND-HQ-0006 | شرکت‌کنندگان دوره‌های آموزشی | نفر-بار | ↑ | فصلی | آموزش |
| IND-HQ-0007 | انتشارات فرهنگی | عدد | ↑ | فصلی | انتشارات |
| IND-HQ-0008 | نشست‌های دیپلماسی فرهنگی | عدد | ↑ | فصلی | بین‌الملل |
| IND-HQ-0009 | درصد اجرای بودجه برنامه‌ای | درصد | هدف‌محور | فصلی | مالی |
| IND-HQ-0010 | دنبال‌کنندگان شبکه اجتماعی | نفر | ↑ | فصلی | رسانه |
| IND-HQ-0011 | گزارش‌های تحلیلی ارسالی | عدد | ↑ | فصلی | پژوهش |
| IND-HQ-0012 | درصد به‌موقع بودن گزارش‌دهی | درصد | ↑ | فصلی | برنامه‌ریزی |
| IND-HQ-0013 | حضور در رویدادهای بین‌المللی | عدد | ↑ | فصلی | بین‌الملل |
| IND-HQ-0014 | بورس‌ها و فرصت‌های تحصیلی | عدد | ↑ | فصلی | دانشجویی |
| IND-HQ-0015 | ایرانیان مقیم دریافت‌کننده خدمات | نفر یکتا | ↑ | فصلی | ایرانیان خارج |
