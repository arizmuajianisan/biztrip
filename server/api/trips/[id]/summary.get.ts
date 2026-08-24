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
