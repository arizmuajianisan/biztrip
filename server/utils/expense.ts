import { and, eq, max } from 'drizzle-orm'
import { z } from 'zod'
import { EXPENSE_CATEGORIES } from '../../shared/domain/categories'
import type { useDb } from './db'
import { schema } from './db'
import { fetchRate } from './fx'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const currency = z.string().regex(/^[A-Z]{3}$/, 'Expected a 3-letter currency code')

export const expenseCreateSchema = z.object({
  tripId: z.string().uuid(),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().positive().max(1_000_000_000),
  currency,
  spentAt: isoDate,
  note: z.string().trim().max(500).optional(),
  fxRate: z.number().positive().optional()
})

export const expenseUpdateSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  amount: z.number().positive().max(1_000_000_000).optional(),
  currency: currency.optional(),
  spentAt: isoDate.optional(),
  note: z.string().trim().max(500).nullable().optional(),
  fxRate: z.number().positive().optional()
})

/**
 * The next free position on a given day. New expenses land at the end of their
 * day; the caller nudges them into place afterwards if the order matters.
 */
export async function nextSortIndex(
  db: ReturnType<typeof useDb>,
  tripId: string,
  spentAt: string
): Promise<number> {
  const [row] = await db
    .select({ highest: max(schema.expenses.sortIndex) })
    .from(schema.expenses)
    .where(and(eq(schema.expenses.tripId, tripId), eq(schema.expenses.spentAt, spentAt)))
  return (row?.highest ?? 0) + 1
}

/**
 * Resolves the rate to freeze onto an expense. Prefers the published rate for the
 * spend date; falls back to a caller-supplied manual rate so logging is never
 * blocked by an unsupported currency or an unreachable API.
 */
export async function resolveRate(currencyCode: string, spentAt: string, manualRate?: number): Promise<{
  rate: number
  source: 'api' | 'manual'
}> {
  if (currencyCode === 'JPY') return { rate: 1, source: 'api' }
  try {
    return { rate: (await fetchRate(currencyCode, 'JPY', spentAt)).rate, source: 'api' }
  } catch {
    if (manualRate !== undefined) return { rate: manualRate, source: 'manual' }
    throw createError({ statusCode: 422, statusMessage: 'RATE_UNAVAILABLE' })
  }
}
