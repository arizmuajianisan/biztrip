# Trip Ledger — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **At execution time, copy this file to `docs/superpowers/plans/2026-08-22-trip-ledger.md` and commit it.**

## Context

Reporting business-trip expenses from memory loses records: expenses get missed, bill amounts get keyed in wrong, and receipt photos never get taken. Trip Ledger is a personal web app to log every expense the moment it happens — with receipt images attached, in whatever currency was actually spent — and then produce a finance-ready report showing actual spend per category, how much cash advance must be returned, and whether the trip stayed inside budget. Per Diem is tracked but never returned, because it's the employee's own money.

The approved design spec is `docs/superpowers/specs/2026-08-22-trip-ledger-design.md`. **Read it before starting.** This plan implements it; the spec is the authority on money rules and wording.

**Current state:** the repo is an unmodified Nuxt 4 + Nuxt UI 4 starter (`app/app.vue`, `app/pages/index.vue`, `app/components/AppLogo.vue`, `app/components/TemplateMenu.vue`). No server code, no database, no auth. One commit: the spec.

**Goal:** a single Cloudflare Worker running Nuxt 4, backed by Neon Postgres and Cloudflare R2, where the user logs in, sets up a trip with per-category JPY budgets and a cash advance, logs multi-currency expenses with receipt photos, and prints a settlement report.

**Architecture:** Nuxt 4 full-stack app; Nitro `cloudflare_module` preset deployed by wrangler. Neon accessed over HTTP (`@neondatabase/serverless` + Drizzle) because Workers cannot open raw TCP sockets. Sessions via `nuxt-auth-utils` encrypted cookies with scrypt password hashing (bcrypt does not run on Workers). Receipts in an R2 bucket bound to the Worker, served only through an ownership-checked route. FX rates fetched from Frankfurter and **frozen onto each expense** so historical totals never drift. All authoritative money math lives in pure, unit-tested functions in `shared/`.

**Tech stack:** Nuxt 4.5, Nuxt UI 4.10, Tailwind 4, `nuxt-auth-utils` 0.5, `drizzle-orm` 0.45 / `drizzle-kit` 0.31, `@neondatabase/serverless` 1.1, `zod` 4, `wrangler` 4, `nitro-cloudflare-dev` 0.2, `vitest` 4, pnpm 11, Node 22.

---

## Global Constraints

- **Home currency is JPY.** All budgets and all authoritative math are in JPY. Never store a total in anything else.
- **Per Diem is excluded from `return_to_company`.** It is the employee's personal money. Every report and dashboard must label it so.
- **FX rates are frozen at save time** onto the expense row (`fx_rate_to_home`, `amount_home`, `rate_source`). Never recompute historical totals from live rates.
- **No public sign-up.** Login page only. Users are created by admin/superadmin or the seeder.
- **Every `/api` route re-checks auth and role server-side.** Page middleware is UX only; never trust the client.
- **R2 objects are never public.** Served only through an authenticated, ownership-checked route.
- **Runtime secrets come from `runtimeConfig`**, populated by `NUXT_`-prefixed env vars (`NUXT_DB_URL`, `NUXT_SESSION_PASSWORD`, `NUXT_SEED_TOKEN`). Workers get them as wrangler secrets.
- Category enum, verbatim: `air_ticket`, `taxi_bus`, `hotel`, `train`, `travel_procedure`, `travel_insurance`, `other`, `per_diem`. The first seven are reimbursable.
- Follow the repo's eslint style already configured in `nuxt.config.ts`: **no trailing commas**, 1tbs braces, no semicolons.
- Commit after every task. Conventional-commit prefixes (`feat:`, `test:`, `chore:`).

### Deviation from the spec, stated up front

The spec calls for "integration tests against a test DB". You chose to point `NUXT_DB_URL` at the existing Neon `production` database, so there is no isolated test DB. **Automated tests therefore cover pure logic only** (money math, summary/report computation, FX normalization, RBAC predicates) — these are where the real risk is. API and RBAC behaviour is covered by the scripted manual verification checklist at the end of this plan. If you later create a Neon dev branch, add API integration tests then.

---

## File Structure

**Shared pure domain logic (unit-tested, no I/O) — `shared/`**
| File | Responsibility |
|---|---|
| `shared/domain/categories.ts` | Category enum values, reimbursable subset, display labels/icons |
| `shared/domain/currencies.ts` | Currency decimal places, country→currency table, currency display labels |
| `shared/domain/money.ts` | `roundMoney`, `decimalsFor`, `toHome`, `formatMoney` |
| `shared/domain/summary.ts` | `computeSummary` — the single source of truth for all budget/advance/return figures |
| `shared/domain/report.ts` | `buildReport` — groups expenses per category on top of `computeSummary` |
| `shared/domain/rbac.ts` | `can(role, action)` pure predicate + `Action` union |
| `shared/types/auth.d.ts` | `declare module '#auth-utils'` session `User` augmentation |

**Server — `server/`**
| File | Responsibility |
|---|---|
| `server/database/schema.ts` | Drizzle tables + enums |
| `server/database/migrations/` | drizzle-kit generated SQL |
| `server/utils/db.ts` | `useDb(event)` — Neon HTTP + Drizzle client |
| `server/utils/guard.ts` | `requireUser`, `requireRole`, `requireTripAccess`, `requireExpenseAccess` |
| `server/utils/r2.ts` | `useR2(event)`, `receiptKey()`, `deleteReceiptObjects()` |
| `server/utils/fx.ts` | `fetchRate(from, to, date)` — Frankfurter, with error surfacing |
| `server/api/auth/[login\|logout].post.ts` | Session create/destroy |
| `server/api/trips/*` | Trip list/create/get/update/close, trip summary |
| `server/api/expenses/*` | Expense CRUD (scoped by trip) |
| `server/api/receipts/*` | Upload / stream / delete receipt objects |
| `server/api/fx/rate.get.ts` | Rate lookup proxy for the client |
| `server/api/users/*` | Admin user management |
| `server/api/reports/[tripId].get.ts` | Assembled report payload |
| `server/api/admin/seed.post.ts` | Token-guarded idempotent seeder |

**App — `app/`**
| File | Responsibility |
|---|---|
| `app/layouts/default.vue` | Shell: nav, user menu, logout |
| `app/layouts/blank.vue` | Login/print shell |
| `app/middleware/auth.global.ts` | Redirect unauthenticated → `/login`; role-gate `/admin` |
| `app/pages/login.vue` | Login form |
| `app/pages/index.vue` | Trip list + empty state (**replaces starter content**) |
| `app/pages/trips/new.vue` | Trip setup wizard (one page) |
| `app/pages/trips/[id]/index.vue` | Trip dashboard |
| `app/pages/trips/[id]/report.vue` | Print-optimized report |
| `app/pages/admin/users.vue` | User management |
| `app/components/trip/BudgetForm.vue` | 8-category JPY allowance inputs + live total |
| `app/components/trip/SummaryHeadline.vue` | Budget-remaining + Per-Diem-remaining cards, JPY↔local toggle |
| `app/components/trip/CategoryBars.vue` | Per-category actual-vs-allowance bars |
| `app/components/expense/ExpenseForm.vue` | Amount/currency/category/date/note + FX freeze + manual-rate fallback |
| `app/components/expense/ReceiptUploader.vue` | Multi-image drag/drop, thumbnails, remove-before-save |
| `app/components/expense/ExpenseList.vue` | Running expense list with edit/delete |
| `app/components/report/*` | Report sections (category tables, settlement block, receipts appendix) |
| `app/composables/useTrip.ts` | Trip + summary fetching/refresh |

**Deleted:** `app/components/AppLogo.vue`, `app/components/TemplateMenu.vue`, starter markup in `app/pages/index.vue`, and the `routeRules: { '/': { prerender: true } }` entry in `nuxt.config.ts` (`/` is now auth-gated and must render per-request).

**Root:** `wrangler.jsonc`, `drizzle.config.ts`, `vitest.config.ts`, updated `.env.example`, `.gitignore` (+`.wrangler`), `package.json` scripts.

---

# Phase 1 — Foundation, auth, trips, expenses, receipts

## Task 1: Project infrastructure

**Files:**
- Modify: `package.json`, `nuxt.config.ts`, `.env.example`, `.gitignore`
- Create: `wrangler.jsonc`, `drizzle.config.ts`, `vitest.config.ts`
- Delete: `app/components/AppLogo.vue`, `app/components/TemplateMenu.vue`

**Produces:** working dev server with R2 binding available at `event.context.cloudflare.env.RECEIPTS`, `useRuntimeConfig().dbUrl`, and a passing `pnpm test`.

- [ ] **Step 1: Install dependencies**

```bash
pnpm add nuxt-auth-utils drizzle-orm @neondatabase/serverless zod
pnpm add -D drizzle-kit wrangler nitro-cloudflare-dev vitest @vitejs/plugin-vue @cloudflare/workers-types
```

- [ ] **Step 2: Create the R2 bucket**

```bash
pnpm wrangler r2 bucket create trip-ledger-receipts
```
Expected: bucket created. (Verified: the account has R2 enabled; this name is free.)

- [ ] **Step 3: Create `wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "trip-ledger",
  "main": "./.output/server/index.mjs",
  "compatibility_date": "2026-06-30",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./.output/public/",
    "binding": "ASSETS"
  },
  "observability": { "enabled": true },
  "r2_buckets": [
    { "binding": "RECEIPTS", "bucket_name": "trip-ledger-receipts" }
  ]
}
```

- [ ] **Step 4: Update `nuxt.config.ts`**

Add the two modules, the Nitro preset, and `runtimeConfig`. **Remove** the `routeRules` block.

```ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    'nuxt-auth-utils',
    'nitro-cloudflare-dev'
  ],

  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    dbUrl: '',
    seedToken: '',
    public: {
      homeCurrency: 'JPY'
    }
  },

  compatibilityDate: '2026-06-30',

  nitro: {
    preset: 'cloudflare_module'
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
```

- [ ] **Step 5: Rewrite `.env.example` and create a local `.env`**

`.env.example`:
```
# Neon Postgres (HTTP). Consumed as runtimeConfig.dbUrl
NUXT_DB_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require

# 32+ character random string used by nuxt-auth-utils to encrypt session cookies
NUXT_SESSION_PASSWORD=replace-with-32-plus-random-characters

# Shared secret required by POST /api/admin/seed
NUXT_SEED_TOKEN=replace-with-random-token
```

Then create `.env` (gitignored) with the real Neon URL that is currently in `.env.example` (`postgresql://neondb_owner:npg_uDIYJ2h9CsEK@ep-small-wind-az9vzza0-pooler.c-3.ap-southeast-1.aws.neon.tech/production?sslmode=require&channel_binding=require`) as `NUXT_DB_URL`, plus generated values for the other two:

```bash
node -e "console.log('NUXT_SESSION_PASSWORD=' + crypto.randomUUID().replace(/-/g,'') + crypto.randomUUID().replace(/-/g,''))"
node -e "console.log('NUXT_SEED_TOKEN=' + crypto.randomUUID())"
```

**Note:** the real credential is already committed in git history in `.env.example`. Flag to the user that it should be rotated in the Neon console once the app works; do not block on it.

- [ ] **Step 6: Add `.wrangler` to `.gitignore`**

Append under the Nuxt outputs block:
```
.wrangler
```

- [ ] **Step 7: Create `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dbCredentials: {
    url: process.env.NUXT_DB_URL!
  }
})
```

- [ ] **Step 8: Create `vitest.config.ts`**

Pure-logic tests only — no Nuxt environment needed, so this stays fast.

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node'
  }
})
```

- [ ] **Step 9: Add scripts to `package.json`**

```json
"test": "vitest run",
"test:watch": "vitest",
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"deploy": "nuxt build && wrangler deploy"
```

- [ ] **Step 10: Delete starter components and stub `app/pages/index.vue`**

```bash
rm app/components/AppLogo.vue app/components/TemplateMenu.vue
```
Replace `app/pages/index.vue` body with a minimal placeholder (`<template><div>Trip Ledger</div></template>`); Task 6 fills it in.

- [ ] **Step 11: Verify the toolchain**

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm dev
```
Expected: dev server boots on :3000 with no module resolution errors; `/` renders the placeholder. Stop the server.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold cloudflare/neon/drizzle/auth infrastructure"
```

---

## Task 2: Shared domain — categories, currencies, money math

**Files:**
- Create: `shared/domain/categories.ts`, `shared/domain/currencies.ts`, `shared/domain/money.ts`
- Test: `test/money.test.ts`

**Produces:** `EXPENSE_CATEGORIES`, `REIMBURSABLE_CATEGORIES`, `CATEGORY_LABELS`, type `ExpenseCategory`; `decimalsFor(code)`, `roundMoney(value, code)`, `toHome(amount, rate)`, `formatMoney(value, code)`; `COUNTRIES` (code, name, currency), `currencyForCountry(code)`.

**Design note:** amounts are stored in Postgres as `numeric(18,4)` and handled in JS as `number`. At trip magnitudes (< 10^9) with ≤ 4 decimal places, IEEE-754 error is far below one minor unit; `roundMoney` collapses it at every boundary. Every value that gets stored or displayed goes through `roundMoney`.

- [ ] **Step 1: Write the failing tests** — `test/money.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { decimalsFor, formatMoney, roundMoney, toHome } from '../shared/domain/money'
import { currencyForCountry } from '../shared/domain/currencies'
import { EXPENSE_CATEGORIES, REIMBURSABLE_CATEGORIES } from '../shared/domain/categories'

describe('decimalsFor', () => {
  it('gives zero decimals to JPY and IDR', () => {
    expect(decimalsFor('JPY')).toBe(0)
    expect(decimalsFor('IDR')).toBe(0)
  })

  it('defaults to two decimals', () => {
    expect(decimalsFor('USD')).toBe(2)
    expect(decimalsFor('XYZ')).toBe(2)
  })
})

describe('roundMoney', () => {
  it('rounds to whole units for zero-decimal currencies', () => {
    expect(roundMoney(1234.56, 'JPY')).toBe(1235)
  })

  it('rounds to cents for two-decimal currencies', () => {
    expect(roundMoney(10.005, 'USD')).toBe(10.01)
  })

  it('kills float drift', () => {
    expect(roundMoney(0.1 + 0.2, 'USD')).toBe(0.3)
  })
})

describe('toHome', () => {
  it('converts to whole yen', () => {
    // 150000 IDR at 0.0096 JPY per IDR
    expect(toHome(150000, 0.0096)).toBe(1440)
  })

  it('is identity at rate 1', () => {
    expect(toHome(5000, 1)).toBe(5000)
  })
})

describe('formatMoney', () => {
  it('formats yen without decimals', () => {
    expect(formatMoney(1440, 'JPY')).toBe('¥1,440')
  })
})

describe('categories', () => {
  it('has eight categories, seven reimbursable', () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(8)
    expect(REIMBURSABLE_CATEGORIES).toHaveLength(7)
    expect(REIMBURSABLE_CATEGORIES).not.toContain('per_diem')
    expect(EXPENSE_CATEGORIES).toContain('per_diem')
  })
})

describe('currencyForCountry', () => {
  it('maps countries to their currency', () => {
    expect(currencyForCountry('JP')).toBe('JPY')
    expect(currencyForCountry('ID')).toBe('IDR')
    expect(currencyForCountry('SG')).toBe('SGD')
  })

  it('returns undefined for unknown countries', () => {
    expect(currencyForCountry('ZZ')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test`
Expected: FAIL — cannot resolve `../shared/domain/money`.

- [ ] **Step 3: Implement `shared/domain/categories.ts`**

```ts
export const REIMBURSABLE_CATEGORIES = [
  'air_ticket',
  'taxi_bus',
  'hotel',
  'train',
  'travel_procedure',
  'travel_insurance',
  'other'
] as const

export const PER_DIEM = 'per_diem' as const

export const EXPENSE_CATEGORIES = [...REIMBURSABLE_CATEGORIES, PER_DIEM] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  air_ticket: 'Air Ticket',
  taxi_bus: 'Taxi & Bus',
  hotel: 'Hotel Bill',
  train: 'Train Fee',
  travel_procedure: 'Travel Procedure Expense',
  travel_insurance: 'Travel Insurance',
  other: 'Other',
  per_diem: 'Per Diem'
}

export const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  air_ticket: 'i-lucide-plane',
  taxi_bus: 'i-lucide-bus',
  hotel: 'i-lucide-bed',
  train: 'i-lucide-train-front',
  travel_procedure: 'i-lucide-file-text',
  travel_insurance: 'i-lucide-shield-check',
  other: 'i-lucide-ellipsis',
  per_diem: 'i-lucide-wallet'
}

export function isReimbursable(category: ExpenseCategory): boolean {
  return category !== PER_DIEM
}
```

- [ ] **Step 4: Implement `shared/domain/money.ts`**

```ts
export const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'IDR', 'KRW', 'VND', 'CLP', 'ISK', 'TWD'])

export const HOME_CURRENCY = 'JPY'

export function decimalsFor(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2
}

export function roundMoney(value: number, currency: string): number {
  const factor = 10 ** decimalsFor(currency)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/** Convert an amount in a foreign currency to home currency (JPY) using a frozen rate. */
export function toHome(amount: number, rateToHome: number): number {
  return roundMoney(amount * rateToHome, HOME_CURRENCY)
}

export function formatMoney(value: number, currency: string): string {
  const decimals = decimalsFor(currency)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}
```

- [ ] **Step 5: Implement `shared/domain/currencies.ts`**

An explicit, finite table — no ISO library. Include at minimum the entries below; add more only when a real trip needs them.

```ts
export interface Country {
  code: string
  name: string
  currency: string
}

export const COUNTRIES: Country[] = [
  { code: 'JP', name: 'Japan', currency: 'JPY' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR' },
  { code: 'SG', name: 'Singapore', currency: 'SGD' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR' },
  { code: 'TH', name: 'Thailand', currency: 'THB' },
  { code: 'VN', name: 'Vietnam', currency: 'VND' },
  { code: 'PH', name: 'Philippines', currency: 'PHP' },
  { code: 'CN', name: 'China', currency: 'CNY' },
  { code: 'HK', name: 'Hong Kong', currency: 'HKD' },
  { code: 'TW', name: 'Taiwan', currency: 'TWD' },
  { code: 'KR', name: 'South Korea', currency: 'KRW' },
  { code: 'IN', name: 'India', currency: 'INR' },
  { code: 'AU', name: 'Australia', currency: 'AUD' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD' },
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'CA', name: 'Canada', currency: 'CAD' },
  { code: 'MX', name: 'Mexico', currency: 'MXN' },
  { code: 'BR', name: 'Brazil', currency: 'BRL' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'FR', name: 'France', currency: 'EUR' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR' },
  { code: 'IT', name: 'Italy', currency: 'EUR' },
  { code: 'ES', name: 'Spain', currency: 'EUR' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF' },
  { code: 'SE', name: 'Sweden', currency: 'SEK' },
  { code: 'NO', name: 'Norway', currency: 'NOK' },
  { code: 'DK', name: 'Denmark', currency: 'DKK' },
  { code: 'PL', name: 'Poland', currency: 'PLN' },
  { code: 'CZ', name: 'Czechia', currency: 'CZK' },
  { code: 'TR', name: 'Turkey', currency: 'TRY' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR' }
]

export function currencyForCountry(code: string): string | undefined {
  return COUNTRIES.find(c => c.code === code)?.currency
}

/** Currencies Frankfurter (ECB) publishes. Anything else needs a manual rate. */
export const API_SUPPORTED_CURRENCIES = new Set([
  'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP',
  'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR',
  'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR'
])
```

- [ ] **Step 6: Run tests**

Run: `pnpm test`
Expected: PASS, all cases green.

- [ ] **Step 7: Commit**

```bash
git add shared test vitest.config.ts
git commit -m "feat: add shared domain categories, currencies and money math"
```

---

## Task 3: Summary computation (the money engine)

This is the highest-risk logic in the app. It gets its own task and thorough tests.

**Files:**
- Create: `shared/domain/summary.ts`
- Test: `test/summary.test.ts`

**Interfaces — Produces:**
```ts
export interface BudgetInput { category: ExpenseCategory, amount: number }        // JPY
export interface ExpenseInput { category: ExpenseCategory, amountHome: number }   // JPY
export interface CategorySummary {
  category: ExpenseCategory
  allowance: number
  actual: number
  remaining: number
  overBy: number          // 0 when within allowance
}
export interface TripSummary {
  perCategory: CategorySummary[]        // all 8, in EXPENSE_CATEGORIES order
  reimbursableAllowance: number
  reimbursableActual: number
  budgetRemaining: number
  perDiemAllowance: number
  perDiemActual: number
  perDiemRemaining: number
  advanceHome: number
  advanceRemaining: number
  returnToCompany: number               // > 0 employee returns; < 0 company owes employee
  companyOwesEmployee: number           // 0 when returnToCompany >= 0
  isOverBudget: boolean
  overBudgetBy: number
}
export function computeSummary(input: {
  budgets: BudgetInput[]
  expenses: ExpenseInput[]
  advanceHome: number
}): TripSummary
```

- [ ] **Step 1: Write the failing tests** — `test/summary.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { computeSummary } from '../shared/domain/summary'
import { EXPENSE_CATEGORIES } from '../shared/domain/categories'

const budgets = [
  { category: 'air_ticket' as const, amount: 120000 },
  { category: 'taxi_bus' as const, amount: 20000 },
  { category: 'hotel' as const, amount: 90000 },
  { category: 'train' as const, amount: 10000 },
  { category: 'travel_procedure' as const, amount: 15000 },
  { category: 'travel_insurance' as const, amount: 5000 },
  { category: 'other' as const, amount: 10000 },
  { category: 'per_diem' as const, amount: 60000 }
]

describe('computeSummary', () => {
  it('returns a row for every category in canonical order', () => {
    const s = computeSummary({ budgets, expenses: [], advanceHome: 0 })
    expect(s.perCategory.map(r => r.category)).toEqual([...EXPENSE_CATEGORIES])
  })

  it('treats missing budget rows as zero allowance', () => {
    const s = computeSummary({ budgets: [], expenses: [], advanceHome: 0 })
    expect(s.reimbursableAllowance).toBe(0)
    expect(s.perDiemAllowance).toBe(0)
  })

  it('excludes per diem from reimbursable totals', () => {
    const s = computeSummary({ budgets, expenses: [], advanceHome: 0 })
    expect(s.reimbursableAllowance).toBe(270000)
    expect(s.perDiemAllowance).toBe(60000)
  })

  it('computes budget remaining from reimbursable actuals only', () => {
    const s = computeSummary({
      budgets,
      expenses: [
        { category: 'hotel', amountHome: 80000 },
        { category: 'per_diem', amountHome: 50000 }
      ],
      advanceHome: 0
    })
    expect(s.reimbursableActual).toBe(80000)
    expect(s.budgetRemaining).toBe(190000)
    expect(s.perDiemActual).toBe(50000)
    expect(s.perDiemRemaining).toBe(10000)
  })

  it('per diem never affects return to company', () => {
    const s = computeSummary({
      budgets,
      expenses: [
        { category: 'hotel', amountHome: 80000 },
        { category: 'per_diem', amountHome: 60000 }
      ],
      advanceHome: 200000
    })
    expect(s.returnToCompany).toBe(120000)
    expect(s.advanceRemaining).toBe(120000)
    expect(s.companyOwesEmployee).toBe(0)
  })

  it('reports a negative return as company owing the employee', () => {
    const s = computeSummary({
      budgets,
      expenses: [{ category: 'air_ticket', amountHome: 250000 }],
      advanceHome: 200000
    })
    expect(s.returnToCompany).toBe(-50000)
    expect(s.companyOwesEmployee).toBe(50000)
  })

  it('flags over budget with the overage amount', () => {
    const s = computeSummary({
      budgets,
      expenses: [{ category: 'air_ticket', amountHome: 300000 }],
      advanceHome: 0
    })
    expect(s.isOverBudget).toBe(true)
    expect(s.overBudgetBy).toBe(30000)
  })

  it('is not over budget when exactly on budget', () => {
    const s = computeSummary({
      budgets,
      expenses: [{ category: 'air_ticket', amountHome: 270000 }],
      advanceHome: 0
    })
    expect(s.isOverBudget).toBe(false)
    expect(s.overBudgetBy).toBe(0)
  })

  it('reports per-category overage independently', () => {
    const s = computeSummary({
      budgets,
      expenses: [{ category: 'taxi_bus', amountHome: 25000 }],
      advanceHome: 0
    })
    const taxi = s.perCategory.find(r => r.category === 'taxi_bus')!
    expect(taxi.actual).toBe(25000)
    expect(taxi.remaining).toBe(-5000)
    expect(taxi.overBy).toBe(5000)
  })

  it('clamps per diem remaining display but keeps sign', () => {
    const s = computeSummary({
      budgets,
      expenses: [{ category: 'per_diem', amountHome: 70000 }],
      advanceHome: 0
    })
    expect(s.perDiemRemaining).toBe(-10000)
  })

  it('rounds to whole yen', () => {
    const s = computeSummary({
      budgets: [{ category: 'other', amount: 1000 }],
      expenses: [
        { category: 'other', amountHome: 333.33 },
        { category: 'other', amountHome: 333.33 }
      ],
      advanceHome: 0
    })
    expect(s.reimbursableActual).toBe(667)
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test test/summary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `shared/domain/summary.ts`**

```ts
import { EXPENSE_CATEGORIES, PER_DIEM, type ExpenseCategory, isReimbursable } from './categories'
import { HOME_CURRENCY, roundMoney } from './money'

export interface BudgetInput { category: ExpenseCategory, amount: number }
export interface ExpenseInput { category: ExpenseCategory, amountHome: number }

export interface CategorySummary {
  category: ExpenseCategory
  allowance: number
  actual: number
  remaining: number
  overBy: number
}

export interface TripSummary {
  perCategory: CategorySummary[]
  reimbursableAllowance: number
  reimbursableActual: number
  budgetRemaining: number
  perDiemAllowance: number
  perDiemActual: number
  perDiemRemaining: number
  advanceHome: number
  advanceRemaining: number
  returnToCompany: number
  companyOwesEmployee: number
  isOverBudget: boolean
  overBudgetBy: number
}

const yen = (value: number) => roundMoney(value, HOME_CURRENCY)

export function computeSummary(input: {
  budgets: BudgetInput[]
  expenses: ExpenseInput[]
  advanceHome: number
}): TripSummary {
  const allowanceOf = (category: ExpenseCategory) =>
    yen(input.budgets.filter(b => b.category === category).reduce((sum, b) => sum + b.amount, 0))

  const actualOf = (category: ExpenseCategory) =>
    yen(input.expenses.filter(e => e.category === category).reduce((sum, e) => sum + e.amountHome, 0))

  const perCategory: CategorySummary[] = EXPENSE_CATEGORIES.map((category) => {
    const allowance = allowanceOf(category)
    const actual = actualOf(category)
    const remaining = yen(allowance - actual)
    return { category, allowance, actual, remaining, overBy: remaining < 0 ? -remaining : 0 }
  })

  const reimbursable = perCategory.filter(r => isReimbursable(r.category))
  const reimbursableAllowance = yen(reimbursable.reduce((s, r) => s + r.allowance, 0))
  const reimbursableActual = yen(reimbursable.reduce((s, r) => s + r.actual, 0))
  const budgetRemaining = yen(reimbursableAllowance - reimbursableActual)

  const perDiem = perCategory.find(r => r.category === PER_DIEM)!
  const advanceHome = yen(input.advanceHome)
  const returnToCompany = yen(advanceHome - reimbursableActual)

  return {
    perCategory,
    reimbursableAllowance,
    reimbursableActual,
    budgetRemaining,
    perDiemAllowance: perDiem.allowance,
    perDiemActual: perDiem.actual,
    perDiemRemaining: perDiem.remaining,
    advanceHome,
    advanceRemaining: returnToCompany,
    returnToCompany,
    companyOwesEmployee: returnToCompany < 0 ? -returnToCompany : 0,
    isOverBudget: budgetRemaining < 0,
    overBudgetBy: budgetRemaining < 0 ? -budgetRemaining : 0
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/domain/summary.ts test/summary.test.ts
git commit -m "feat: add trip summary money engine with per-diem exclusion"
```

---

## Task 4: Database schema and client

**Files:**
- Create: `server/database/schema.ts`, `server/utils/db.ts`
- Generated: `server/database/migrations/*`

**Interfaces — Produces:** Drizzle tables `users`, `trips`, `tripBudgets`, `tripCurrencies`, `expenses`, `receipts`; enums `roleEnum`, `categoryEnum`, `tripStatusEnum`, `rateSourceEnum`; `useDb(event)` returning a Drizzle client with `schema` attached.

- [ ] **Step 1: Write `server/database/schema.ts`**

```ts
import { boolean, date, index, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('user_role', ['superadmin', 'admin', 'user'])
export const categoryEnum = pgEnum('expense_category', [
  'air_ticket', 'taxi_bus', 'hotel', 'train',
  'travel_procedure', 'travel_insurance', 'other', 'per_diem'
])
export const tripStatusEnum = pgEnum('trip_status', ['active', 'closed'])
export const rateSourceEnum = pgEnum('rate_source', ['api', 'manual'])

const money = (name: string) => numeric(name, { precision: 18, scale: 4, mode: 'number' })
const fxRate = (name: string) => numeric(name, { precision: 18, scale: 8, mode: 'number' })

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('user'),
  displayName: text('display_name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const trips = pgTable('trips', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  destinationCountry: text('destination_country').notNull(),
  defaultCurrency: text('default_currency').notNull(),
  homeCurrency: text('home_currency').notNull().default('JPY'),
  settlementCurrency: text('settlement_currency').notNull().default('IDR'),
  temporaryPaymentAmount: money('temporary_payment_amount').notNull().default(0),
  temporaryPaymentCurrency: text('temporary_payment_currency').notNull().default('JPY'),
  temporaryPaymentFxRateToHome: fxRate('temporary_payment_fx_rate_to_home').notNull().default(1),
  temporaryPaymentAmountHome: money('temporary_payment_amount_home').notNull().default(0),
  status: tripStatusEnum('status').notNull().default('active'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => [index('trips_user_id_idx').on(t.userId)])

export const tripBudgets = pgTable('trip_budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  category: categoryEnum('category').notNull(),
  amount: money('amount').notNull().default(0)
}, t => [index('trip_budgets_trip_id_idx').on(t.tripId)])

export const tripCurrencies = pgTable('trip_currencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  currency: text('currency').notNull()
}, t => [index('trip_currencies_trip_id_idx').on(t.tripId)])

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  category: categoryEnum('category').notNull(),
  amount: money('amount').notNull(),
  currency: text('currency').notNull(),
  fxRateToHome: fxRate('fx_rate_to_home').notNull(),
  amountHome: money('amount_home').notNull(),
  rateSource: rateSourceEnum('rate_source').notNull().default('api'),
  spentAt: date('spent_at').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => [index('expenses_trip_id_idx').on(t.tripId)])

export const receipts = pgTable('receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  expenseId: uuid('expense_id').notNull().references(() => expenses.id, { onDelete: 'cascade' }),
  r2Key: text('r2_key').notNull(),
  filename: text('filename').notNull(),
  contentType: text('content_type').notNull(),
  size: numeric('size', { precision: 12, scale: 0, mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => [index('receipts_expense_id_idx').on(t.expenseId)])
```

**If `numeric(..., { mode: 'number' })` does not typecheck** on the installed drizzle-orm version, change `money`/`fxRate` to plain `numeric(name, { precision, scale })` (which yields `string`) and add `server/utils/mappers.ts` exporting `num(v: string | number) => Number(v)`, applied wherever rows are read. Everything downstream takes `number`, so only the read boundary changes.

- [ ] **Step 2: Implement `server/utils/db.ts`**

```ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import type { H3Event } from 'h3'
import * as schema from '../database/schema'

let cached: { url: string, db: ReturnType<typeof drizzle<typeof schema>> } | null = null

export function useDb(event: H3Event) {
  const url = useRuntimeConfig(event).dbUrl
  if (!url) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_DB_URL is not configured' })
  }
  if (!cached || cached.url !== url) {
    cached = { url, db: drizzle(neon(url), { schema }) }
  }
  return cached.db
}

export { schema }
```

- [ ] **Step 3: Generate the migration**

Run: `pnpm db:generate`
Expected: SQL file appears in `server/database/migrations/`. Read it and confirm it creates the four enum types and six tables.

- [ ] **Step 4: Apply the migration to Neon**

Run: `pnpm db:migrate`
Expected: "migrations applied successfully".

- [ ] **Step 5: Verify against the database**

```bash
pnpm wrangler --version >/dev/null; node --env-file=.env -e "
import('@neondatabase/serverless').then(async ({ neon }) => {
  const sql = neon(process.env.NUXT_DB_URL)
  console.log(await sql\`select table_name from information_schema.tables where table_schema='public' order by 1\`)
})"
```
Expected: lists `expenses`, `receipts`, `trip_budgets`, `trip_currencies`, `trips`, `users` (plus drizzle's migration table).

- [ ] **Step 6: Commit**

```bash
git add server drizzle.config.ts
git commit -m "feat: add drizzle schema and neon http client"
```

---

## Task 5: Auth — RBAC predicate, guards, seeder, login

**Files:**
- Create: `shared/domain/rbac.ts`, `shared/types/auth.d.ts`, `server/utils/guard.ts`, `server/api/auth/login.post.ts`, `server/api/auth/logout.post.ts`, `server/api/admin/seed.post.ts`, `app/pages/login.vue`, `app/middleware/auth.global.ts`, `app/layouts/default.vue`, `app/layouts/blank.vue`
- Test: `test/rbac.test.ts`

**Interfaces — Produces:**
```ts
// shared/domain/rbac.ts
export type Role = 'superadmin' | 'admin' | 'user'
export type Action = 'manage_users' | 'own_trips' | 'any_trips'
export function can(role: Role, action: Action): boolean

// server/utils/guard.ts
export async function requireUser(event): Promise<SessionUser>
export async function requireRole(event, action: Action): Promise<SessionUser>
export async function requireTrip(event, tripId: string): Promise<Trip>       // owner or superadmin
export async function requireExpense(event, expenseId: string): Promise<{ expense: Expense, trip: Trip }>
```

- [ ] **Step 1: Write the failing RBAC test** — `test/rbac.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { can } from '../shared/domain/rbac'

describe('can', () => {
  it('lets only admin and superadmin manage users', () => {
    expect(can('admin', 'manage_users')).toBe(true)
    expect(can('superadmin', 'manage_users')).toBe(true)
    expect(can('user', 'manage_users')).toBe(false)
  })

  it('lets user and superadmin work with their own trips, but not admin', () => {
    expect(can('user', 'own_trips')).toBe(true)
    expect(can('superadmin', 'own_trips')).toBe(true)
    expect(can('admin', 'own_trips')).toBe(false)
  })

  it('lets only superadmin touch any user\'s trips', () => {
    expect(can('superadmin', 'any_trips')).toBe(true)
    expect(can('admin', 'any_trips')).toBe(false)
    expect(can('user', 'any_trips')).toBe(false)
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test test/rbac.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement `shared/domain/rbac.ts`**

```ts
export const ROLES = ['superadmin', 'admin', 'user'] as const
export type Role = typeof ROLES[number]

export type Action = 'manage_users' | 'own_trips' | 'any_trips'

const MATRIX: Record<Role, Action[]> = {
  superadmin: ['manage_users', 'own_trips', 'any_trips'],
  admin: ['manage_users'],
  user: ['own_trips']
}

export function can(role: Role, action: Action): boolean {
  return MATRIX[role]?.includes(action) ?? false
}
```

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Augment the session type** — `shared/types/auth.d.ts`

```ts
import type { Role } from '../domain/rbac'

declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    displayName: string
    role: Role
  }
}

export {}
```

- [ ] **Step 6: Implement `server/utils/guard.ts`**

`hashPassword` / `verifyPassword` are auto-imported Nitro utils from `nuxt-auth-utils` (scrypt, Workers-safe).

```ts
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { can, type Action } from '../../shared/domain/rbac'
import { schema, useDb } from './db'

export async function requireUser(event: H3Event) {
  const { user } = await requireUserSession(event)
  return user
}

export async function requireRole(event: H3Event, action: Action) {
  const user = await requireUser(event)
  if (!can(user.role, action)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return user
}

export async function requireTrip(event: H3Event, tripId: string) {
  const user = await requireUser(event)
  const db = useDb(event)
  const [trip] = await db.select().from(schema.trips).where(eq(schema.trips.id, tripId)).limit(1)
  if (!trip) throw createError({ statusCode: 404, statusMessage: 'Trip not found' })

  const isOwner = trip.userId === user.id && can(user.role, 'own_trips')
  if (!isOwner && !can(user.role, 'any_trips')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return trip
}

export async function requireExpense(event: H3Event, expenseId: string) {
  const db = useDb(event)
  const [expense] = await db.select().from(schema.expenses).where(eq(schema.expenses.id, expenseId)).limit(1)
  if (!expense) throw createError({ statusCode: 404, statusMessage: 'Expense not found' })
  const trip = await requireTrip(event, expense.tripId)
  return { expense, trip }
}
```

- [ ] **Step 7: Implement `server/api/auth/login.post.ts`**

```ts
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { schema, useDb } from '../../utils/db'

const body = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const { email, password } = body.parse(await readBody(event))
  const db = useDb(event)

  const [user] = await db.select().from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase())).limit(1)

  const invalid = () => createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  if (!user || !user.isActive) throw invalid()
  if (!await verifyPassword(user.passwordHash, password)) throw invalid()

  await setUserSession(event, {
    user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role }
  })
  return { ok: true }
})
```

Note: a deactivated user gets the same generic 401 — no account-status leak.

- [ ] **Step 8: Implement `server/api/auth/logout.post.ts`**

```ts
export default defineEventHandler(async (event) => {
  await clearUserSession(event)
  return { ok: true }
})
```

- [ ] **Step 9: Implement the seeder** — `server/api/admin/seed.post.ts`

Idempotent, token-guarded. Runs inside Nitro so `hashPassword` is available (a standalone Node script cannot reach it).

```ts
import { eq } from 'drizzle-orm'
import { schema, useDb } from '../../utils/db'

const SEED_USERS = [
  { email: 'superadmin@trip-ledger.local', displayName: 'Super Admin', role: 'superadmin' as const, password: 'superadmin123' },
  { email: 'admin@trip-ledger.local', displayName: 'Admin', role: 'admin' as const, password: 'admin123' },
  { email: 'user@trip-ledger.local', displayName: 'Traveller', role: 'user' as const, password: 'user123' }
]

export default defineEventHandler(async (event) => {
  const expected = useRuntimeConfig(event).seedToken
  if (!expected || getHeader(event, 'x-seed-token') !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = useDb(event)
  const results: string[] = []

  for (const seed of SEED_USERS) {
    const [existing] = await db.select({ id: schema.users.id }).from(schema.users)
      .where(eq(schema.users.email, seed.email)).limit(1)
    if (existing) {
      results.push(`skipped ${seed.email}`)
      continue
    }
    await db.insert(schema.users).values({
      email: seed.email,
      passwordHash: await hashPassword(seed.password),
      displayName: seed.displayName,
      role: seed.role
    })
    results.push(`created ${seed.email}`)
  }

  return { results }
})
```

- [ ] **Step 10: Global middleware** — `app/middleware/auth.global.ts`

```ts
import { can } from '../../shared/domain/rbac'

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession()

  if (to.path === '/login') {
    return loggedIn.value ? navigateTo('/') : undefined
  }
  if (!loggedIn.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
  if (to.path.startsWith('/admin') && !can(user.value!.role, 'manage_users')) {
    return navigateTo('/')
  }
  if (to.path === '/' && !can(user.value!.role, 'own_trips') && can(user.value!.role, 'manage_users')) {
    return navigateTo('/admin/users')
  }
})
```

The last rule sends a pure `admin` (no trip access) straight to user management, which is the only screen they can use.

- [ ] **Step 11: Layouts and login page**

`app/layouts/blank.vue` — centered slot only. `app/layouts/default.vue` — `UApp` shell with a header (app name, link to trips, link to Users when `can(role,'manage_users')`, `UDropdownMenu` user menu with Logout calling `$fetch('/api/auth/logout', { method: 'POST' })` then `clear()` from `useUserSession()` then `navigateTo('/login')`).

`app/pages/login.vue` — `definePageMeta({ layout: 'blank' })`; `UForm` with a zod schema (`email`, `password`), `UInput` fields, submit posts to `/api/auth/login`, on success `await fetch()` from `useUserSession()` then navigate to `route.query.redirect || '/'`; on error show the message in a `UAlert`. Show the three seeded credentials in a muted footnote for now.

- [ ] **Step 12: Verify end-to-end manually**

```bash
pnpm dev
# in another shell:
curl -X POST localhost:3000/api/admin/seed -H "x-seed-token: $NUXT_SEED_TOKEN"
```
Expected: `{"results":["created superadmin@...","created admin@...","created user@..."]}`. Re-run → all `skipped`. Then in the browser: visiting `/` redirects to `/login`; logging in as `user@trip-ledger.local` / `user123` lands on `/`; logging in as `admin@trip-ledger.local` lands on `/admin/users` (404 page for now — expected until Task 12); `/admin/users` as `user` redirects to `/`. Wrong password shows the error.

- [ ] **Step 13: Run checks and commit**

```bash
pnpm test && pnpm lint && pnpm typecheck
git add -A
git commit -m "feat: add authentication, role guards and role seeder"
```

---

## Task 6: FX rate service

**Files:**
- Create: `server/utils/fx.ts`, `server/api/fx/rate.get.ts`
- Test: `test/fx.test.ts`

**Interfaces — Produces:**
```ts
// server/utils/fx.ts
export interface RateResult { rate: number, date: string, source: 'api' }
export async function fetchRate(from: string, to: string, on?: string): Promise<RateResult>
export function parseFrankfurter(payload: unknown, to: string): { rate: number, date: string }
```
`GET /api/fx/rate?from=IDR&to=JPY&date=2026-08-20` → `{ rate, date, source }`, or `422` with `{ statusMessage: 'RATE_UNAVAILABLE' }` so the client can fall back to a manual rate.

- [ ] **Step 1: Write the failing test** — `test/fx.test.ts` (pure parser only; no network in tests)

```ts
import { describe, expect, it } from 'vitest'
import { parseFrankfurter } from '../server/utils/fx'

describe('parseFrankfurter', () => {
  it('extracts the rate and effective date', () => {
    const parsed = parseFrankfurter(
      { amount: 1, base: 'IDR', date: '2026-08-20', rates: { JPY: 0.0096 } },
      'JPY'
    )
    expect(parsed).toEqual({ rate: 0.0096, date: '2026-08-20' })
  })

  it('throws when the target currency is missing', () => {
    expect(() => parseFrankfurter({ date: '2026-08-20', rates: {} }, 'JPY')).toThrow()
  })

  it('throws on a malformed payload', () => {
    expect(() => parseFrankfurter(null, 'JPY')).toThrow()
  })
})
```

- [ ] **Step 2: Run and confirm failure.** Run: `pnpm test test/fx.test.ts` → FAIL.

- [ ] **Step 3: Implement `server/utils/fx.ts`**

```ts
export interface RateResult { rate: number, date: string, source: 'api' }

export function parseFrankfurter(payload: unknown, to: string): { rate: number, date: string } {
  const data = payload as { date?: string, rates?: Record<string, number> } | null
  const rate = data?.rates?.[to]
  if (!data?.date || typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`RATE_UNAVAILABLE: no ${to} rate in response`)
  }
  return { rate, date: data.date }
}

/** JPY-per-unit-of-`from` on `on` (YYYY-MM-DD), falling back to the latest published rate. */
export async function fetchRate(from: string, to: string, on?: string): Promise<RateResult> {
  if (from === to) {
    return { rate: 1, date: on ?? new Date().toISOString().slice(0, 10), source: 'api' }
  }
  const segment = on ?? 'latest'
  const url = `https://api.frankfurter.dev/v1/${segment}?base=${from}&symbols=${to}`
  const payload = await $fetch(url, { timeout: 5000 })
  const { rate, date } = parseFrankfurter(payload, to)
  return { rate, date, source: 'api' }
}
```

Frankfurter serves ECB reference rates: weekend/holiday dates resolve to the previous business day, which is returned in `date`. Currencies outside `API_SUPPORTED_CURRENCIES` will 404 — that is the manual-rate path.

- [ ] **Step 4: Implement `server/api/fx/rate.get.ts`**

```ts
import { z } from 'zod'
import { requireUser } from '../../utils/guard'
import { fetchRate } from '../../utils/fx'

const query = z.object({
  from: z.string().length(3),
  to: z.string().length(3),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
})

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const { from, to, date } = query.parse(getQuery(event))
  try {
    return await fetchRate(from.toUpperCase(), to.toUpperCase(), date)
  } catch {
    throw createError({ statusCode: 422, statusMessage: 'RATE_UNAVAILABLE' })
  }
})
```

- [ ] **Step 5: Verify against the live API**

```bash
pnpm dev
# logged in via browser cookie, or check the upstream directly:
curl "https://api.frankfurter.dev/v1/latest?base=IDR&symbols=JPY"
```
Expected: a JSON body with `rates.JPY` as a small positive number.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm test
git add server/utils/fx.ts server/api/fx test/fx.test.ts
git commit -m "feat: add frankfurter fx rate lookup with manual fallback signal"
```

---

## Task 7: Trip CRUD API + setup wizard

**Files:**
- Create: `server/api/trips/index.get.ts`, `server/api/trips/index.post.ts`, `server/api/trips/[id]/index.get.ts`, `server/api/trips/[id]/index.patch.ts`, `server/api/trips/[id]/index.delete.ts`, `app/pages/trips/new.vue`, `app/components/trip/BudgetForm.vue`
- Modify: `app/pages/index.vue`

**Interfaces — Produces:**
- `GET /api/trips` → trips visible to the caller (own; all for superadmin), newest first, each with `{ ...trip, reimbursableActual, budgetRemaining }`.
- `POST /api/trips` body:
  ```ts
  {
    name: string
    destinationCountry: string          // ISO-2 from COUNTRIES
    defaultCurrency: string             // 3-letter, prefilled from country
    settlementCurrency: string          // default 'IDR'
    startDate: string                   // YYYY-MM-DD
    endDate: string
    currencies: string[]                // enabled currencies for dropdowns
    budgets: { category: ExpenseCategory, amount: number }[]   // JPY, all 8
    temporaryPayment: { amount: number, currency: string }
  }
  ```
  → `{ id }`. Creates the trip, its 8 `trip_budgets` rows, and `trip_currencies` (deduped set of JPY + destination currency + settlement currency + user additions). Freezes the advance FX rate via `fetchRate(currency, 'JPY', startDate)`; on failure requires an explicit `temporaryPayment.fxRate` in the body, else 422 `RATE_UNAVAILABLE`.
- `GET /api/trips/:id` → `{ trip, budgets, currencies }`.
- `PATCH /api/trips/:id` → partial update of the same shape (superadmin can edit any; owner can edit own). Re-freezes the advance rate only when amount or currency changes. Accepts `status: 'closed'` to close the trip.
- `DELETE /api/trips/:id` → deletes the trip (DB cascade) **and** its R2 objects under `receipts/{tripId}/` (Task 9 provides `deleteReceiptPrefix`; until then, delete is registered but calls a stubbed helper that lists nothing — wire it in Task 9).

- [ ] **Step 1: Implement `POST /api/trips`**

Validate with zod. Require `can(role, 'own_trips')` for self-owned creation; `userId` defaults to the session user and may only be overridden by a superadmin. Insert trip → budgets → currencies. Since `neon-http` has no interactive transactions, use `db.transaction()` (batched over HTTP) or, if unsupported, insert in order and delete the trip row on a later failure so no half-built trip survives.

- [ ] **Step 2: Implement the remaining four trip routes** as specified above, each starting with `requireTrip(event, id)` (or `requireRole(event, 'own_trips')` for list/create).

- [ ] **Step 3: Build `app/components/trip/BudgetForm.vue`**

Iterate `EXPENSE_CATEGORIES`; one `UInputNumber` per category labelled with `CATEGORY_LABELS`; Per Diem rendered in a visually distinct block with the caption "Your personal budget — not returned to the company". Footer shows live `Reimbursable total`, `Per Diem`, and `Grand total` via `formatMoney(..., 'JPY')`. `defineModel<BudgetInput[]>()`.

- [ ] **Step 4: Build `app/pages/trips/new.vue`**

A single page with five `UCard` sections mirroring the spec: (1) name + country `USelectMenu` (from `COUNTRIES`; on change set `defaultCurrency = currencyForCountry(code)`) + date range; (2) enabled currencies multi-select seeded with JPY + destination + settlement; (3) `<BudgetForm>`; (4) Temporary Payment amount + currency, showing the fetched JPY equivalent live via `/api/fx/rate` with a manual-rate input appearing on `RATE_UNAVAILABLE`; (5) settlement currency select (default IDR). Submit → `POST /api/trips` → `navigateTo(\`/trips/${id}\`)`.

- [ ] **Step 5: Rewrite `app/pages/index.vue`**

`useFetch('/api/trips')`. Empty → `UCard` empty state: "No trips yet — create your first trip" + primary button to `/trips/new`. Non-empty → list of trip cards (name, destination flag/name, date range, status badge, budget remaining) linking to `/trips/:id`, plus a "New trip" button.

- [ ] **Step 6: Verify manually**

`pnpm dev`, log in as `user`, create a trip to Indonesia with realistic JPY budgets and a 200,000 JPY advance. Confirm: the currency prefills to IDR, the grand total updates live, submit succeeds, `/` now lists the trip. Then query the DB to confirm 8 budget rows and ≥3 currency rows exist for it.

- [ ] **Step 7: Checks and commit**

```bash
pnpm test && pnpm lint && pnpm typecheck
git add -A
git commit -m "feat: add trip crud api and trip setup wizard"
```

---

## Task 8: Expense CRUD + trip dashboard

**Files:**
- Create: `server/api/trips/[id]/summary.get.ts`, `server/api/trips/[id]/expenses.get.ts`, `server/api/expenses/index.post.ts`, `server/api/expenses/[id].patch.ts`, `server/api/expenses/[id].delete.ts`, `app/pages/trips/[id]/index.vue`, `app/components/trip/SummaryHeadline.vue`, `app/components/trip/CategoryBars.vue`, `app/components/expense/ExpenseForm.vue`, `app/components/expense/ExpenseList.vue`, `app/composables/useTrip.ts`

**Interfaces — Produces:**
- `GET /api/trips/:id/summary` → `{ trip, summary: TripSummary }` — reads budgets + expenses and calls `computeSummary` from `shared/domain/summary.ts`. **No money math is written here or in any Vue file.**
- `GET /api/trips/:id/expenses` → expenses newest-first, each with `receiptCount`.
- `POST /api/expenses` body:
  ```ts
  {
    tripId: string
    category: ExpenseCategory
    amount: number
    currency: string
    spentAt: string            // YYYY-MM-DD
    note?: string
    fxRate?: number            // required only when the API lookup failed
  }
  ```
  Server-side: `requireTrip`, reject if `trip.status === 'closed'`, then resolve the rate — `fetchRate(currency, 'JPY', spentAt)` with `rateSource: 'api'`; if that throws and `fxRate` was supplied use it with `rateSource: 'manual'`; otherwise 422 `RATE_UNAVAILABLE`. Compute `amountHome = toHome(amount, rate)`. Returns the created expense.
- `PATCH /api/expenses/:id` → same fields optional. Re-freezes the rate **only** when `amount`, `currency`, or `spentAt` changed; otherwise keeps the stored rate.
- `DELETE /api/expenses/:id` → deletes the row and its R2 objects (Task 9 wires the R2 part).

- [ ] **Step 1: Implement `summary.get.ts`**

```ts
import { eq } from 'drizzle-orm'
import { computeSummary } from '../../../../shared/domain/summary'
import { schema, useDb } from '../../../utils/db'
import { requireTrip } from '../../../utils/guard'

export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, 'id')!
  const trip = await requireTrip(event, tripId)
  const db = useDb(event)

  const [budgets, expenses] = await Promise.all([
    db.select().from(schema.tripBudgets).where(eq(schema.tripBudgets.tripId, tripId)),
    db.select().from(schema.expenses).where(eq(schema.expenses.tripId, tripId))
  ])

  return {
    trip,
    summary: computeSummary({
      budgets: budgets.map(b => ({ category: b.category, amount: b.amount })),
      expenses: expenses.map(e => ({ category: e.category, amountHome: e.amountHome })),
      advanceHome: trip.temporaryPaymentAmountHome
    })
  }
})
```

- [ ] **Step 2: Implement the four expense routes** as specified above.

- [ ] **Step 3: Build `SummaryHeadline.vue`**

Two large `UCard`s side by side: **Budget remaining** (reimbursable; red when `isOverBudget`, with "Over by ¥X") and **Per Diem remaining** with the badge "Yours — not returned". Below, a muted reconciliation row: advance, reimbursable actual, and `Return to company` (or `Company owes you ¥X` when negative). A `USwitch`/`UButtonGroup` toggles headline display between JPY and the trip's default currency, converting with the live rate from `/api/fx/rate` — label the converted figures "≈ indicative".

- [ ] **Step 4: Build `CategoryBars.vue`**

One row per category from `summary.perCategory`: icon + label, `UProgress` of `actual / allowance` (full and red when `overBy > 0`), and `actual / allowance` text. Per Diem row separated by a divider and captioned "Personal — excluded from the return calculation".

- [ ] **Step 5: Build `ExpenseForm.vue`**

`UModal` with `UForm` + zod: amount (`UInputNumber`), currency (`USelectMenu` of the trip's enabled currencies, defaulting to `trip.defaultCurrency`), category (`USelectMenu` of all 8 with icons), date (defaults to today, clamped to the trip range as a warning not a block), note, and the `<ReceiptUploader>` slot (Task 9). Shows a live "≈ ¥N" preview from `/api/fx/rate`; on `RATE_UNAVAILABLE` reveals a manual-rate `UInputNumber` with the hint "Rate unavailable for {currency} — enter JPY per 1 {currency}" and submits it as `fxRate`. Emits `saved` so the parent refreshes.

- [ ] **Step 6: Build `ExpenseList.vue` and the dashboard page**

List rows: date, category chip, original amount + currency, `≈ ¥N`, note, receipt-count badge (with a `manual rate` badge when `rateSource === 'manual'`), and edit/delete actions (delete behind a confirm modal; both hidden when `trip.status === 'closed'`). `app/pages/trips/[id]/index.vue` composes header (trip name, destination, dates, status, buttons for **Add expense**, **Report**, **Close trip**), `<SummaryHeadline>`, `<CategoryBars>`, `<ExpenseList>`, and refreshes summary + list after every mutation via `useTrip.ts`.

- [ ] **Step 7: Verify manually**

Add: 1,500,000 IDR hotel, 250,000 IDR taxi, and a 3,000 JPY per-diem expense. Confirm each shows a sensible JPY equivalent, that **Budget remaining** drops only for the two reimbursable ones, that **Per Diem remaining** drops only for the third, and that `Return to company` equals advance − reimbursable actual. Edit an amount and confirm the totals move. Delete one and confirm they move back.

- [ ] **Step 8: Checks and commit**

```bash
pnpm test && pnpm lint && pnpm typecheck
git add -A
git commit -m "feat: add expense crud and trip dashboard"
```

---

## Task 9: Receipts on R2

**Files:**
- Create: `server/utils/r2.ts`, `server/api/expenses/[id]/receipts.post.ts`, `server/api/expenses/[id]/receipts.get.ts`, `server/api/receipts/[id].get.ts`, `server/api/receipts/[id].delete.ts`, `app/components/expense/ReceiptUploader.vue`
- Modify: `server/api/expenses/[id].delete.ts`, `server/api/trips/[id]/index.delete.ts` (wire real R2 cleanup)

**Interfaces — Produces:**
```ts
// server/utils/r2.ts
export function useR2(event: H3Event): R2Bucket
export function receiptKey(tripId: string, expenseId: string, filename: string): string
export async function deleteReceiptPrefix(event: H3Event, prefix: string): Promise<number>
export const ALLOWED_RECEIPT_TYPES: string[]   // image/jpeg, image/png, image/webp, application/pdf
export const MAX_RECEIPT_BYTES: number         // 10 * 1024 * 1024
export const MAX_RECEIPTS_PER_EXPENSE: number  // 10
```

- [ ] **Step 1: Implement `server/utils/r2.ts`**

```ts
import type { R2Bucket } from '@cloudflare/workers-types'
import type { H3Event } from 'h3'

export const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024
export const MAX_RECEIPTS_PER_EXPENSE = 10

export function useR2(event: H3Event): R2Bucket {
  const bucket = (event.context.cloudflare?.env as { RECEIPTS?: R2Bucket } | undefined)?.RECEIPTS
  if (!bucket) {
    throw createError({ statusCode: 500, statusMessage: 'R2 binding RECEIPTS is unavailable' })
  }
  return bucket
}

export function receiptKey(tripId: string, expenseId: string, filename: string): string {
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : 'bin'
  return `receipts/${tripId}/${expenseId}/${crypto.randomUUID()}.${ext}`
}

export async function deleteReceiptPrefix(event: H3Event, prefix: string): Promise<number> {
  const bucket = useR2(event)
  let deleted = 0
  let cursor: string | undefined
  do {
    const listing = await bucket.list({ prefix, cursor })
    if (listing.objects.length) {
      await bucket.delete(listing.objects.map(o => o.key))
      deleted += listing.objects.length
    }
    cursor = listing.truncated ? listing.cursor : undefined
  } while (cursor)
  return deleted
}
```

- [ ] **Step 2: Implement upload** — `server/api/expenses/[id]/receipts.post.ts`

`requireExpense` → `readMultipartFormData(event)` → for each part with a filename: reject unless `ALLOWED_RECEIPT_TYPES.includes(type)` (400 `UNSUPPORTED_TYPE`) and `data.length <= MAX_RECEIPT_BYTES` (413 `FILE_TOO_LARGE`); reject if existing count + new count > `MAX_RECEIPTS_PER_EXPENSE` (400 `TOO_MANY_RECEIPTS`). Then `bucket.put(key, data, { httpMetadata: { contentType: type } })` and insert the `receipts` row. Return the created rows.

- [ ] **Step 3: Implement list / stream / delete**

- `receipts.get.ts` → `requireExpense` → receipt rows (id, filename, contentType, size) for thumbnails.
- `server/api/receipts/[id].get.ts` → look up the receipt, `requireExpense(event, receipt.expenseId)` (the ownership check), `bucket.get(key)`, then return the body with `Content-Type`, `Content-Length`, and `Cache-Control: private, max-age=3600`. 404 if the object is missing.
- `server/api/receipts/[id].delete.ts` → same guard, `bucket.delete(key)`, delete the row.

- [ ] **Step 4: Wire cleanup into the delete routes**

In `server/api/expenses/[id].delete.ts` call `deleteReceiptPrefix(event, \`receipts/${expense.tripId}/${expense.id}/\`)` before deleting the row. In `server/api/trips/[id]/index.delete.ts` call `deleteReceiptPrefix(event, \`receipts/${tripId}/\`)`.

- [ ] **Step 5: Build `ReceiptUploader.vue`**

`UFileUpload` (or a plain drag/drop zone) with `multiple`, `accept="image/*,application/pdf"`. Holds pending `File[]` before save with thumbnails from `URL.createObjectURL` (PDF → file icon) and a remove button per item; enforces the 10-file / 10 MB limits client-side with a `UAlert` on violation. In edit mode, shows already-saved receipts fetched from `receipts.get.ts`, thumbnailed from `/api/receipts/:id`, each with a delete button. Exposes `upload(expenseId)` which POSTs a `FormData` of pending files; the parent form calls it after the expense saves. Revoke object URLs on unmount.

- [ ] **Step 6: Verify manually**

Add an expense with three photos. Confirm thumbnails render, the expense list shows a `3` receipt badge, and `pnpm wrangler r2 object get` (or the local `.wrangler/state` directory in dev) contains the objects. Log out and hit `/api/receipts/:id` directly → 401. Log in as the *other* seeded `user`-role account → 403/404. Delete one receipt, then delete the expense, and confirm no objects remain under its prefix.

- [ ] **Step 7: Checks and commit**

```bash
pnpm test && pnpm lint && pnpm typecheck
git add -A
git commit -m "feat: add r2 receipt upload, authenticated serving and cleanup"
```

**Phase 1 complete: the app is usable end-to-end for logging a trip.** Stop here for review before Phase 2.

---

# Phase 2 — The report

## Task 10: Report assembly

**Files:**
- Create: `shared/domain/report.ts`, `server/api/reports/[tripId].get.ts`
- Test: `test/report.test.ts`

**Interfaces — Produces:**
```ts
export interface ReportExpense {
  id: string
  spentAt: string
  amount: number
  currency: string
  fxRateToHome: number
  amountHome: number
  rateSource: 'api' | 'manual'
  note: string | null
  receiptCount: number
}
export interface ReportCategory extends CategorySummary { expenses: ReportExpense[] }
export interface Report {
  summary: TripSummary
  reimbursable: ReportCategory[]   // 7, canonical order
  perDiem: ReportCategory
}
export function buildReport(input: {
  budgets: BudgetInput[]
  expenses: (ReportExpense & { category: ExpenseCategory })[]
  advanceHome: number
}): Report
```
`buildReport` **must** delegate all totals to `computeSummary` — it only groups the itemized rows.

- [ ] **Step 1: Write the failing test** — `test/report.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { buildReport } from '../shared/domain/report'
import { REIMBURSABLE_CATEGORIES } from '../shared/domain/categories'

const expense = (over: Partial<Record<string, unknown>>) => ({
  id: 'e1', spentAt: '2026-08-20', amount: 1500000, currency: 'IDR',
  fxRateToHome: 0.0096, amountHome: 14400, rateSource: 'api' as const,
  note: null, receiptCount: 2, category: 'hotel' as const, ...over
})

describe('buildReport', () => {
  it('returns the seven reimbursable categories in canonical order', () => {
    const r = buildReport({ budgets: [], expenses: [], advanceHome: 0 })
    expect(r.reimbursable.map(c => c.category)).toEqual([...REIMBURSABLE_CATEGORIES])
  })

  it('separates per diem from the reimbursable sections', () => {
    const r = buildReport({
      budgets: [{ category: 'per_diem', amount: 60000 }],
      expenses: [expense({ category: 'per_diem', id: 'p1', amountHome: 3000 })],
      advanceHome: 0
    })
    expect(r.perDiem.expenses).toHaveLength(1)
    expect(r.reimbursable.every(c => c.expenses.length === 0)).toBe(true)
    expect(r.summary.reimbursableActual).toBe(0)
    expect(r.summary.perDiemActual).toBe(3000)
  })

  it('itemizes expenses under their category and agrees with the summary', () => {
    const r = buildReport({
      budgets: [{ category: 'hotel', amount: 90000 }],
      expenses: [expense({}), expense({ id: 'e2', amountHome: 10000 })],
      advanceHome: 200000
    })
    const hotel = r.reimbursable.find(c => c.category === 'hotel')!
    expect(hotel.expenses.map(e => e.id)).toEqual(['e1', 'e2'])
    expect(hotel.actual).toBe(24400)
    expect(r.summary.returnToCompany).toBe(175600)
  })

  it('sorts expenses within a category by date', () => {
    const r = buildReport({
      budgets: [],
      expenses: [
        expense({ id: 'late', spentAt: '2026-08-25' }),
        expense({ id: 'early', spentAt: '2026-08-19' })
      ],
      advanceHome: 0
    })
    const hotel = r.reimbursable.find(c => c.category === 'hotel')!
    expect(hotel.expenses.map(e => e.id)).toEqual(['early', 'late'])
  })
})
```

- [ ] **Step 2: Run and confirm failure.** `pnpm test test/report.test.ts` → FAIL.

- [ ] **Step 3: Implement `shared/domain/report.ts`** — call `computeSummary`, then for each of the 8 categories attach `expenses` filtered by category and sorted by `spentAt` (stable, so equal dates keep input order). Split the per-diem row out into `perDiem`.

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Implement `server/api/reports/[tripId].get.ts`**

`requireTrip` → load trip, budgets, expenses (with `receiptCount` via a grouped count on `receipts`), and all receipts for the appendix. Call `buildReport`. Additionally resolve the settlement conversion: `fetchRate('JPY', trip.settlementCurrency)`; on failure return `settlement: null` rather than failing the whole report. Return:

```ts
{
  trip,
  report: Report,
  receipts: { id: string, expenseId: string, filename: string, contentType: string }[],
  settlement: { currency: string, rate: number, rateDate: string, amount: number } | null,
  generatedAt: string   // ISO
}
```
`settlement.amount = roundMoney(report.summary.returnToCompany * rate, trip.settlementCurrency)`.

- [ ] **Step 6: Commit**

```bash
pnpm test && pnpm lint && pnpm typecheck
git add -A
git commit -m "feat: add report assembly with settlement conversion"
```

---

## Task 11: Report page and trip closing

**Files:**
- Create: `app/pages/trips/[id]/report.vue`, `app/components/report/ReportHeader.vue`, `app/components/report/CategoryTable.vue`, `app/components/report/SettlementBlock.vue`, `app/components/report/ReceiptsAppendix.vue`
- Modify: `app/assets/css/main.css` (print styles), `app/pages/trips/[id]/index.vue` (Close trip action)

- [ ] **Step 1: Build the report sections** in the spec's order

1. `ReportHeader` — trip name, destination, date range, employee display name, generated-on date.
2. `CategoryTable` — one per reimbursable category: allowance / actual / variance header row, then itemized rows (date, original amount + currency, frozen rate, JPY equivalent, note, receipt count). Skip empty categories that also have a zero allowance.
3. Reimbursable totals + a prominent badge: `UNDER BUDGET by ¥X` (green) or `OVER BUDGET by ¥X` (red), from `summary.isOverBudget` / `overBudgetBy`.
4. `SettlementBlock` — advance (original amount + currency + JPY equivalent), total reimbursable actuals, **Return to company** in JPY (or "Company owes you ¥X"), and the settlement-currency figure labelled with the rate and its date. When `settlement === null`, render "Settlement rate unavailable — enter manually" with an input that recomputes client-side.
5. Per Diem summary — allowance / spent / remaining, captioned "Personal — kept by the employee, not reimbursed".
6. `ReceiptsAppendix` — receipt images grouped by expense at the end, `<img :src="\`/api/receipts/${id}\`">`; PDFs listed as links.

- [ ] **Step 2: Add print styles to `app/assets/css/main.css`**

```css
@media print {
  .no-print { display: none !important; }
  .print-break { break-before: page; }
  body { background: #fff; color: #000; }
  a[href]::after { content: none; }
}
```
Give the page's nav/buttons `class="no-print"` and the appendix `class="print-break"`. The page uses `layout: 'blank'` and a "Print / Save as PDF" button calling `window.print()`.

- [ ] **Step 3: Implement Close trip**

Dashboard button → confirm modal → `PATCH /api/trips/:id` with `{ status: 'closed' }` → navigate to the report. A closed trip renders a `Closed` badge, hides add/edit/delete affordances, and its API mutations are rejected server-side (already enforced in Task 8). Superadmin may reopen via `{ status: 'active' }`.

- [ ] **Step 4: Verify manually**

Open the report for the Task 8 test trip. Check: every logged expense appears exactly once under the right category; the reimbursable total equals the dashboard's; `Return to company` matches `advance − reimbursable actual`; per diem appears only in its own section; the IDR settlement figure is labelled with a rate and date; receipts render in the appendix. Print to PDF and confirm nav/buttons are gone and the appendix starts on a new page. Then close the trip and confirm editing is blocked in the UI **and** via a direct `curl` POST to `/api/expenses`.

- [ ] **Step 5: Checks and commit**

```bash
pnpm test && pnpm lint && pnpm typecheck
git add -A
git commit -m "feat: add printable settlement report and trip closing"
```

**Phase 2 complete.** Stop for review.

---

# Phase 3 — Administration and deployment

## Task 12: Admin user management

**Files:**
- Create: `server/api/users/index.get.ts`, `server/api/users/index.post.ts`, `server/api/users/[id].patch.ts`, `app/pages/admin/users.vue`
- Modify: `app/layouts/default.vue` (show the Users nav link)

**Interfaces — Produces:**
- `GET /api/users` → `{ id, email, displayName, role, isActive, createdAt }[]` (never `passwordHash`). Requires `manage_users`.
- `POST /api/users` `{ email, displayName, role, password }` → `{ id }`. Requires `manage_users`. **An `admin` may only create `role: 'user'`; only a `superadmin` may create `admin` or `superadmin`** — enforce with a 403. Email lowercased and unique (409 on conflict). Password minimum 8 characters, hashed with `hashPassword`.
- `PATCH /api/users/:id` `{ displayName?, role?, isActive?, password? }`. Same role-escalation rule. A user may not deactivate or demote themselves (400). Only a superadmin may change an existing user's role.

- [ ] **Step 1: Implement the three routes** with the rules above.
- [ ] **Step 2: Build `app/pages/admin/users.vue`** — `UTable` of users (email, name, role badge, active toggle, created date), a "New user" `UModal` form, an edit modal, and a "Reset password" action. Role options filtered by the actor's own role.
- [ ] **Step 3: Verify manually** — as `admin`: create a `user`, log in as them, confirm they see the empty trip state; confirm the role dropdown offers only `user`; confirm `curl`ing `POST /api/users` with `role: 'superadmin'` as the admin returns 403; deactivate the new user and confirm login now fails; confirm `admin` gets 403 from `GET /api/trips`. As `superadmin`: confirm all roles are offered and self-demotion is refused.
- [ ] **Step 4:** `pnpm test && pnpm lint && pnpm typecheck`, then commit `feat: add admin user management`.

---

## Task 13: Superadmin cross-user access

**Files:**
- Modify: `server/api/trips/index.get.ts`, `app/pages/index.vue`, `app/layouts/default.vue`

- [ ] **Step 1:** In `GET /api/trips`, when `can(role, 'any_trips')`, drop the owner filter and join `users` so each trip carries `ownerName` / `ownerEmail`; accept an optional `?userId=` filter. `requireTrip` already permits superadmin on every other route.
- [ ] **Step 2:** On `/`, when the session role is `superadmin`, show an owner column/badge on each trip card and a `USelectMenu` "Viewing: all users / <user>" bound to `?userId=`.
- [ ] **Step 3: Verify manually** — as `superadmin`, see the `user` account's trip, open it, edit one of its expenses, and confirm the change is visible when logged back in as that user.
- [ ] **Step 4:** Checks, then commit `feat: let superadmin view and edit any user's trips`.

---

## Task 14: Deploy to Cloudflare

**Files:** none new (uses `wrangler.jsonc` from Task 1).

- [ ] **Step 1: Push secrets**

```bash
pnpm wrangler secret put NUXT_DB_URL
pnpm wrangler secret put NUXT_SESSION_PASSWORD
pnpm wrangler secret put NUXT_SEED_TOKEN
```

- [ ] **Step 2: Build and deploy**

```bash
pnpm deploy
```
Expected: a `*.workers.dev` URL. If the build complains about a Node built-in, confirm `nodejs_compat` is in `compatibility_flags`.

- [ ] **Step 3: Seed production**

```bash
curl -X POST https://<worker-url>/api/admin/seed -H "x-seed-token: <token>"
```

- [ ] **Step 4: Production smoke test**

Log in as `user`, create a one-expense trip with one receipt photo, open the report, print to PDF. Confirm the receipt loads from R2 in production and the settlement figure appears. Check `pnpm wrangler tail` for errors.

- [ ] **Step 5: Rotate and lock down**

Change all three seeded passwords through the app (or via the admin screen), and rotate the Neon password that is exposed in git history — updating both `.env` and the Worker secret.

- [ ] **Step 6: Add CI test step**

In `.github/workflows/ci.yml`, add after Lint:
```yaml
      - name: Test
        run: pnpm run test
```

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run unit tests"
```

---

## Verification

**Automated** — must pass before any task is considered done:
```bash
pnpm test        # money math, summary, report, fx parsing, rbac
pnpm lint
pnpm typecheck
```

**Money correctness — the checks that matter most.** Using the Phase 1 test trip (advance ¥200,000; budgets: air 120k, taxi 20k, hotel 90k, train 10k, procedure 15k, insurance 5k, other 10k, per diem 60k):

| Scenario | Expected |
|---|---|
| Log ¥80,000 hotel | Budget remaining ¥190,000; Per Diem remaining ¥60,000; Return to company ¥120,000 |
| Also log ¥60,000 per diem | Budget remaining unchanged at ¥190,000; Per Diem remaining ¥0; **Return to company still ¥120,000** |
| Log a ¥250,000 air ticket | Return to company shows "Company owes you"; report badge reads OVER BUDGET |
| Log 1,500,000 IDR, then check the report a day later | The JPY figure is byte-identical — the frozen rate is used, not a fresh one |
| Log an expense in a currency Frankfurter lacks | Manual-rate prompt appears; saved row is badged `manual rate` |

**Access control** — run each as a raw `curl` with the wrong session, not just through the UI:
- Unauthenticated `GET /api/trips`, `GET /api/receipts/:id` → 401.
- `user` A requesting `user` B's trip / expense / receipt → 403 or 404.
- `admin` requesting `GET /api/trips` → 403; `GET /api/users` → 200.
- `admin` posting `role: 'superadmin'` to `/api/users` → 403.
- `superadmin` requesting any user's trip → 200.
- Deactivated user login → 401.
- Any mutation on a `closed` trip → 4xx.

**End-to-end** — the real flow, in production, once: log in → create trip → log 4 expenses across 3 currencies with photos → dashboard numbers correct → close trip → report → Save as PDF → confirm the PDF shows itemized categories, budget health, and the IDR return figure.

---

## Open items to raise with the user

- The Neon connection string is committed in `.env.example` in git history. It should be rotated in the Neon console once the app is running (Task 14 Step 5).
- Migrations and the seeder run against the Neon database named `production`, per your choice. If you later want a safety net, create a Neon dev branch and point local `NUXT_DB_URL` at it — nothing in this plan hard-codes the database.
