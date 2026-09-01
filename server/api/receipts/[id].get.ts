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

  /*
   * Thumbnails, the report and printing all want the smaller copy; only an
   * explicit ?full=1 gets the untouched original. Receipts uploaded before
   * display copies existed have none, so they fall back to the original.
   */
  const wantsFull = getQuery(event).full !== undefined
  const useDisplay = !wantsFull && !!receipt.displayR2Key

  const key = useDisplay ? receipt.displayR2Key! : receipt.r2Key
  const contentType = useDisplay ? receipt.displayContentType! : receipt.contentType
  const size = useDisplay ? receipt.displaySize : receipt.size

  const object = await useR2(event).get(key)
  if (!object) throw createError({ statusCode: 404, statusMessage: 'Receipt object missing' })

  setResponseHeaders(event, {
    'content-type': contentType,
    'cache-control': 'private, max-age=3600',
    'content-disposition': `inline; filename="${encodeURIComponent(receipt.filename)}"`
  })
  if (size !== null) {
    setResponseHeader(event, 'content-length', Number(size))
  }
  return object.body
})
