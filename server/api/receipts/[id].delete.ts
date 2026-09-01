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

  // Both the original and its display copy, or the variant is orphaned in R2.
  const keys = [receipt.r2Key, receipt.displayR2Key].filter((k): k is string => !!k)
  await useR2(event).delete(keys)

  await db.delete(schema.receipts).where(eq(schema.receipts.id, receiptId))
  return { ok: true }
})
