import { desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { can } from '../../../shared/domain/rbac'
import { computeSummary } from '../../../shared/domain/summary'
import { schema, useDb } from '../../utils/db'
import { requireRole } from '../../utils/guard'
import { validate } from '../../utils/validate'

const query = z.object({ userId: z.string().uuid().optional() })

export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, 'own_trips')
  const { userId } = validate(query, getQuery(event))
  const db = useDb(event)

  const seesEveryone = can(actor.role, 'any_trips')
  const ownerFilter = seesEveryone ? userId : actor.id

  const rows = await db
    .select({ trip: schema.trips, ownerName: schema.users.displayName, ownerEmail: schema.users.email })
    .from(schema.trips)
    .innerJoin(schema.users, eq(schema.users.id, schema.trips.userId))
    .where(ownerFilter ? eq(schema.trips.userId, ownerFilter) : undefined)
    .orderBy(desc(schema.trips.startDate), desc(schema.trips.createdAt))

  if (!rows.length) return []

  const tripIds = rows.map(r => r.trip.id)
  const [budgets, expenses] = await Promise.all([
    db.select().from(schema.tripBudgets).where(inArray(schema.tripBudgets.tripId, tripIds)),
    db.select().from(schema.expenses).where(inArray(schema.expenses.tripId, tripIds))
  ])

  return rows.map(({ trip, ownerName, ownerEmail }) => {
    const summary = computeSummary({
      budgets: budgets.filter(b => b.tripId === trip.id),
      expenses: expenses.filter(e => e.tripId === trip.id),
      advanceHome: trip.temporaryPaymentAmountHome,
      additionalAdvanceHome: trip.additionalPaymentAmountHome
    })
    return {
      ...trip,
      ownerName,
      ownerEmail,
      reimbursableActual: summary.reimbursableActual,
      reimbursableAllowance: summary.reimbursableAllowance,
      budgetRemaining: summary.budgetRemaining,
      isOverBudget: summary.isOverBudget
    }
  })
})
