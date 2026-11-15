-- Row-level security: a client user sees only rows with their own client_id.
-- Neovia admins (JWT role = 'neovia_admin') see every client.
-- Supabase: auth.jwt() returns the caller's JWT claims.

create schema if not exists app;

create or replace function app.current_client_id() returns text
language sql stable as $$ select nullif(auth.jwt() ->> 'client_id', '') $$;

create or replace function app.is_neovia_admin() returns boolean
language sql stable as $$ select coalesce(auth.jwt() ->> 'role', '') = 'neovia_admin' $$;

alter table client         enable row level security;
alter table connector      enable row level security;
alter table raw_enquiry    enable row level security;
alter table lead           enable row level security;
alter table ad_spend       enable row level security;
alter table care_activity  enable row level security;
alter table gbp_metrics    enable row level security;
alter table monthly_report enable row level security;

create policy client_isolation on client for select
  using (app.is_neovia_admin() or id = app.current_client_id());

create policy connector_isolation on connector for select
  using (app.is_neovia_admin() or client_id = app.current_client_id());

create policy raw_enquiry_isolation on raw_enquiry for select
  using (app.is_neovia_admin() or client_id = app.current_client_id());

create policy lead_isolation on lead for select
  using (app.is_neovia_admin() or client_id = app.current_client_id());

-- Owners may record outcomes (WON / LOST) on their own leads only.
create policy lead_owner_outcome on lead for update
  using (client_id = app.current_client_id())
  with check (client_id = app.current_client_id());

create policy ad_spend_isolation on ad_spend for select
  using (app.is_neovia_admin() or client_id = app.current_client_id());

create policy care_activity_isolation on care_activity for select
  using (app.is_neovia_admin() or client_id = app.current_client_id());

create policy gbp_metrics_isolation on gbp_metrics for select
  using (app.is_neovia_admin() or client_id = app.current_client_id());

-- Owners see only reports that have been sent; admins see the whole queue.
create policy monthly_report_isolation on monthly_report for select
  using (app.is_neovia_admin() or (client_id = app.current_client_id() and status = 'sent'));
