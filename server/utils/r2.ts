import type { R2Bucket } from '@cloudflare/workers-types'
import type { H3Event } from 'h3'

export const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024
export const MAX_RECEIPTS_PER_EXPENSE = 10

export function useR2(event: H3Event): R2Bucket {
  const bucket = (event.context.cloudflare?.env as { RECEIPTS?: R2Bucket } | undefined)?.RECEIPTS
  if (!bucket) {
    throw createError({ statusCode: 500, statusMessage: 'R2 binding RECEIPTS is unavailable' })
  }
  return bucket
}

export function receiptKey(tripId: string, expenseId: string, filename: string): string {
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : 'bin'
  return `receipts/${tripId}/${expenseId}/${crypto.randomUUID()}.${ext}`
}

export function expensePrefix(tripId: string, expenseId: string): string {
  return `receipts/${tripId}/${expenseId}/`
}

export function tripPrefix(tripId: string): string {
  return `receipts/${tripId}/`
}

/** Deletes every object under a prefix, paging through the listing cursor. */
export async function deleteReceiptPrefix(event: H3Event, prefix: string): Promise<number> {
  const bucket = useR2(event)
  let deleted = 0
  let cursor: string | undefined

  do {
    const listing = await bucket.list({ prefix, cursor })
    if (listing.objects.length) {
      await bucket.delete(listing.objects.map(o => o.key))
      deleted += listing.objects.length
    }
    cursor = listing.truncated ? listing.cursor : undefined
  } while (cursor)

  return deleted
}
