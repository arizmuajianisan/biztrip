import { toHome } from '../../../shared/domain/money'
import { schema, useDb } from '../../utils/db'
import { expenseCreateSchema, nextSortIndex, resolveRate } from '../../utils/expense'
import { assertTripOpen, requireTrip } from '../../utils/guard'
import { validate } from '../../utils/validate'

export default defineEventHandler(async (event) => {
  const input = validate(expenseCreateSchema, await readBody(event))
  const trip = await requireTrip(event, input.tripId)
  assertTripOpen(trip)

  const { rate, source } = await resolveRate(input.currency, input.spentAt, input.fxRate)
  const db = useDb(event)

  const [expense] = await db.insert(schema.expenses).values({
    tripId: trip.id,
    category: input.category,
    amount: input.amount,
    currency: input.currency,
    fxRateToHome: rate,
    amountHome: toHome(input.amount, rate),
    rateSource: source,
    spentAt: input.spentAt,
    sortIndex: await nextSortIndex(db, trip.id, input.spentAt),
    note: input.note || null
  }).returning()

  setResponseStatus(event, 201)
  return expense!
})
