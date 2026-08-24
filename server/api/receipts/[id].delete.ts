import { eq } from 'drizzle-orm'
import { schema, useDb } from '../../utils/db'
import { assertTripOpen, requireExpense } from '../../utils/guard'
import { useR2 } from '../../utils/r2'

export default defineEventHandler(async (event) => {
  const receiptId = getRouterParam(event, 'id')!
  const db = useDb(event)

  const [receipt] = await db.select().from(schema.receipts)
    .where(eq(schema.receipts.id, receiptId)).limit(1)
  if (!receipt) throw createError({ statusCode: 404, statusMessage: 'Receipt not found' })

  const { trip } = await requireExpense(event, receipt.expenseId)
  assertTripOpen(trip)

  await useR2(event).delete(receipt.r2Key)
  await db.delete(schema.receipts).where(eq(schema.receipts.id, receiptId))
  return { ok: true }
})
