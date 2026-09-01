import { eq } from 'drizzle-orm'
import { EXPENSE_CATEGORIES } from '../../../../shared/domain/categories'
import { schema, useDb } from '../../../utils/db'
import { can } from '../../../../shared/domain/rbac'
import { requireTrip, requireUser } from '../../../utils/guard'
import { freezePayment, normalizeCurrencies, tripUpdateSchema } from '../../../utils/trip'
import { validate } from '../../../utils/validate'

export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, 'id')!
  const trip = await requireTrip(event, tripId)
  const actor = await requireUser(event)
  const input = validate(tripUpdateSchema, await readBody(event))
  const db = useDb(event)

  // Every permission and state check runs before the first write, so a refused
  // request can never leave the trip half-updated.
  if (input.budgets && !can(actor.role, 'manage_budgets')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only an admin or superadmin may change budgets'
    })
  }

  // Closing a trip fixes the report that went to finance. Budgets and the cash
  // advance both feed that report, so neither may move once the trip is closed.
  // Reopening (status back to `active`) is the way to make a correction.
  const closed = trip.status === 'closed'
  if (closed && input.budgets) {
    throw createError({ statusCode: 409, statusMessage: 'Reopen the trip to change its budgets' })
  }
  if (closed && (input.temporaryPayment || input.additionalPayment)) {
    throw createError({ statusCode: 409, statusMessage: 'Reopen the trip to change the cash advance' })
  }

  const patch: Partial<typeof schema.trips.$inferInsert> = {}
  if (input.name !== undefined) patch.name = input.name

  if (input.userId !== undefined && input.userId !== trip.userId) {
    if (!can(actor.role, 'any_trips')) {
      throw createError({ statusCode: 403, statusMessage: 'You may not reassign this trip' })
    }
    const [target] = await db.select({ role: schema.users.role, isActive: schema.users.isActive })
      .from(schema.users).where(eq(schema.users.id, input.userId)).limit(1)
    if (!target) {
      throw createError({ statusCode: 400, statusMessage: 'That user does not exist' })
    }
    // Every role can currently own trips, so this is a guard against a future
    // matrix change silently orphaning a trip with a new owner who cannot see it.
    if (!can(target.role, 'own_trips')) {
      throw createError({ statusCode: 400, statusMessage: 'That user cannot own trips' })
    }
    if (!target.isActive) {
      throw createError({ statusCode: 400, statusMessage: 'That account is deactivated' })
    }
    patch.userId = input.userId
  }

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

  // Re-freeze a payment's rate only when the payment itself changed.
  if (input.temporaryPayment) {
    const p = input.temporaryPayment
    const unchanged = p.amount === trip.temporaryPaymentAmount
      && p.currency === trip.temporaryPaymentCurrency
    const frozen = await freezePayment(
      { ...p, fxRate: p.fxRate ?? (unchanged ? trip.temporaryPaymentFxRateToHome : undefined) },
      start
    )
    patch.temporaryPaymentAmount = frozen.amount
    patch.temporaryPaymentCurrency = frozen.currency
    patch.temporaryPaymentFxRateToHome = frozen.rate
    patch.temporaryPaymentAmountHome = frozen.amountHome
  }

  if (input.additionalPayment) {
    const p = input.additionalPayment
    const unchanged = p.amount === trip.additionalPaymentAmount
      && p.currency === trip.additionalPaymentCurrency
    const frozen = await freezePayment(
      { ...p, fxRate: p.fxRate ?? (unchanged ? trip.additionalPaymentFxRateToHome : undefined) },
      start
    )
    patch.additionalPaymentAmount = frozen.amount
    patch.additionalPaymentCurrency = frozen.currency
    patch.additionalPaymentFxRateToHome = frozen.rate
    patch.additionalPaymentAmountHome = frozen.amountHome
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
