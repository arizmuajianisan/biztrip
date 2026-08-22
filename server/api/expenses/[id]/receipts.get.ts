import { asc, eq } from 'drizzle-orm'
import { schema, useDb } from '../../../utils/db'
import { requireExpense } from '../../../utils/guard'

export default defineEventHandler(async (event) => {
  const expenseId = getRouterParam(event, 'id')!
  await requireExpense(event, expenseId)
  const db = useDb(event)

  return db.select({
    id: schema.receipts.id,
    filename: schema.receipts.filename,
    contentType: schema.receipts.contentType,
    size: schema.receipts.size,
    createdAt: schema.receipts.createdAt
  }).from(schema.receipts)
    .where(eq(schema.receipts.expenseId, expenseId))
    .orderBy(asc(schema.receipts.createdAt))
})
