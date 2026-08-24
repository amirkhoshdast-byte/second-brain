-- =============================================================
-- warehouse.sql — Schema انبار داده (مدل ستاره‌ای)
-- =============================================================
-- مبنای داشبورد مدیریتی، AI، و گزارش‌های تجمیعی.
-- داده از validated schema بارگذاری می‌شود.
-- فقط رکوردهای با status='approved' به اینجا می‌آیند.
-- =============================================================

CREATE SCHEMA IF NOT EXISTS warehouse;

-- =============================================================
-- ابعاد (Dimensions)
-- =============================================================

-- -------------------------------------------------------------
-- warehouse.dim_unit
-- -------------------------------------------------------------
CREATE TABLE warehouse.dim_unit (
    unit_id             varchar(20) PRIMARY KEY,
    unit_name_fa        varchar(200) NOT NULL,
    unit_name_en        varchar(200),
    unit_type           varchar(50) NOT NULL
                            CHECK (unit_type IN ('headquarter','representation','bureau','other')),
    parent_unit_id      varchar(20) REFERENCES warehouse.dim_unit(unit_id),
    country_code        char(2),                    -- ISO 3166-1 alpha-2
    is_active           boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dw_unit_type ON warehouse.dim_unit (unit_type);
CREATE INDEX idx_dw_unit_country ON warehouse.dim_unit (country_code);

-- -------------------------------------------------------------
-- warehouse.dim_period
-- -------------------------------------------------------------
CREATE TABLE warehouse.dim_period (
    period_id           varchar(10) PRIMARY KEY,    -- 1405-Q1 | 1405-M01 | 1405
    period_type         varchar(10) NOT NULL CHECK (period_type IN ('annual','quarterly','monthly')),
    year_shamsi         smallint NOT NULL,
    quarter_num         smallint CHECK (quarter_num BETWEEN 1 AND 4),
    month_num           smallint CHECK (month_num BETWEEN 1 AND 12),
    start_date          date NOT NULL,
    end_date            date NOT NULL,
    deadline_submission date NOT NULL,
    CONSTRAINT chk_period_quarterly CHECK (
        period_type != 'quarterly' OR quarter_num IS NOT NULL
    ),
    CONSTRAINT chk_period_monthly CHECK (
        period_type != 'monthly' OR month_num IS NOT NULL
    )
);

-- seed داده برای ۱۴۰۵ — فصل‌های شمسی (تاریخ‌های دقیق TBD با کتابخانه تقویم)
INSERT INTO warehouse.dim_period VALUES
    ('1405',    'annual',    1405, NULL, NULL, '2026-03-21', '2027-03-20', '2027-04-04'),
    ('1405-Q1', 'quarterly', 1405,    1, NULL, '2026-03-21', '2026-06-21', '2026-07-06'),
    ('1405-Q2', 'quarterly', 1405,    2, NULL, '2026-06-22', '2026-09-22', '2026-10-07'),
    ('1405-Q3', 'quarterly', 1405,    3, NULL, '2026-09-23', '2026-12-21', '2027-01-05'),
    ('1405-Q4', 'quarterly', 1405,    4, NULL, '2026-12-22', '2027-03-20', '2027-04-04')
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------
-- warehouse.dim_indicator
-- -------------------------------------------------------------
CREATE TABLE warehouse.dim_indicator (
    indicator_id        varchar(20) NOT NULL,
    indicator_version   smallint NOT NULL DEFAULT 1,
    name_fa             varchar(300) NOT NULL,
    name_en             varchar(300),
    definition          text NOT NULL,
    formula             text,
    unit_of_measure     varchar(50) NOT NULL,
    direction           varchar(20) NOT NULL
                            CHECK (direction IN ('higher_is_better','lower_is_better','target_based','neutral')),
    aggregation         varchar(20) NOT NULL
                            CHECK (aggregation IN ('sum','count','average','max','min','last_value')),
    period_grain        varchar(20) NOT NULL CHECK (period_grain IN ('monthly','quarterly','annual')),
    allow_negative      boolean NOT NULL DEFAULT false,
    owner_unit_id       varchar(20) REFERENCES warehouse.dim_unit(unit_id),
    source_field        varchar(200),
    effective_from      date NOT NULL,
    effective_to        date,
    is_current          boolean NOT NULL DEFAULT true,
    PRIMARY KEY (indicator_id, indicator_version)
);

CREATE INDEX idx_dw_indicator_current ON warehouse.dim_indicator (indicator_id) WHERE is_current = true;
CREATE INDEX idx_dw_indicator_owner ON warehouse.dim_indicator (owner_unit_id);

-- -------------------------------------------------------------
-- warehouse.dim_program
-- -------------------------------------------------------------
CREATE TABLE warehouse.dim_program (
    program_id          varchar(20) PRIMARY KEY,
    program_name_fa     varchar(300) NOT NULL,
    budget_year_shamsi  smallint,
    owner_unit_id       varchar(20) REFERENCES warehouse.dim_unit(unit_id),
    is_active           boolean NOT NULL DEFAULT true
);

-- -------------------------------------------------------------
-- warehouse.dim_project
-- -------------------------------------------------------------
CREATE TABLE warehouse.dim_project (
    project_id          varchar(20) PRIMARY KEY,
    project_name_fa     varchar(300) NOT NULL,
    unit_id             varchar(20) REFERENCES warehouse.dim_unit(unit_id),
    program_id          varchar(20) REFERENCES warehouse.dim_program(program_id),
    planned_start       date,
    planned_end         date,
    is_active           boolean NOT NULL DEFAULT true
);

-- -------------------------------------------------------------
-- warehouse.dim_person — فقط نقش، بدون ارزیابی فردی
-- -------------------------------------------------------------
CREATE TABLE warehouse.dim_person (
    person_id           varchar(20) PRIMARY KEY,
    display_name        varchar(200) NOT NULL,
    unit_id             varchar(20) REFERENCES warehouse.dim_unit(unit_id),
    role                varchar(100),
    is_active           boolean NOT NULL DEFAULT true
);

-- =============================================================
-- واقعیت‌ها (Facts)
-- =============================================================

-- -------------------------------------------------------------
-- warehouse.fact_submission
-- -------------------------------------------------------------
CREATE TABLE warehouse.fact_submission (
    submission_id       varchar(30) PRIMARY KEY,
    unit_id             varchar(20) NOT NULL REFERENCES warehouse.dim_unit(unit_id),
    period_id           varchar(10) NOT NULL REFERENCES warehouse.dim_period(period_id),
    submitted_by        varchar(20) REFERENCES warehouse.dim_person(person_id),
    submitted_at        timestamptz NOT NULL,
    is_amendment        boolean NOT NULL DEFAULT false,
    amendment_ref       varchar(30) REFERENCES warehouse.fact_submission(submission_id),
    status              varchar(20) NOT NULL
                            CHECK (status IN ('submitted','under_review','approved','rejected')),
    approved_by         varchar(20) REFERENCES warehouse.dim_person(person_id),
    approved_at         timestamptz,
    timeliness_flag     boolean,
    completeness_score  smallint,
    classification      varchar(20) NOT NULL
                            CHECK (classification IN ('public','internal','restricted','confidential')),
    source_system       varchar(50) NOT NULL,
    source_ref          varchar(200),
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dw_submission_unit_period ON warehouse.fact_submission (unit_id, period_id);
CREATE INDEX idx_dw_submission_status ON warehouse.fact_submission (status, period_id);
CREATE INDEX idx_dw_submission_timeliness ON warehouse.fact_submission (timeliness_flag, period_id);

-- -------------------------------------------------------------
-- warehouse.fact_indicator_value
-- -------------------------------------------------------------
CREATE TABLE warehouse.fact_indicator_value (
    value_id            bigserial PRIMARY KEY,
    submission_id       varchar(30) NOT NULL REFERENCES warehouse.fact_submission(submission_id),
    indicator_id        varchar(20) NOT NULL,
    indicator_version   smallint NOT NULL DEFAULT 1,
    unit_id             varchar(20) NOT NULL REFERENCES warehouse.dim_unit(unit_id),
    period_id           varchar(10) NOT NULL REFERENCES warehouse.dim_period(period_id),
    program_id          varchar(20) REFERENCES warehouse.dim_program(program_id),
    value_actual        numeric(18, 4) NOT NULL,
    value_target        numeric(18, 4),
    unit_of_measure     varchar(50) NOT NULL,
    data_source         varchar(200),
    note                varchar(500),
    is_anomaly_flagged  boolean NOT NULL DEFAULT false,
    anomaly_pct_change  numeric(8, 2),
    created_at          timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (indicator_id, indicator_version)
        REFERENCES warehouse.dim_indicator(indicator_id, indicator_version),
    UNIQUE (submission_id, indicator_id)
);

CREATE INDEX idx_dw_fiv_indicator_period ON warehouse.fact_indicator_value (indicator_id, period_id);
CREATE INDEX idx_dw_fiv_unit_period ON warehouse.fact_indicator_value (unit_id, period_id);
CREATE INDEX idx_dw_fiv_anomaly ON warehouse.fact_indicator_value (is_anomaly_flagged) WHERE is_anomaly_flagged = true;

-- -------------------------------------------------------------
-- warehouse.fact_project_status
-- -------------------------------------------------------------
CREATE TABLE warehouse.fact_project_status (
    status_id           bigserial PRIMARY KEY,
    submission_id       varchar(30) NOT NULL REFERENCES warehouse.fact_submission(submission_id),
    project_id          varchar(20) NOT NULL REFERENCES warehouse.dim_project(project_id),
    unit_id             varchar(20) NOT NULL REFERENCES warehouse.dim_unit(unit_id),
    period_id           varchar(10) NOT NULL REFERENCES warehouse.dim_period(period_id),
    progress_pct        smallint NOT NULL CHECK (progress_pct BETWEEN 0 AND 100),
    status              varchar(20) NOT NULL
                            CHECK (status IN ('on_track','at_risk','delayed','completed','suspended','not_started')),
    milestone_reached   varchar(300),
    next_milestone      varchar(300),
    projected_completion date,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (submission_id, project_id)
);

CREATE INDEX idx_dw_fps_status ON warehouse.fact_project_status (status, period_id);
CREATE INDEX idx_dw_fps_project ON warehouse.fact_project_status (project_id, period_id);

-- -------------------------------------------------------------
-- warehouse.fact_obstacle
-- -------------------------------------------------------------
CREATE TABLE warehouse.fact_obstacle (
    obstacle_id         bigserial PRIMARY KEY,
    submission_id       varchar(30) NOT NULL REFERENCES warehouse.fact_submission(submission_id),
    unit_id             varchar(20) NOT NULL REFERENCES warehouse.dim_unit(unit_id),
    period_id           varchar(10) NOT NULL REFERENCES warehouse.dim_period(period_id),
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
    affected_project_id   varchar(20) REFERENCES warehouse.dim_project(project_id),
    proposed_action     varchar(500),
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dw_obstacle_category ON warehouse.fact_obstacle (category, period_id);
CREATE INDEX idx_dw_obstacle_severity ON warehouse.fact_obstacle (severity) WHERE severity IN ('high','critical');

-- -------------------------------------------------------------
-- warehouse.bridge_report_document
-- پل بین گزارش (محصول B) و سند دانشی (محصول A)
-- این جدول از روز اول باید وجود داشته باشد — بدون آن اتصال دو محصول ممکن نیست.
-- -------------------------------------------------------------
CREATE TABLE warehouse.bridge_report_document (
    bridge_id           bigserial PRIMARY KEY,
    submission_id       varchar(30) NOT NULL REFERENCES warehouse.fact_submission(submission_id),
    document_id         varchar(200) NOT NULL,  -- شناسه سند در محصول A (Obsidian path یا Qdrant id)
    document_type       varchar(30) NOT NULL
                            CHECK (document_type IN ('narrative','attachment','obstacle_text')),
    section             smallint NOT NULL CHECK (section BETWEEN 3 AND 5),
                            -- 3=موانع, 4=روایت, 5=پیوست
    ingested_at_product_a timestamptz,          -- زمان ورود به محصول A
    qdrant_vector_id    varchar(200),           -- شناسه در Qdrant پس از embedding
    obsidian_path       varchar(500),           -- مسیر Note در Obsidian (اگر موجود)
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dw_bridge_submission ON warehouse.bridge_report_document (submission_id);
CREATE INDEX idx_dw_bridge_document ON warehouse.bridge_report_document (document_id);
