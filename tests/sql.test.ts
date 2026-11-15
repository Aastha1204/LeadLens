import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { getSeed, URBAN_NEST } from "@/data/seed";
import { SQL_SCHEMA, SQL_RLS, SQL_VIEWS_ALL } from "@/lib/sql/generated";
import {
  vCostPerLead, vFunnel, vMissedOpportunities, vMonthlyHeadline, vSourceBreakdown, vSpeedToLead, vWeeklyEnquiries,
} from "@/lib/metrics";

const ds = getSeed();
const un = ds.leads.filter((l) => l.client_id === URBAN_NEST);
const unRaw = ds.rawEnquiries.filter((r) => r.client_id === URBAN_NEST);
let db: PGlite;

const rows = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

beforeAll(async () => {
  db = new PGlite();
  // Supabase provides auth.jwt(); stub it so rls.sql can be created.
  await db.exec(`create schema auth; create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;`);
  await db.exec(SQL_SCHEMA);
  await db.exec(SQL_RLS);
  await db.exec(SQL_VIEWS_ALL);
  const j = (x: unknown) => JSON.stringify(x);
  await db.query(`insert into client select * from jsonb_populate_recordset(null::client, $1::jsonb)`, [j(ds.clients.map((c) => ({ id: c.id, name: c.name, city: c.city, industry: c.industry, plan: c.plan, logo_url: c.logo_url, report_day: c.report_day, review_required: c.review_required, onboarded_month: `${c.onboarded_month}-01` })))]);
  await db.query(`insert into raw_enquiry select * from jsonb_populate_recordset(null::raw_enquiry, $1::jsonb)`, [j(ds.rawEnquiries)]);
  await db.query(`insert into lead select * from jsonb_populate_recordset(null::lead, $1::jsonb)`, [j(ds.leads)]);
  await db.query(`insert into ad_spend select * from jsonb_populate_recordset(null::ad_spend, $1::jsonb)`, [j(ds.adSpend)]);
  await db.query(`insert into care_activity select * from jsonb_populate_recordset(null::care_activity, $1::jsonb)`, [j(ds.careActivity)]);
  await db.query(`insert into gbp_metrics select * from jsonb_populate_recordset(null::gbp_metrics, $1::jsonb)`, [j(ds.gbpMetrics)]);
}, 60_000);
afterAll(async () => { await db?.close(); });

describe("sql files are valid Postgres and agree with the TypeScript metrics", () => {
  for (const month of ["2026-08", "2026-09", "2026-10"]) {
    const m = `${month}-01`;
    it(`v_monthly_headline ${month}`, async () => {
      const [r] = await rows<Record<string, unknown>>(`select * from v_monthly_headline where client_id = $1 and month = $2`, [URBAN_NEST, m]);
      const h = vMonthlyHeadline(un, unRaw, month);
      expect(Number(r.raw_enquiries)).toBe(h.raw_enquiries);
      expect(Number(r.enquiries)).toBe(h.enquiries);
      expect(Number(r.duplicates_merged)).toBe(h.duplicates_merged);
      expect(Number(r.contacted)).toBe(h.contacted);
      expect(Number(r.site_visits)).toBe(h.site_visits);
      expect(Number(r.won)).toBe(h.won);
      expect(Number(r.revenue_won)).toBe(h.revenue_won);
      expect(Number(r.median_response_min)).toBe(h.median_response_min);
    });
    it(`v_source_breakdown ${month}`, async () => {
      const r = await rows<{ source: string; enquiries: number; won: number }>(`select source, enquiries, won from v_source_breakdown where client_id = $1 and month = $2`, [URBAN_NEST, m]);
      for (const s of vSourceBreakdown(un, month)) {
        const x = r.find((y) => y.source === s.source)!;
        expect([Number(x.enquiries), Number(x.won)]).toEqual([s.enquiries, s.won]);
      }
    });
    it(`v_speed_to_lead + v_funnel ${month}`, async () => {
      const [s] = await rows<Record<string, unknown>>(`select * from v_speed_to_lead where client_id = $1 and month = $2`, [URBAN_NEST, m]);
      const t = vSpeedToLead(un, month);
      expect(Number(s.within_15)).toBe(t.within_15);
      expect(Number(s.median_min)).toBe(t.median_min);
      expect([Number(s.b_lt5), Number(s.b_5_15), Number(s.b_15_60), Number(s.b_1_4h), Number(s.b_4_24h), Number(s.b_gt24_or_never)])
        .toEqual([t.buckets.lt5, t.buckets["5_15"], t.buckets["15_60"], t.buckets["1_4h"], t.buckets["4_24h"], t.buckets.gt24_or_never]);
      const [f] = await rows<Record<string, unknown>>(`select * from v_funnel where client_id = $1 and month = $2`, [URBAN_NEST, m]);
      const tf = vFunnel(un, month);
      expect([Number(f.enquiries), Number(f.contacted), Number(f.site_visit), Number(f.won)]).toEqual([tf.enquiries, tf.contacted, tf.site_visit, tf.won]);
    });
    it(`v_weekly_enquiries ${month}`, async () => {
      const r = await rows<{ week_no: number; enquiries: number }>(`select week_no, enquiries from v_weekly_enquiries where client_id = $1 and month = $2 order by 1`, [URBAN_NEST, m]);
      expect(r.map((x) => [Number(x.week_no), Number(x.enquiries)])).toEqual(vWeeklyEnquiries(un, month).map((x) => [x.week_no, x.enquiries]));
    });
    it(`v_missed_opportunities ${month}`, async () => {
      const r = await rows<{ lead_id: string }>(`select lead_id from v_missed_opportunities where client_id = $1 and month = $2`, [URBAN_NEST, m]);
      const ts = vMissedOpportunities(un, month, new Date("2026-11-01T03:30:00Z")).map((x) => x.lead.id).sort();
      expect(r.map((x) => x.lead_id).sort()).toEqual(ts);
    });
    it(`v_cost_per_lead ${month}`, async () => {
      const r = await rows<Record<string, unknown>>(`select * from v_cost_per_lead where client_id = $1 and month = $2`, [URBAN_NEST, m]);
      for (const c of vCostPerLead(un, ds.adSpend, URBAN_NEST, month)) {
        const x = r.find((y) => y.source === c.source)!;
        expect([Number(x.spend), Number(x.cost_per_lead), Number(x.cost_per_win)]).toEqual([c.spend, c.cost_per_lead, c.cost_per_win]);
      }
    });
  }

  it("row-level security isolates clients", async () => {
    await db.exec(`create role app_user nologin; grant usage on schema auth, app to app_user; grant execute on all functions in schema auth, app to app_user; grant select on all tables in schema public to app_user;`);
    const asUser = async (claims: object) => {
      await db.exec(`set role app_user; select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false);`);
      const [r] = await rows<{ n: number; clients: number }>(`select count(*)::int as n, count(distinct client_id)::int as clients from lead`);
      await db.exec(`reset role;`);
      return r;
    };
    const owner = await asUser({ client_id: "c1", role: "client" });
    expect(owner.clients).toBe(1);
    expect(owner.n).toBe(un.length);
    const other = await asUser({ client_id: "c2", role: "client" });
    expect(other.clients).toBe(1);
    expect(other.n).toBeLessThan(un.length);
    const admin = await asUser({ role: "neovia_admin" });
    expect(admin.clients).toBe(5);
    const nobody = await asUser({});
    expect(nobody.n).toBe(0);
  });

  it("generated SQL module is in sync with sql/*.sql", () => {
    const read = (f: string) => fs.readFileSync(path.join(__dirname, "../sql", f), "utf8");
    expect(SQL_SCHEMA).toBe(read("schema.sql"));
    expect(SQL_RLS).toBe(read("rls.sql"));
    expect(SQL_VIEWS_ALL).toBe(read("views.sql"));
  });
});
