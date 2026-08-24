# Trip Ledger

Track business-trip expenses as they happen — with receipt photos, in whatever
currency you actually spent — and produce a finance-ready settlement report.

Built for the problem of reporting from memory: missed expenses, mis-keyed bill
amounts, and receipt photos never taken.

- **Live:** https://trip-ledger.arizmuajianisan.workers.dev
- **Design spec:** [`docs/superpowers/specs/2026-08-22-trip-ledger-design.md`](docs/superpowers/specs/2026-08-22-trip-ledger-design.md)
- **Implementation plan:** [`docs/superpowers/plans/2026-08-22-trip-ledger.md`](docs/superpowers/plans/2026-08-22-trip-ledger.md)

## How the money works

Everything authoritative is in **JPY** (the company is Japanese).

- Company budget is allocated per category. Seven categories are reimbursable:
  Air Ticket, Taxi & Bus, Hotel Bill, Train Fee, Travel Procedure Expense,
  Travel Insurance, Other.
- **Per Diem** is the eighth category. It is tracked, but it is your personal
  money and is **never** part of what you return.
- **Temporary Payment** is the cash advance you were handed, in any currency.
- `return_to_company = advance − reimbursable actuals`. Negative means the
  company owes you.
- FX rates are **frozen onto each expense** at save time using the spend date, so
  historical totals never drift. If no rate is published for a currency you can
  enter one manually; it gets flagged as such.
- The report converts the return figure into a settlement currency (IDR by
  default) at today's rate, labelled with the rate and its date.

## Roles

| Capability | user | admin | superadmin |
|---|:--:|:--:|:--:|
| Log in | ✓ | ✓ | ✓ |
| Full CRUD on own trips / expenses / receipts | ✓ | ✓ | ✓ |
| View and edit **any** user's trips | — | ✓ | ✓ |
| Edit per-category budgets after trip setup | — | ✓ | ✓ |
| Rename and reassign a trip to another owner | — | ✓ | ✓ |
| Create, edit, deactivate users; reset passwords | — | ✓ | ✓ |
| Create or promote **privileged** accounts | — | — | ✓ |

`admin` and `superadmin` have identical reach over trip data; they differ only
in user management, where minting or promoting an `admin`/`superadmin` account
stays superadmin-only.

A traveller sets the category allowances when creating a trip, but cannot
change them afterwards — from that point the budget is an allocation from
above. Nobody can deactivate or promote themselves. Deactivated users cannot
log in; their data is retained.

Closing a trip freezes its expenses, its budgets and its cash advance, so a
report already sent to finance cannot change underneath it. A trip can be
reopened to make a correction.

> The role table in the design spec reflects the original design, where `admin`
> had no trip access at all. It was widened later; this table is current.

## Stack

Nuxt 4 + Nuxt UI 4 on a single Cloudflare Worker (`cloudflare_module` preset).
Neon Postgres over HTTP via Drizzle (Workers cannot open raw TCP sockets).
Sessions and scrypt password hashing via `nuxt-auth-utils`. Receipts in a private
R2 bucket, served only through an ownership-checked route. FX rates from
Frankfurter (ECB).

## Setup

```bash
pnpm install
cp .env.example .env      # then fill in the three values
pnpm db:migrate           # apply the schema to Neon
pnpm dev
```

Seed one account per role (idempotent, safe to re-run):

```bash
curl -X POST localhost:3000/api/admin/seed -H "x-seed-token: $NUXT_SEED_TOKEN"
```

This creates `superadmin@trip-ledger.local`, `admin@trip-ledger.local` and
`user@trip-ledger.local`. **Change these passwords before real use** — via the
Users screen, or by re-running the seeder against a fresh database.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server with Cloudflare bindings and local R2 emulation |
| `pnpm test` | Unit tests for the money engine, report assembly, FX parsing, RBAC |
| `pnpm lint` / `pnpm typecheck` | ESLint / `vue-tsc` |
| `pnpm db:generate` / `pnpm db:migrate` | Generate and apply Drizzle migrations |
| `pnpm deploy` | Build and deploy the Worker |

Deployment needs three secrets set on the Worker:

```bash
pnpm wrangler secret put NUXT_DB_URL
pnpm wrangler secret put NUXT_SESSION_PASSWORD
pnpm wrangler secret put NUXT_SEED_TOKEN
```

## Testing approach

The tests cover pure logic — budget and return calculations, per-diem exclusion,
rounding, report grouping, FX parsing, and the RBAC matrix — because that is
where a wrong answer is both likely and invisible. API and authorization
behaviour is verified against a running server; there is no isolated test
database, so those checks are not automated. Add them if you point
`NUXT_DB_URL` at a dedicated Neon branch.
