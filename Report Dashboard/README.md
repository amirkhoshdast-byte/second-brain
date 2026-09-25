# Report Dashboard — محصول B: گزارش‌دهی و ارزیابی ماهانه واحدها

داشبوردی که گزارش ماهانه واحدها را از BPMS (به‌صورت Word در قالب مشخص) دریافت، استخراج، اعتبارسنجی و با AI تحلیل می‌کند و کارنامه ماهانه هر واحد را می‌سازد.

## مستندات — `docs/`

| فایل | محتوا |
|---|---|
| [`PRODUCT.md`](./docs/PRODUCT.md) | تعریف محصول، کاربران، نقش مجاز/ممنوع AI |
| [`ROADMAP.md`](./docs/ROADMAP.md) | نقشه ویژگی‌ها، فازها و معیار پذیرش |
| [`TECH_ARCHITECTURE.md`](./docs/TECH_ARCHITECTURE.md) | زبان‌ها، معماری، جداول جدید، امنیت، تست |
| [`WORD_TEMPLATE_SPEC.md`](./docs/WORD_TEMPLATE_SPEC.md) | قالب Word با Content Control و نگاشت به landing |
| [`BPMS_INTEGRATION.md`](./docs/BPMS_INTEGRATION.md) | الگوی اتصال به BPMS و تقویم ماهانه |
| [`REPORT_FORM_SPEC.md`](./docs/REPORT_FORM_SPEC.md) · [`ONEPAGER`](./docs/REPORT_FORM_SPEC_ONEPAGER.md) | فرم پنج‌بخشی گزارش |
| [`METRIC_LAYER.md`](./docs/METRIC_LAYER.md) | کاتالوگ شاخص‌ها |
| [`DATA_MODEL.md`](./docs/DATA_MODEL.md) | مدل داده سه‌لایه و star schema |
| [`EVALUATION_MODEL.md`](./docs/EVALUATION_MODEL.md) | فرمول کارنامه ماهانه، رتبه‌بندی، اعتراض |
| [`DASHBOARD_SPEC.md`](./docs/DASHBOARD_SPEC.md) | لایه‌های L0–L5 داشبورد و API |

## اسناد مشترک پلتفرم (در `../docs/`)

[`INTEGRATION_CONTRACT.md`](../docs/INTEGRATION_CONTRACT.md) · [`ASSUMPTIONS.md`](../docs/ASSUMPTIONS.md) · [`PLATFORM.md`](../docs/PLATFORM.md) · DDL: [`data-model/ddl/`](../docs/data-model/ddl/)
