import { eq } from 'drizzle-orm'
import { EXPENSE_CATEGORIES } from '../../../../shared/domain/categories'
import { toHome } from '../../../../shared/domain/money'
import { schema, useDb } from '../../../utils/db'
import { fetchRate } from '../../../utils/fx'
import { requireTrip } from '../../../utils/guard'
import { normalizeCurrencies, tripUpdateSchema } from '../../../utils/trip'
import { validate } from '../../../utils/validate'

export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, 'id')!
  const trip = await requireTrip(event, tripId)
  const input = validate(tripUpdateSchema, await readBody(event))
  const db = useDb(event)

  const patch: Partial<typeof schema.trips.$inferInsert> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.destinationCountry !== undefined) patch.destinationCountry = input.destinationCountry
  if (input.defaultCurrency !== undefined) patch.defaultCurrency = input.defaultCurrency
  if (input.settlementCurrency !== undefined) patch.settlementCurrency = input.settlementCurrency
  if (input.startDate !== undefined) patch.startDate = input.startDate
  if (input.endDate !== undefined) patch.endDate = input.endDate
  if (input.status !== undefined) patch.status = input.status

  const start = patch.startDate ?? trip.startDate
  const end = patch.endDate ?? trip.endDate
  if (end < start) {
    throw createError({ statusCode: 400, statusMessage: 'End date must not be before the start date' })
  }

  // Re-freeze the advance rate only when the advance itself changed.
  const advance = input.temporaryPayment
  if (advance) {
    const changed = advance.amount !== trip.temporaryPaymentAmount
      || advance.currency !== trip.temporaryPaymentCurrency
    let rate = advance.fxRate ?? (changed ? undefined : trip.temporaryPaymentFxRateToHome)
    if (advance.currency === 'JPY') {
      rate = 1
    } else if (rate === undefined) {
      try {
        rate = (await fetchRate(advance.currency, 'JPY', start)).rate
      } catch {
        throw createError({ statusCode: 422, statusMessage: 'RATE_UNAVAILABLE' })
      }
    }
    patch.temporaryPaymentAmount = advance.amount
    patch.temporaryPaymentCurrency = advance.currency
    patch.temporaryPaymentFxRateToHome = rate
    patch.temporaryPaymentAmountHome = toHome(advance.amount, rate)
  }

  if (Object.keys(patch).length) {
    await db.update(schema.trips).set(patch).where(eq(schema.trips.id, tripId))
  }

  if (input.budgets) {
    const amountFor = (category: typeof EXPENSE_CATEGORIES[number]) =>
      input.budgets!.find(b => b.category === category)?.amount ?? 0
    await db.delete(schema.tripBudgets).where(eq(schema.tripBudgets.tripId, tripId))
    await db.insert(schema.tripBudgets).values(
      EXPENSE_CATEGORIES.map(category => ({ tripId, category, amount: amountFor(category) }))
    )
  }

  if (input.currencies) {
    const currencies = normalizeCurrencies(
      input.currencies,
      patch.defaultCurrency ?? trip.defaultCurrency,
      patch.settlementCurrency ?? trip.settlementCurrency
    )
    await db.delete(schema.tripCurrencies).where(eq(schema.tripCurrencies.tripId, tripId))
    await db.insert(schema.tripCurrencies).values(currencies.map(currency => ({ tripId, currency })))
  }

  return { ok: true }
})
