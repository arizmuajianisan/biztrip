# Trip Ledger — Design Spec

**Date:** 2026-08-22
**Status:** Approved for planning

## Problem

Tracking business-trip expenses by memory leads to missed records, wrong entries,
and forgotten receipt photos when it's time to report to finance. Trip Ledger is a
personal web app to record every expense as it happens (with receipt evidence),
handle multi-currency spending, and produce a clean report showing what to return
to the company and whether the trip stayed within budget.

## Stack & Runtime

- **Frontend/app:** Nuxt 4 + Nuxt UI 4 (already installed), Tailwind 4.
- **Deployment:** Single Cloudflare Worker via Nuxt Nitro `cloudflare_module` preset, deployed with `wrangler`.
- **Database:** Neon Postgres, accessed over **HTTP** with `@neondatabase/serverless` (Workers cannot open raw TCP sockets, so `pg` won't work). ORM: **Drizzle** (typed queries + migrations + seed).
- **Auth:** `nuxt-auth-utils` — encrypted cookie sessions, `scrypt` password hashing (Web Crypto; `bcrypt` does not run on Workers). No public sign-up.
- **Receipt storage:** Cloudflare R2 bound directly to the Worker; private, served through an authenticated route.
- **FX rates:** Frankfurter (`api.frankfurter.dev`), free, no key, ECB daily rates.
- **PDF:** print-optimized report route (`window.print()` → "Save as PDF"); no heavy server dependency.

### Rejected alternatives
- **NuxtHub** — nicer DX but steers toward D1/R2 conventions and adds a layer over the explicit "Neon + wrangler" choice.
- **Server-side PDF (Puppeteer/pdf lib)** — heavy/awkward on Workers; not worth it for a personal reporting tool.

## Core Concepts

- **Trip** — the organizing entity. A user has many trips over time (recurring business travel), each with its own destination/currency, budget, advance, expenses, and report. Full history is retained.
- **Home currency = JPY** — the company is Japanese; all budgets and advance are normalized to JPY for authoritative math.
- **Settlement currency = IDR (default)** — the currency the employee actually transfers back to finance. Return-to-company is computed in JPY, then converted to the settlement currency at the report-day live rate.
- **Rate freezing** — the FX rate is fetched and stored on each expense at save time so historical totals never drift.

## Money Model (authoritative)

- Company budgets are always given in **JPY**, split across 8 categories (Per Diem is one of them).
- **Temporary Payment (cash advance)** is given per-trip in a **selectable currency** (JPY or any enabled currency). Stored as original amount + currency + frozen JPY equivalent.
- **Reimbursable categories** (7): Air Ticket, Taxi & Bus, Hotel, Train, Travel Procedure, Travel Insurance, Other.
- **Per Diem** is the employee's personal money — tracked, but **excluded** from the return calculation.

Formulas (all in JPY unless noted):
- `budget_remaining = Σ(reimbursable allowances) − Σ(reimbursable actuals)`
- `per_diem_remaining = per_diem allowance − per_diem actual` (employee keeps this)
- `advance_remaining = advance − Σ(reimbursable actuals)`
- `return_to_company = advance − Σ(reimbursable actuals)`
  - If negative → **Company owes the employee**.
  - Per Diem never enters this.
- `return_settlement = return_to_company × (report-day JPY→settlement rate)` — labeled with rate + date.

## Data Model (Drizzle / Postgres)

### `users`
`id`, `email` (unique), `password_hash`, `role` (`superadmin` | `admin` | `user`), `display_name`, `is_active`, `created_at`

### `trips`
`id`, `user_id`, `name`, `destination_country` (ISO), `default_currency` (derived from country, editable), `home_currency` (default `JPY`), `settlement_currency` (default `IDR`), `temporary_payment_amount`, `temporary_payment_currency`, `temporary_payment_fx_rate_to_home`, `temporary_payment_amount_home` (JPY), `status` (`active` | `closed`), `start_date`, `end_date`, `created_at`

### `trip_budgets` — one row per category per trip
`id`, `trip_id`, `category` (enum), `amount` (JPY)
Category enum: `air_ticket`, `taxi_bus`, `hotel`, `train`, `travel_procedure`, `travel_insurance`, `other`, `per_diem`

### `trip_currencies` — enabled currencies for a trip (short dropdowns)
`id`, `trip_id`, `currency` (ISO). Auto-seeded with JPY + destination currency + IDR; user can add more.

### `expenses`
`id`, `trip_id`, `category` (enum), `amount` (as entered), `currency` (ISO), `fx_rate_to_home` (frozen), `amount_home` (= amount × rate, JPY), `rate_source` (`api` | `manual`), `spent_at`, `note`, `created_at`

### `receipts`
`id`, `expense_id`, `r2_key`, `filename`, `content_type`, `size`, `created_at`

## Roles & Access

Auth via `nuxt-auth-utils`. No public sign-up; a login page only. Seeder creates one
account per role with known dev credentials (to be changed).

Server-side enforcement on every `/api` route; page middleware guards routes; the API
re-checks independently (never trust the client).

| Capability | user | admin | superadmin |
|---|:--:|:--:|:--:|
| Log in, manage own profile/password | ✓ | ✓ | ✓ |
| Full CRUD on **own** trips/expenses/receipts | ✓ | — | ✓ |
| Create / edit / deactivate users, reset passwords | — | ✓ | ✓ |
| View & edit **any** user's trips/expenses | — | — | ✓ |

- **Admin** sees a user-management screen only — no trip data.
- **Superadmin** bypasses the owner filter to act on any trip.
- Deactivated users (`is_active = false`) can't log in; their data is retained.

## User Flow & Screens

### First login → empty state
No trips yet → dashboard shows "Create your first trip".

### Create a trip (one-page setup wizard)
1. Name, destination country (→ auto-sets default currency, editable), start/end dates.
2. Enabled currencies (auto: JPY + destination + IDR; add more).
3. Per-category budget allowances (8 categories, JPY) → live total.
4. Temporary Payment: amount + currency → shows frozen JPY equivalent.
5. Settlement currency (default IDR).

### Trip dashboard (day-to-day)
- **Two headline numbers:** **Budget remaining** (reimbursable) and **Per Diem remaining** (personal wallet).
- Per-category progress bars (actual vs allowance); Per Diem visually flagged "yours, not returned".
- Advance-remaining shown with reconciliation figures (not a headline).
- Running expense list; prominent "Add expense" button.
- Toggle JPY ↔ trip default currency on the headline numbers.

### Add expense (quick form / modal)
- Amount + currency (defaults to trip default currency).
- Category (the 8).
- Date, optional note.
- **Receipt upload — multiple images**, drag/drop, thumbnails, removable before save.
- On save: fetch & freeze FX rate → compute JPY equivalent → upload receipts to R2 → dashboard totals update immediately.
- **FX fallback:** if the rate API is unreachable, prompt for a manual rate (flagged `rate_source = manual`) so logging is never blocked.

### Editing
Tap an expense to edit/delete (own trips; superadmin any). Re-saving re-freezes the rate only if amount/currency/date changes.

### Close trip
Marks `closed`, generates the report; remains viewable in history.

## The Report

Dedicated per-trip page, print-optimized (→ Save as PDF).

1. **Header:** trip name, destination, dates, employee, generated-on date.
2. **Expenses by category** — for each of the 7 reimbursable categories: allowance (JPY), actual (JPY), variance, and itemized expenses (date, original amount + currency, JPY equivalent, note, receipt count). Per Diem in a separate section labeled "Personal — not reimbursed".
3. **Reimbursable totals:** total allowance vs actual → **budget health: UNDER / OVER by ¥X** (green/red).
4. **Settlement block:**
   - Temporary Payment (advance): original amount + currency + JPY equivalent.
   - Total reimbursable actuals (JPY).
   - **Return to company = advance − reimbursable actuals** (JPY); negative → "Company owes you ¥X".
   - **Converted to settlement currency (IDR)** at report-day rate (rate + date labeled) — the figure wired to finance.
5. **Per Diem summary:** allowance, spent, remaining (kept by employee) — informational.
6. **Receipts appendix:** receipt images at the end so tables stay clean.

## Receipts & R2

- **Upload:** server API route validates (jpg/png/webp/pdf; ≤10 MB each; ≤10 per expense) → streams to the R2 bucket bound to the Worker. Key pattern: `receipts/{tripId}/{expenseId}/{uuid}.{ext}`.
- **Serving:** private; an authenticated Worker route checks ownership (or superadmin) before streaming from R2. No public bucket URLs.
- **Cleanup:** deleting an expense or trip deletes its R2 objects.
- **Local dev:** wrangler local R2 emulation.

## Project Structure (Nuxt 4)

- `app/pages` — login, dashboard (trip list), trip setup, trip detail, report, admin/users.
- `app/components` — expense form, receipt uploader, budget bars, currency picker, report sections.
- `app/middleware` — auth + role guards.
- `server/api` — auth, trips, expenses, receipts, users, fx (all role-checked).
- `server/database` — Drizzle schema, migrations, `seed.ts`.
- `server/utils` — session/RBAC helpers, R2 helpers, FX fetch+freeze, money math.
- `wrangler.jsonc` — R2 binding, vars; `DB_URL` as a secret.

## Testing

- **Unit (Vitest):** money math (return calc, budget/per-diem remaining, FX freezing, over/under), RBAC permission checks.
- **Integration:** API routes with role enforcement against a test DB.
- **Manual/light e2e:** receipt upload + report-print flow.

## Out of Scope (YAGNI)

- Public sign-up / email invites.
- Server-side one-click PDF generation.
- Approval workflows, multi-company/tenant support.
- Mobile native apps.
