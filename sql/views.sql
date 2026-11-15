-- Metric views. Every metric in src/lib/metrics/* mirrors one of these with identical semantics.
-- All views use security_invoker so the RLS policies in rls.sql apply to the caller.
-- Month = calendar month of lead.created_at in Asia/Kolkata (cohort basis).

-- @view v_lead_base
create view v_lead_base with (security_invoker = true) as
select
  l.*,
  (date_trunc('month', l.created_at at time zone 'Asia/Kolkata'))::date as month,
  extract(epoch from (l.first_response_at - l.created_at)) / 60.0       as response_min,
  -- the report goes out at 9:00 AM IST on the 1st of the following month
  ((date_trunc('month', l.created_at at time zone 'Asia/Kolkata') + interval '1 month' + interval '9 hours')
     at time zone 'Asia/Kolkata')                                       as report_time
from lead l;

-- @view v_monthly_headline
create view v_monthly_headline with (security_invoker = true) as
with leads as (
  select
    client_id,
    month,
    count(*)::int                                                       as enquiries,
    count(*) filter (where first_response_at is not null)::int          as contacted,
    count(*) filter (where site_visit_at is not null)::int              as site_visits,
    count(*) filter (where stage = 'won')::int                          as won,
    coalesce(sum(deal_value) filter (where stage = 'won'), 0)           as revenue_won,
    percentile_cont(0.5) within group (order by response_min::float8)   as median_response_min
  from v_lead_base
  group by client_id, month
),
raw as (
  select client_id,
         (date_trunc('month', received_at at time zone 'Asia/Kolkata'))::date as month,
         count(*)::int as raw_enquiries
  from raw_enquiry
  group by 1, 2
)
select
  l.client_id,
  l.month,
  coalesce(r.raw_enquiries, 0)                      as raw_enquiries,
  l.enquiries,
  coalesce(r.raw_enquiries, 0) - l.enquiries        as duplicates_merged,
  l.contacted,
  l.site_visits,
  l.won,
  l.revenue_won,
  l.median_response_min
from leads l
left join raw r using (client_id, month);

-- @view v_source_breakdown
create view v_source_breakdown with (security_invoker = true) as
select
  client_id,
  month,
  source,
  count(*)::int                                                         as enquiries,
  count(*) filter (where first_response_at is not null)::int            as contacted,
  count(*) filter (where stage = 'won')::int                            as won,
  coalesce(sum(deal_value) filter (where stage = 'won'), 0)             as revenue_won,
  round(100.0 * count(*) filter (where stage = 'won') / count(*), 1)    as conversion_pct
from v_lead_base
group by client_id, month, source;

-- @view v_weekly_enquiries
create view v_weekly_enquiries with (security_invoker = true) as
select
  client_id,
  month,
  ((extract(day from created_at at time zone 'Asia/Kolkata')::int - 1) / 7) + 1 as week_no,
  count(*)::int as enquiries
from v_lead_base
group by 1, 2, 3;

-- @view v_speed_to_lead
create view v_speed_to_lead with (security_invoker = true) as
select
  client_id,
  month,
  count(*) filter (where first_response_at is not null)::int                       as contacted,
  percentile_cont(0.5) within group (order by response_min::float8)                as median_min,
  count(*) filter (where response_min <= 15)::int                                  as within_15,
  count(*) filter (where response_min < 5)::int                                    as b_lt5,
  count(*) filter (where response_min >= 5 and response_min <= 15)::int            as b_5_15,
  count(*) filter (where response_min > 15 and response_min <= 60)::int            as b_15_60,
  count(*) filter (where response_min > 60 and response_min <= 240)::int           as b_1_4h,
  count(*) filter (where response_min > 240 and response_min <= 1440)::int         as b_4_24h,
  count(*) filter (where response_min is null or response_min > 1440)::int         as b_gt24_or_never
from v_lead_base
group by client_id, month;

-- @view v_funnel
-- Stages are counted from timestamps (contacted -> site visit -> won), not from the current stage.
create view v_funnel with (security_invoker = true) as
select
  client_id,
  month,
  count(*)::int                                                         as enquiries,
  count(*) filter (where first_response_at is not null)::int            as contacted,
  count(*) filter (where site_visit_at is not null)::int                as site_visit,
  count(*) filter (where stage = 'won')::int                            as won
from v_lead_base
group by client_id, month;

-- @view v_missed_opportunities
-- Never contacted and older than 24h at report time, or first response more than 24h after creation.
create view v_missed_opportunities with (security_invoker = true) as
select
  client_id,
  month,
  id as lead_id,
  number,
  source,
  created_at,
  first_response_at,
  case when first_response_at is null then 'never_contacted' else 'late_response' end as reason
from v_lead_base
where (first_response_at is null and created_at < least(now(), report_time) - interval '24 hours')
   or (first_response_at - created_at > interval '24 hours');

-- @view v_cost_per_lead
-- Cost per lead = platform spend / leads from that source. Cost per win = platform spend / wins from that source.
create view v_cost_per_lead with (security_invoker = true) as
with src as (
  select
    client_id,
    month,
    source,
    case source when 'instagram' then 'meta' when 'google' then 'google' end as platform,
    count(*)::int                                  as leads,
    count(*) filter (where stage = 'won')::int     as wins
  from v_lead_base
  where source in ('instagram', 'google')
  group by 1, 2, 3, 4
)
select
  s.client_id,
  s.month,
  s.source,
  s.platform,
  coalesce(a.amount, 0)                               as spend,
  s.leads,
  s.wins,
  round(a.amount / nullif(s.leads, 0))                as cost_per_lead,
  round(a.amount / nullif(s.wins, 0))                 as cost_per_win
from src s
left join ad_spend a
  on a.client_id = s.client_id and a.month = s.month and a.platform = s.platform;

-- @view v_campaigns
create view v_campaigns with (security_invoker = true) as
select
  client_id,
  month,
  source,
  campaign,
  count(*)::int                              as enquiries,
  count(*) filter (where stage = 'won')::int as won
from v_lead_base
group by client_id, month, source, campaign;

-- @view v_lost_reasons
create view v_lost_reasons with (security_invoker = true) as
select
  client_id,
  month,
  outcome_reason,
  count(*)::int as leads
from v_lead_base
where stage = 'lost'
group by client_id, month, outcome_reason;
