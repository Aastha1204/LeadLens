-- LeadLens schema (Postgres / Supabase). Compatible with the shared Neovia lead table.
-- Not executed in the v1 demo; displayed in the trace drawer and validated by tests.

create table client (
  id               text primary key,
  name             text not null,
  city             text not null,
  industry         text not null,
  plan             text not null check (plan in ('care_basic', 'care_growth', 'leadlens')),
  logo_url         text,
  report_day       int  not null default 1 check (report_day between 1 and 28),
  review_required  boolean not null default true,
  onboarded_month  date not null
);

create table connector (
  id            text primary key,
  client_id     text not null references client (id),
  type          text not null check (type in
                  ('website_forms', 'whatsapp_bot', 'meta_lead_ads', 'callcatch', 'slotpay', 'gbp_manual', 'google_sheet')),
  config_json   jsonb not null default '{}'::jsonb,
  last_sync_at  timestamptz,
  status        text not null check (status in ('healthy', 'warning', 'failed')),
  message       text not null default ''
);

-- Every enquiry exactly as received, before de-duplication.
create table raw_enquiry (
  id                text primary key,
  client_id         text not null references client (id),
  source            text not null check (source in ('instagram', 'google', 'calls', 'website', 'whatsapp')),
  source_record_id  text not null,
  phone_hash        text not null,           -- SHA-256(E.164 number || per-client salt)
  payload           jsonb not null default '{}'::jsonb,
  received_at       timestamptz not null
);
create index raw_enquiry_client_phone_idx on raw_enquiry (client_id, phone_hash);

-- One row per unique enquiry (raw enquiries sharing a phone_hash within 30 days are merged; first touch wins).
create table lead (
  id                 text primary key,
  number             int  not null,
  client_id          text not null references client (id),
  source             text not null check (source in ('instagram', 'google', 'calls', 'website', 'whatsapp')),
  campaign           text not null,
  created_at         timestamptz not null,
  first_response_at  timestamptz,
  site_visit_at      timestamptz,
  closed_at          timestamptz,
  stage              text not null check (stage in ('new', 'contacted', 'site_visit', 'won', 'lost')),
  deal_value         numeric(12, 0),
  outcome_reason     text check (outcome_reason in ('price', 'timeline', 'competitor', 'area', 'no_response', 'other')),
  phone_hash         text not null,
  name_masked        text not null,
  phone_masked       text not null,
  locality           text,
  requirement        text,
  property           text,
  budget_band        text,
  owner              text,
  merged_raw_ids     text[] not null default '{}',
  unique (client_id, number)
);
create index lead_client_created_idx on lead (client_id, created_at);

create table ad_spend (
  id         text primary key,
  client_id  text not null references client (id),
  month      date not null,
  platform   text not null check (platform in ('meta', 'google')),
  amount     numeric(12, 0) not null,
  unique (client_id, month, platform)
);

create table care_activity (
  id         text primary key,
  client_id  text not null references client (id),
  month      date not null,
  type       text not null check (type in ('post', 'update', 'fix', 'uptime')),
  count      numeric(8, 2) not null,         -- uptime is stored as a percentage, e.g. 99.97
  unique (client_id, month, type)
);

create table gbp_metrics (
  client_id         text not null references client (id),
  month             date not null,
  calls             int not null,
  direction_requests int not null,
  website_clicks    int not null,
  source            text not null check (source in ('api', 'manual')),
  primary key (client_id, month)
);

create table monthly_report (
  id                             text primary key,   -- e.g. LL-UN-2026-10
  client_id                      text not null references client (id),
  month                          date not null,
  metrics_json                   jsonb,
  narrative_json                 jsonb,
  narrative_source               text not null default 'template' check (narrative_source in ('llm', 'template')),
  guard_result                   jsonb,
  pdf_url                        text,
  status                         text not null check (status in ('generated', 'in_review', 'approved', 'sent', 'blocked')),
  generated_at                   timestamptz,
  sent_at                        timestamptz,
  data_changed_since_generation  boolean not null default false,
  unique (client_id, month)
);
