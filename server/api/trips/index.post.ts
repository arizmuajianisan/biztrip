import { eq } from 'drizzle-orm'
import { EXPENSE_CATEGORIES } from '../../../shared/domain/categories'
import { toHome } from '../../../shared/domain/money'
import { schema, useDb } from '../../utils/db'
import { fetchRate } from '../../utils/fx'
import { requireRole } from '../../utils/guard'
import { normalizeCurrencies, tripCreateSchema } from '../../utils/trip'
import { can } from '../../../shared/domain/rbac'

export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, 'own_trips')
  const input = tripCreateSchema.parse(await readBody(event))

  // Only a superadmin may create a trip on somebody else's behalf.
  if (input.userId && input.userId !== actor.id && !can(actor.role, 'any_trips')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  const ownerId = input.userId ?? actor.id

  const advance = input.temporaryPayment
  let advanceRate = advance.fxRate
  if (advance.currency === 'JPY') {
    advanceRate = 1
  } else if (advanceRate === undefined) {
    try {
      advanceRate = (await fetchRate(advance.currency, 'JPY', input.startDate)).rate
    } catch {
      throw createError({ statusCode: 422, statusMessage: 'RATE_UNAVAILABLE' })
    }
  }

  const db = useDb(event)
  const [trip] = await db.insert(schema.trips).values({
    userId: ownerId,
    name: input.name,
    destinationCountry: input.destinationCountry,
    defaultCurrency: input.defaultCurrency,
    settlementCurrency: input.settlementCurrency,
    temporaryPaymentAmount: advance.amount,
    temporaryPaymentCurrency: advance.currency,
    temporaryPaymentFxRateToHome: advanceRate,
    temporaryPaymentAmountHome: toHome(advance.amount, advanceRate),
    startDate: input.startDate,
    endDate: input.endDate
  }).returning()

  // neon-http has no interactive transactions: roll the trip back by hand so a
  // failure never leaves a trip without its budget rows.
  try {
    const budgetFor = (category: typeof EXPENSE_CATEGORIES[number]) =>
      input.budgets.find(b => b.category === category)?.amount ?? 0

    await db.insert(schema.tripBudgets).values(
      EXPENSE_CATEGORIES.map(category => ({ tripId: trip!.id, category, amount: budgetFor(category) }))
    )
    await db.insert(schema.tripCurrencies).values(
      normalizeCurrencies(input.currencies, input.defaultCurrency, input.settlementCurrency)
        .map(currency => ({ tripId: trip!.id, currency }))
    )
  } catch (error) {
    await db.delete(schema.trips).where(eq(schema.trips.id, trip!.id))
    throw error
  }

  setResponseStatus(event, 201)
  return { id: trip!.id }
})
