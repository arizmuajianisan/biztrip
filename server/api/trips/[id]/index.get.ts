import { eq } from 'drizzle-orm'
import { schema, useDb } from '../../../utils/db'
import { requireTrip } from '../../../utils/guard'

export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, 'id')!
  const trip = await requireTrip(event, tripId)
  const db = useDb(event)

  const [budgets, currencies] = await Promise.all([
    db.select().from(schema.tripBudgets).where(eq(schema.tripBudgets.tripId, tripId)),
    db.select().from(schema.tripCurrencies).where(eq(schema.tripCurrencies.tripId, tripId))
  ])

  return { trip, budgets, currencies: currencies.map(c => c.currency) }
})
