import { eq } from 'drizzle-orm'
import { EXPENSE_CATEGORIES } from '../../../shared/domain/categories'
import { schema, useDb } from '../../utils/db'
import { requireRole } from '../../utils/guard'
import { freezePayment, normalizeCurrencies, tripCreateSchema } from '../../utils/trip'
import { can } from '../../../shared/domain/rbac'
import { validate } from '../../utils/validate'

export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, 'own_trips')
  const input = validate(tripCreateSchema, await readBody(event))

  // Only a superadmin may create a trip on somebody else's behalf.
  if (input.userId && input.userId !== actor.id && !can(actor.role, 'any_trips')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  const ownerId = input.userId ?? actor.id

  const advance = await freezePayment(input.temporaryPayment, input.startDate)
  const additional = input.additionalPayment
    ? await freezePayment(input.additionalPayment, input.startDate)
    : null

  const db = useDb(event)
  const [trip] = await db.insert(schema.trips).values({
    userId: ownerId,
    name: input.name,
    destinationCountry: input.destinationCountry,
    defaultCurrency: input.defaultCurrency,
    settlementCurrency: input.settlementCurrency,
    temporaryPaymentAmount: advance.amount,
    temporaryPaymentCurrency: advance.currency,
    temporaryPaymentFxRateToHome: advance.rate,
    temporaryPaymentAmountHome: advance.amountHome,
    additionalPaymentAmount: additional?.amount ?? 0,
    additionalPaymentCurrency: additional?.currency ?? 'JPY',
    additionalPaymentFxRateToHome: additional?.rate ?? 1,
    additionalPaymentAmountHome: additional?.amountHome ?? 0,
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
