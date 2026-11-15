# LeadLens · Neovia AI (Demo 11)

A monthly lead and conversion report for small Indian businesses on Neovia "Care" plans. On the 1st of every month the owner gets a one-page report on WhatsApp (enquiries, sources, reply speed, funnel), with a live dashboard behind it.

This is an interactive prototype for sales calls and sharing on WhatsApp. **There is no backend.** All data is generated deterministically in the browser from a fixed seed, and owner edits are layered on top and kept in `localStorage`, so the demo cannot break because of a network problem. Urban Nest Interiors is a fictional business.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server (regenerates the embedded SQL first) |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Vitest: calibration targets, dedupe, guard, parser, SQL in a real Postgres engine |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |

> Do not run `npm run build` while `npm run dev` is running. Both write to `.next` and the dev server will serve a broken cache. Stop dev first.

Node 20+ is required.

## Deploy to Vercel

1. Push the folder to a Git repository and import it at vercel.com/new (framework: Next.js, no settings needed), or run `npx vercel` from this folder.
2. Optionally add the environment variables below. Set `NEXT_PUBLIC_SITE_URL` to the deployment URL so the WhatsApp/Open Graph preview image resolves.
3. Open the deployment on a phone to check the 390px layouts. The whole demo works from the link.

## Environment variables (all optional)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Base URL for Open Graph tags |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | Turn on LLM-written commentary (any OpenAI-compatible chat-completions API). Without a key the deterministic template is used. Only `metrics_json` display strings are sent. |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Show "Send to my phone" in the demo panel (WhatsApp Cloud API test number) |

**WhatsApp note:** free-form messages only deliver within 24 hours after the recipient last messaged the business number. Message the test number from the demo phone before each demo.

## The 3-minute demo script

Press **Start guided demo** on the landing page, or follow this by hand.

1. **The run.** Open `/run` and press Run. Leads flow in from five sources, 6 duplicate pairs merge, metrics are computed, commentary is written, figures are verified, the report is rendered. With "Neovia review" on it pauses for approval; press **Approve & send**. The phone buzzes: *"October: 86 enquiries (+18%), 12 won, median reply time 9 minutes. Full report: [link]"*.
2. **The report.** Tap the link: enquiries by source, speed to lead, funnel.
3. **Recommendations.** Three recommendations, each backed by figures.
4. **The owner replies.** In the phone type `WON 186 120000`. The bot confirms and the dashboard, report and funnel update live: 13 won, ₹38,00,000.
5. **Trust.** Click any number to see the SQL and the leads behind it.
6. **Close.** "Every Care plan client gets this on the 1st, so you always know what your money is doing." Show the pricing card.

Extras in the demo panel: inject a live lead, break/fix the Meta Lead Ads connector (blocks auto-send), inject a hallucinated figure (the figure guard blocks sending), jump to 15 Nov (mid-month alert: enquiries down 36%), toggle review, reset.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `D` | Demo panel |
| `P` | Show / hide the phone |
| `→` / `←` | Next / previous tour step (or slide in the quarterly deck) |
| `Esc` | Exit the tour |
| `F` | Fullscreen |
| `R` | Reset the demo |

Keys are ignored while typing in a field.

## Screens

| Route | |
| --- | --- |
| `/` | Landing with 3D hero, how it works, pricing |
| `/run` | The 1st-of-the-month run (3D, with an animated 2D fallback) |
| `/c/urban-nest/dashboard?month=2026-10` | Client dashboard |
| `/c/urban-nest/leads` | Lead table (filters, sort, merged leads, CSV) |
| `/c/urban-nest/report/2026-10` | Monthly report (A4 page 1 + appendix, print to PDF) |
| `/c/urban-nest/outcome` | Outcome form (same handler as WhatsApp replies) |
| `/c/urban-nest/quarterly` | Quarterly review deck (5 slides, arrow keys) |
| `/admin`, `/admin/reports/[id]` | Neovia admin: MRR, report queue, connector health, review and send |

Use the role switcher in the top bar. As the Urban Nest owner, another client's URL or `/admin` shows a 403.

## How it is built

- **Next.js (App Router) + TypeScript (strict)**, Tailwind CSS 4, Recharts for 2D charts, Framer Motion, React Three Fiber for the 3D run, Zustand (persisted) as the single demo store, seedrandom for deterministic data, Vitest.
- `src/data/seed.ts` generates Urban Nest for Aug–Oct 2026 plus 1–14 Nov, and four other fictional clients, so the computed metrics hit the calibration targets exactly. Nothing is hardcoded in the UI: every figure is computed from the rows (`src/lib/metrics`).
- `sql/schema.sql`, `sql/views.sql`, `sql/rls.sql` are real Postgres/Supabase SQL. Each metric function in `src/lib/metrics` mirrors one view. The tests load the SQL into an in-memory Postgres (PGlite) and check that the views return the same numbers as the TypeScript. The trace drawer shows the exact SQL text.
- Every number renders through `<Metric id=…>`; clicking opens the trace drawer (definition, SQL, contributing rows).
- The **figure guard** (`src/lib/narrative/guard.ts`) extracts every number from commentary with its unit and requires a matching metric or a whitelisted constant (15 minutes, 24 hours, 30 days, the year). A report with unverified figures cannot be sent.
- Owner replies are parsed by `src/lib/whatsapp/parser.ts` (`WON <lead> <amount>`, `LOST <lead> <reason>`, `HELP`).

## Out of scope for v1

Real authentication (use the role switcher), real connector APIs, a full CRM, attribution beyond first touch, and server-side PDF rendering. **In production the PDF is produced by Playwright print-to-PDF of the report route**; in this prototype "Download PDF" uses the browser's print dialog with `@page { size: A4; margin: 12mm }`.
