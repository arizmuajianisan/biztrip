import { z } from 'zod'
import { EXPENSE_CATEGORIES } from '../../shared/domain/categories'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const currency = z.string().regex(/^[A-Z]{3}$/, 'Expected a 3-letter currency code')

export const budgetInputSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().min(0).max(1_000_000_000)
})

export const tripCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  destinationCountry: z.string().regex(/^[A-Z]{2}$/),
  defaultCurrency: currency,
  settlementCurrency: currency,
  startDate: isoDate,
  endDate: isoDate,
  currencies: z.array(currency).min(1).max(20),
  budgets: z.array(budgetInputSchema).max(EXPENSE_CATEGORIES.length),
  temporaryPayment: z.object({
    amount: z.number().min(0).max(1_000_000_000),
    currency,
    fxRate: z.number().positive().optional()
  }),
  userId: z.string().uuid().optional()
}).refine(v => v.endDate >= v.startDate, {
  message: 'End date must not be before the start date',
  path: ['endDate']
})

export const tripUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  destinationCountry: z.string().regex(/^[A-Z]{2}$/).optional(),
  defaultCurrency: currency.optional(),
  settlementCurrency: currency.optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  currencies: z.array(currency).min(1).max(20).optional(),
  budgets: z.array(budgetInputSchema).max(EXPENSE_CATEGORIES.length).optional(),
  temporaryPayment: z.object({
    amount: z.number().min(0).max(1_000_000_000),
    currency,
    fxRate: z.number().positive().optional()
  }).optional(),
  status: z.enum(['active', 'closed']).optional()
})

/** JPY + destination + settlement are always available, in a stable order. */
export function normalizeCurrencies(input: string[], defaultCurrency: string, settlementCurrency: string): string[] {
  return [...new Set(['JPY', defaultCurrency, settlementCurrency, ...input])]
}
