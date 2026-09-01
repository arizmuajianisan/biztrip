import { count, eq } from 'drizzle-orm'
import { schema, useDb } from '../../../utils/db'
import { assertTripOpen, requireExpense } from '../../../utils/guard'
import {
  ALLOWED_DISPLAY_TYPES,
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

  const allParts = (await readMultipartFormData(event) ?? []).filter(p => p.filename && p.data?.length)
  const parts = allParts.filter(p => p.name === 'receipts')
  // Display copies are keyed `display:<index>` against the originals' order, so
  // an image the browser could not re-encode cannot shift the others out of line.
  const displays = new Map(
    allParts
      .filter(p => p.name?.startsWith('display:'))
      .map(p => [Number(p.name!.slice('display:'.length)), p])
  )

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

  for (const [index, part] of parts.entries()) {
    const key = receiptKey(trip.id, expense.id, part.filename!)
    await bucket.put(key, part.data, { httpMetadata: { contentType: part.type! } })

    // The display copy lives beside the original under the same prefix, so
    // prefix-based cleanup on delete removes both without extra bookkeeping.
    const display = displays.get(index)
    let displayKey: string | null = null
    if (display && ALLOWED_DISPLAY_TYPES.includes(display.type ?? '')) {
      displayKey = `${key}.display.${display.type === 'image/webp' ? 'webp' : 'jpg'}`
      await bucket.put(displayKey, display.data, {
        httpMetadata: { contentType: display.type! }
      })
    }

    const [row] = await db.insert(schema.receipts).values({
      expenseId: expense.id,
      r2Key: key,
      filename: part.filename!,
      contentType: part.type!,
      size: part.data.length,
      displayR2Key: displayKey,
      displayContentType: displayKey ? display!.type! : null,
      displaySize: displayKey ? display!.data.length : null
    }).returning()
    created.push(row!)
  }

  setResponseStatus(event, 201)
  return created
})
