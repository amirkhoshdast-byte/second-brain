-- ═══════════════════════════════════════════════════════════════════════════
-- اسکیمای intel — خروجی خط لوله‌ی استخراج محصول A
--
-- جدا از landing/validated/warehouse نگه داشته شده چون آن‌ها مدل گزارش‌دهی
-- عملکرد واحدها (محصول B) هستند و چرخه‌ی عمر متفاوتی دارند.
--
-- زنجیره: سند خام → استخراج ساخت‌یافته → اشاره‌ها → هوش میان‌گزارشی
-- ═══════════════════════════════════════════════════════════════════════════

create schema if not exists intel;

-- ─── سند و استخراج آن ─────────────────────────────────────────────────────
create table if not exists intel.document (
  id           bigserial primary key,
  path         text        not null unique,
  title        text        not null,
  folder       text,

  -- اثر انگشت متن؛ اگر سند عوض شود دوباره استخراج می‌شود
  content_hash text        not null,

  -- میدان‌های استخراج‌شده توسط مدل
  country      text,
  region       text,
  producer     text,               -- نمایندگی یا واحد ستادی تولیدکننده
  report_date  date,
  doc_type     text,               -- گزارش، تحلیل، خبر، سند رسمی
  source_name  text,
  source_url   text,
  ai_summary   text,
  confidence   numeric(4,3),       -- ۰ تا ۱، اطمینان خود مدل به استخراج

  model        text not null,      -- کدام مدل استخراج کرد؛ برای بازتولیدپذیری
  extracted_at timestamptz not null default now()
);

create index if not exists document_country_idx on intel.document (country);
create index if not exists document_region_idx  on intel.document (region);
create index if not exists document_date_idx    on intel.document (report_date);

-- ─── موجودیت یکتا ─────────────────────────────────────────────────────────
-- نام موجودیت کلید یکتاست تا اشاره‌های چند سند به یک شخص، یک ردیف بماند؛
-- همین کار است که تحلیل میان‌گزارشی را ممکن می‌کند.
create table if not exists intel.entity (
  id    bigserial primary key,
  etype text not null check (etype in ('topic','person','org','event','country','religion')),
  name  text not null,
  unique (etype, name)
);

create index if not exists entity_type_idx on intel.entity (etype);

-- ─── اشاره‌ی سند به موجودیت ───────────────────────────────────────────────
create table if not exists intel.mention (
  document_id bigint not null references intel.document(id) on delete cascade,
  entity_id   bigint not null references intel.entity(id)   on delete cascade,
  salience    numeric(4,3),       -- چقدر محوری است، نه صرفاً ذکرشده
  primary key (document_id, entity_id)
);

create index if not exists mention_entity_idx on intel.mention (entity_id);

-- ─── هوش میان‌گزارشی ──────────────────────────────────────────────────────
-- سیگنال/روند/ریسک/فرصت/بینش همگی یک شکل دارند چون همه «استنتاج از چند
-- سند» هستند و فقط در نوع فرق می‌کنند.
create table if not exists intel.signal (
  id          bigserial primary key,
  stype       text not null check (stype in ('signal','trend','risk','opportunity','insight')),
  title       text not null,
  description text,
  country     text,
  topic       text,
  importance  text check (importance in ('بالا','متوسط','پایین')),
  confidence  numeric(4,3),
  direction   text check (direction in ('up','down','flat')),
  window_days int,
  created_at  timestamptz not null default now(),
  unique (stype, title)
);

create index if not exists signal_type_idx    on intel.signal (stype);
create index if not exists signal_country_idx on intel.signal (country);

-- شواهد پشتیبان هر استنتاج — بدون این، سیگنال ادعای بی‌پشتوانه است
create table if not exists intel.signal_evidence (
  signal_id   bigint not null references intel.signal(id)   on delete cascade,
  document_id bigint not null references intel.document(id) on delete cascade,
  primary key (signal_id, document_id)
);

-- ─── نماهای تجمیعی برای داشبورد ───────────────────────────────────────────
create or replace view intel.v_country_stats as
select
  d.country,
  count(distinct d.id)                                          as reports,
  count(distinct e.id) filter (where e.etype = 'topic')          as topics,
  count(distinct e.id) filter (where e.etype = 'person')         as persons,
  count(distinct e.id) filter (where e.etype = 'org')            as orgs,
  count(distinct e.id) filter (where e.etype = 'event')          as events,
  max(d.report_date)                                             as latest_report
from intel.document d
left join intel.mention m on m.document_id = d.id
left join intel.entity  e on e.id = m.entity_id
where d.country is not null
group by d.country;

create or replace view intel.v_topic_stats as
select
  e.name                                as topic,
  count(distinct m.document_id)         as reports,
  count(distinct d.country)             as countries,
  max(d.report_date)                    as latest_report
from intel.entity e
join intel.mention  m on m.entity_id = e.id
join intel.document d on d.id = m.document_id
where e.etype = 'topic'
group by e.name;
