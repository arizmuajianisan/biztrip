import { eq } from 'drizzle-orm'
import { schema, useDb } from '../../utils/db'
import { assertTripOpen, requireExpense } from '../../utils/guard'
import { deleteReceiptPrefix, expensePrefix } from '../../utils/r2'

export default defineEventHandler(async (event) => {
  const expenseId = getRouterParam(event, 'id')!
  const { expense, trip } = await requireExpense(event, expenseId)
  assertTripOpen(trip)

  await deleteReceiptPrefix(event, expensePrefix(trip.id, expense.id))

  const db = useDb(event)
  await db.delete(schema.expenses).where(eq(schema.expenses.id, expenseId))
  return { ok: true }
})
