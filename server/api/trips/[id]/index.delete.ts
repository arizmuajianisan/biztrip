import { eq } from 'drizzle-orm'
import { schema, useDb } from '../../../utils/db'
import { requireTrip } from '../../../utils/guard'
import { deleteReceiptPrefix, tripPrefix } from '../../../utils/r2'

export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, 'id')!
  await requireTrip(event, tripId)

  // Objects first: an orphaned row is recoverable, an orphaned object is not findable.
  await deleteReceiptPrefix(event, tripPrefix(tripId))

  const db = useDb(event)
  await db.delete(schema.trips).where(eq(schema.trips.id, tripId))
  return { ok: true }
})
