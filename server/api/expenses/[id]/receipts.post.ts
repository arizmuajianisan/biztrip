import { count, eq } from 'drizzle-orm'
import { schema, useDb } from '../../../utils/db'
import { assertTripOpen, requireExpense } from '../../../utils/guard'
import {
  ALLOWED_RECEIPT_TYPES,
  MAX_RECEIPTS_PER_EXPENSE,
  MAX_RECEIPT_BYTES,
  receiptKey,
  useR2
} from '../../../utils/r2'

export default defineEventHandler(async (event) => {
  const expenseId = getRouterParam(event, 'id')!
  const { expense, trip } = await requireExpense(event, expenseId)
  assertTripOpen(trip)

  const parts = (await readMultipartFormData(event) ?? []).filter(p => p.filename && p.data?.length)
  if (!parts.length) {
    throw createError({ statusCode: 400, statusMessage: 'NO_FILES' })
  }

  const db = useDb(event)
  const counted = await db.select({ total: count() })
    .from(schema.receipts).where(eq(schema.receipts.expenseId, expenseId))
  const existing = counted[0]?.total ?? 0

  if (existing + parts.length > MAX_RECEIPTS_PER_EXPENSE) {
    throw createError({ statusCode: 400, statusMessage: 'TOO_MANY_RECEIPTS' })
  }

  for (const part of parts) {
    if (!part.type || !ALLOWED_RECEIPT_TYPES.includes(part.type)) {
      throw createError({ statusCode: 400, statusMessage: 'UNSUPPORTED_TYPE' })
    }
    if (part.data.length > MAX_RECEIPT_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'FILE_TOO_LARGE' })
    }
  }

  const bucket = useR2(event)
  const created: typeof schema.receipts.$inferSelect[] = []

  for (const part of parts) {
    const key = receiptKey(trip.id, expense.id, part.filename!)
    await bucket.put(key, part.data, { httpMetadata: { contentType: part.type! } })
    const [row] = await db.insert(schema.receipts).values({
      expenseId: expense.id,
      r2Key: key,
      filename: part.filename!,
      contentType: part.type!,
      size: part.data.length
    }).returning()
    created.push(row!)
  }

  setResponseStatus(event, 201)
  return created
})
