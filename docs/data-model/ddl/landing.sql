-- =============================================================
-- landing.sql — Schema خام ورودی داده
-- =============================================================
-- این schema داده را دقیقاً همانطور که از BPMS یا فرم گزارش
-- می‌آید ذخیره می‌کند. هیچ تبدیل یا اعتبارسنجی اینجا انجام نمی‌شود.
-- append-only: رکوردهای این schema هرگز به‌روز یا حذف نمی‌شوند.
-- =============================================================

CREATE SCHEMA IF NOT EXISTS landing;

-- -------------------------------------------------------------
-- landing.raw_submission
-- هر بار که یک گزارش از BPMS یا فرم موازی وارد می‌شود، یک ردیف
-- -------------------------------------------------------------
CREATE TABLE landing.raw_submission (
    raw_id              bigserial PRIMARY KEY,
    ingested_at         timestamptz NOT NULL DEFAULT now(),
    source_system       varchar(50) NOT NULL,       -- 'bpms', 'parallel_form', 'csv_import'
    source_ref          varchar(200),               -- شناسه داخلی BPMS
    ingestion_method    varchar(20) NOT NULL,       -- 'api', 'db_view', 'csv', 'webhook'
    payload             jsonb NOT NULL,             -- کل payload خام بدون تغییر
    unit_id_raw         varchar(100),               -- واحد همانطور که در منبع آمده (قبل از نرمال‌سازی)
    period_id_raw       varchar(50),                -- دوره همانطور که در منبع آمده
    submitted_by_raw    varchar(200),
    submitted_at_raw    timestamptz,
    processing_status   varchar(20) NOT NULL DEFAULT 'pending'
                            CHECK (processing_status IN ('pending','processing','validated','failed')),
    processing_error    text,
    processed_at        timestamptz
);

CREATE INDEX idx_landing_raw_submission_status ON landing.raw_submission (processing_status, ingested_at);
CREATE INDEX idx_landing_raw_submission_source ON landing.raw_submission (source_system, source_ref);

-- -------------------------------------------------------------
-- landing.raw_indicator_value
-- مقادیر شاخص‌ها همانطور که از فرم آمده‌اند
-- -------------------------------------------------------------
CREATE TABLE landing.raw_indicator_value (
    raw_value_id        bigserial PRIMARY KEY,
    raw_submission_id   bigint NOT NULL REFERENCES landing.raw_submission(raw_id),
    ingested_at         timestamptz NOT NULL DEFAULT now(),
    indicator_id_raw    varchar(100),               -- شناسه شاخص همانطور که در فرم بوده
    value_actual_raw    varchar(100),               -- مقدار به‌صورت متن خام (قبل از تبدیل به عدد)
    value_target_raw    varchar(100),
    unit_of_measure_raw varchar(50),
    data_source_raw     varchar(200),
    note_raw            text,
    validation_status   varchar(20) NOT NULL DEFAULT 'pending'
                            CHECK (validation_status IN ('pending','valid','invalid','warning'))
);

CREATE INDEX idx_landing_raw_ind_val_submission ON landing.raw_indicator_value (raw_submission_id);

-- -------------------------------------------------------------
-- landing.raw_project_status
-- وضعیت پروژه‌ها همانطور که از فرم آمده
-- -------------------------------------------------------------
CREATE TABLE landing.raw_project_status (
    raw_project_id      bigserial PRIMARY KEY,
    raw_submission_id   bigint NOT NULL REFERENCES landing.raw_submission(raw_id),
    ingested_at         timestamptz NOT NULL DEFAULT now(),
    project_id_raw      varchar(100),
    progress_pct_raw    varchar(10),
    status_raw          varchar(50),
    milestone_reached   text,
    next_milestone      text,
    projected_completion_raw varchar(50),
    validation_status   varchar(20) NOT NULL DEFAULT 'pending'
                            CHECK (validation_status IN ('pending','valid','invalid','warning'))
);

-- -------------------------------------------------------------
-- landing.raw_obstacle
-- موانع و ریسک‌ها همانطور که از فرم آمده
-- -------------------------------------------------------------
CREATE TABLE landing.raw_obstacle (
    raw_obstacle_id     bigserial PRIMARY KEY,
    raw_submission_id   bigint NOT NULL REFERENCES landing.raw_submission(raw_id),
    ingested_at         timestamptz NOT NULL DEFAULT now(),
    category_raw        varchar(50),
    severity_raw        varchar(20),
    status_raw          varchar(20),
    description         text,
    affected_indicator_id_raw varchar(100),
    affected_project_id_raw   varchar(100),
    proposed_action     text,
    validation_status   varchar(20) NOT NULL DEFAULT 'pending'
                            CHECK (validation_status IN ('pending','valid','invalid','warning'))
);

-- -------------------------------------------------------------
-- landing.raw_document
-- پیوست‌ها و مدارک همراه فرم
-- -------------------------------------------------------------
CREATE TABLE landing.raw_document (
    raw_document_id     bigserial PRIMARY KEY,
    raw_submission_id   bigint NOT NULL REFERENCES landing.raw_submission(raw_id),
    ingested_at         timestamptz NOT NULL DEFAULT now(),
    file_name           varchar(500),
    file_type           varchar(20),
    file_size_bytes     bigint,
    storage_path        text,                       -- مسیر در Object Storage
    description         varchar(500),
    classification_raw  varchar(30),
    ingestion_status    varchar(20) NOT NULL DEFAULT 'pending'
                            CHECK (ingestion_status IN ('pending','ingested_a','failed'))
                            -- ingested_a = وارد محصول A شده
);
