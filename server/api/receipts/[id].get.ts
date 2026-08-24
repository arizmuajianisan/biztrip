import { eq } from 'drizzle-orm'
import { schema, useDb } from '../../utils/db'
import { requireExpense } from '../../utils/guard'
import { useR2 } from '../../utils/r2'

export default defineEventHandler(async (event) => {
  const receiptId = getRouterParam(event, 'id')!
  const db = useDb(event)

  const [receipt] = await db.select().from(schema.receipts)
    .where(eq(schema.receipts.id, receiptId)).limit(1)
  if (!receipt) throw createError({ statusCode: 404, statusMessage: 'Receipt not found' })

  // Ownership is checked through the owning expense's trip — no public bucket URLs.
  await requireExpense(event, receipt.expenseId)

  const object = await useR2(event).get(receipt.r2Key)
  if (!object) throw createError({ statusCode: 404, statusMessage: 'Receipt object missing' })

  setResponseHeaders(event, {
    'content-type': receipt.contentType,
    'content-length': Number(receipt.size),
    'cache-control': 'private, max-age=3600',
    'content-disposition': `inline; filename="${encodeURIComponent(receipt.filename)}"`
  })
  return object.body
})
