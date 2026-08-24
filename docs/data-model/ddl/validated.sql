-- =============================================================
-- validated.sql — Schema اعتبارسنجی‌شده
-- =============================================================
-- داده پس از عبور از دروازه‌های کیفیت (DATA_MODEL.md بخش ۴)
-- و نرمال‌سازی شناسه‌ها، اما قبل از تبدیل به مدل ابعادی.
-- رکوردهای این schema ثابت می‌مانند؛ اصلاحیه با رکورد جدید.
-- =============================================================

CREATE SCHEMA IF NOT EXISTS validated;

-- -------------------------------------------------------------
-- validated.submission
-- گزارش تأیید‌شده با شناسه‌های نرمال‌شده
-- -------------------------------------------------------------
CREATE TABLE validated.submission (
    submission_id       varchar(30) PRIMARY KEY,    -- RPT-UNTxx-XXXX
    raw_submission_id   bigint NOT NULL,            -- ارجاع به landing
    unit_id             varchar(20) NOT NULL,       -- نرمال‌شده به شناسه Entity Registry
    period_id           varchar(10) NOT NULL,       -- نرمال‌شده به period_id استاندارد
    submitted_by        varchar(20),                -- person_id نرمال‌شده
    submitted_at        timestamptz NOT NULL,
    status              varchar(20) NOT NULL
                            CHECK (status IN ('submitted','under_review','approved','rejected')),
    is_amendment        boolean NOT NULL DEFAULT false,
    amendment_ref       varchar(30) REFERENCES validated.submission(submission_id),
    approved_by         varchar(20),
    approved_at         timestamptz,
    classification      varchar(20) NOT NULL
                            CHECK (classification IN ('public','internal','restricted','confidential')),
    -- provenance
    source_system       varchar(50) NOT NULL,
    source_ref          varchar(200),
    ingestion_method    varchar(20) NOT NULL,
    -- کیفیت
    completeness_score  smallint,                   -- ۰–۱۰۰
    timeliness_flag     boolean,                    -- true = به‌موقع ارسال شده
    validation_warnings jsonb,                      -- آرایه‌ای از هشدارهای دروازه کیفیت
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_val_submission_unit_period ON validated.submission (unit_id, period_id);
CREATE INDEX idx_val_submission_status ON validated.submission (status, period_id);

-- -------------------------------------------------------------
-- validated.indicator_value
-- مقادیر شاخص‌ها با نوع داده صحیح
-- -------------------------------------------------------------
CREATE TABLE validated.indicator_value (
    value_id            bigserial PRIMARY KEY,
    submission_id       varchar(30) NOT NULL REFERENCES validated.submission(submission_id),
    indicator_id        varchar(20) NOT NULL,       -- IND-HQ-XXXX
    unit_id             varchar(20) NOT NULL,
    period_id           varchar(10) NOT NULL,
    value_actual        numeric(18, 4) NOT NULL,
    value_target        numeric(18, 4),
    unit_of_measure     varchar(50) NOT NULL,
    data_source         varchar(200),
    note                varchar(500),
    -- وضعیت دروازه کیفیت
    is_negative_flagged boolean NOT NULL DEFAULT false,
    is_anomaly_flagged  boolean NOT NULL DEFAULT false,
    anomaly_pct_change  numeric(8, 2),              -- درصد تغییر نسبت به دوره مشابه قبل
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (submission_id, indicator_id)
);

CREATE INDEX idx_val_ind_value_indicator ON validated.indicator_value (indicator_id, period_id);
CREATE INDEX idx_val_ind_value_unit ON validated.indicator_value (unit_id, period_id);

-- -------------------------------------------------------------
-- validated.project_status
-- وضعیت پروژه‌ها با داده‌های نرمال‌شده
-- -------------------------------------------------------------
CREATE TABLE validated.project_status (
    status_id           bigserial PRIMARY KEY,
    submission_id       varchar(30) NOT NULL REFERENCES validated.submission(submission_id),
    project_id          varchar(20) NOT NULL,
    unit_id             varchar(20) NOT NULL,
    period_id           varchar(10) NOT NULL,
    progress_pct        smallint NOT NULL CHECK (progress_pct BETWEEN 0 AND 100),
    status              varchar(20) NOT NULL
                            CHECK (status IN ('on_track','at_risk','delayed','completed','suspended','not_started')),
    milestone_reached   varchar(300),
    next_milestone      varchar(300),
    projected_completion date,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (submission_id, project_id)
);

-- -------------------------------------------------------------
-- validated.obstacle
-- موانع با دسته‌بندی تأیید‌شده
-- -------------------------------------------------------------
CREATE TABLE validated.obstacle (
    obstacle_id         bigserial PRIMARY KEY,
    submission_id       varchar(30) NOT NULL REFERENCES validated.submission(submission_id),
    unit_id             varchar(20) NOT NULL,
    period_id           varchar(10) NOT NULL,
    category            varchar(30) NOT NULL
                            CHECK (category IN (
                                'budget','human_resource','regulatory','political',
                                'logistics','partner','internal_process','technical',
                                'information','external_event','capacity','other'
                            )),
    severity            varchar(10) NOT NULL CHECK (severity IN ('low','medium','high','critical')),
    status              varchar(20) NOT NULL CHECK (status IN ('new','ongoing','resolved')),
    description         text NOT NULL,
    affected_indicator_id varchar(20),
    affected_project_id   varchar(20),
    proposed_action     varchar(500),
    -- ارجاع به محصول A برای تحلیل متنی
    document_id_product_a varchar(100),            -- شناسه سند در محصول A پس از ingestion
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_val_obstacle_category ON validated.obstacle (category, period_id);
CREATE INDEX idx_val_obstacle_severity ON validated.obstacle (severity, period_id);
