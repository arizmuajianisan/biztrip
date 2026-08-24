import { count, desc, eq } from 'drizzle-orm'
import { schema, useDb } from '../../../utils/db'
import { requireTrip } from '../../../utils/guard'

export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, 'id')!
  await requireTrip(event, tripId)
  const db = useDb(event)

  const [rows, receiptCounts] = await Promise.all([
    db.select().from(schema.expenses)
      .where(eq(schema.expenses.tripId, tripId))
      .orderBy(desc(schema.expenses.spentAt), desc(schema.expenses.createdAt)),
    db.select({ expenseId: schema.receipts.expenseId, total: count() })
      .from(schema.receipts)
      .innerJoin(schema.expenses, eq(schema.expenses.id, schema.receipts.expenseId))
      .where(eq(schema.expenses.tripId, tripId))
      .groupBy(schema.receipts.expenseId)
  ])

  const counts = new Map(receiptCounts.map(r => [r.expenseId, r.total]))
  return rows.map(row => ({ ...row, receiptCount: counts.get(row.id) ?? 0 }))
})
