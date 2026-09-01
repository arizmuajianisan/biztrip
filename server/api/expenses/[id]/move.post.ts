import { and, asc, desc, eq, gt, lt } from 'drizzle-orm'
import { z } from 'zod'
import { schema, useDb } from '../../../utils/db'
import { assertTripOpen, requireExpense } from '../../../utils/guard'
import { validate } from '../../../utils/validate'

const body = z.object({ direction: z.enum(['up', 'down']) })

/**
 * Nudges an expense one place within its own day by swapping positions with its
 * neighbour. Scoped to the same date on purpose: reordering must never silently
 * change which day an expense belongs to.
 */
export default defineEventHandler(async (event) => {
  const expenseId = getRouterParam(event, 'id')!
  const { expense, trip } = await requireExpense(event, expenseId)
  assertTripOpen(trip)

  const { direction } = validate(body, await readBody(event))
  const db = useDb(event)

  const sameDay = and(
    eq(schema.expenses.tripId, expense.tripId),
    eq(schema.expenses.spentAt, expense.spentAt)
  )

  const [neighbour] = direction === 'up'
    ? await db.select().from(schema.expenses)
        .where(and(sameDay, lt(schema.expenses.sortIndex, expense.sortIndex)))
        .orderBy(desc(schema.expenses.sortIndex)).limit(1)
    : await db.select().from(schema.expenses)
        .where(and(sameDay, gt(schema.expenses.sortIndex, expense.sortIndex)))
        .orderBy(asc(schema.expenses.sortIndex)).limit(1)

  // Already at the top or bottom of its day — nothing to swap with.
  if (!neighbour) return { moved: false }

  await db.update(schema.expenses)
    .set({ sortIndex: neighbour.sortIndex })
    .where(eq(schema.expenses.id, expense.id))
  await db.update(schema.expenses)
    .set({ sortIndex: expense.sortIndex })
    .where(eq(schema.expenses.id, neighbour.id))

  return { moved: true }
})
