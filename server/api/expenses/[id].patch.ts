import { eq } from 'drizzle-orm'
import { toHome } from '../../../shared/domain/money'
import { schema, useDb } from '../../utils/db'
import { expenseUpdateSchema, nextSortIndex, resolveRate } from '../../utils/expense'
import { assertTripOpen, requireExpense } from '../../utils/guard'
import { validate } from '../../utils/validate'

export default defineEventHandler(async (event) => {
  const expenseId = getRouterParam(event, 'id')!
  const { expense, trip } = await requireExpense(event, expenseId)
  assertTripOpen(trip)

  const input = validate(expenseUpdateSchema, await readBody(event))

  const amount = input.amount ?? expense.amount
  const currency = input.currency ?? expense.currency
  const spentAt = input.spentAt ?? expense.spentAt

  // Re-freeze the rate only when something it depends on actually changed.
  const rateInputsChanged = amount !== expense.amount
    || currency !== expense.currency
    || spentAt !== expense.spentAt

  let rate = expense.fxRateToHome
  let source = expense.rateSource
  if (rateInputsChanged) {
    const resolved = await resolveRate(currency, spentAt, input.fxRate)
    rate = resolved.rate
    source = resolved.source
  }

  const db = useDb(event)

  // Changing the date moves the expense into a different day's sequence, where
  // its old position is meaningless and would collide. Send it to the end.
  const movedDay = spentAt !== expense.spentAt
  const sortIndex = movedDay
    ? await nextSortIndex(db, trip.id, spentAt)
    : expense.sortIndex

  const [updated] = await db.update(schema.expenses).set({
    sortIndex,
    category: input.category ?? expense.category,
    amount,
    currency,
    fxRateToHome: rate,
    amountHome: toHome(amount, rate),
    rateSource: source,
    spentAt,
    note: input.note === undefined ? expense.note : (input.note || null)
  }).where(eq(schema.expenses.id, expenseId)).returning()

  return updated
})
