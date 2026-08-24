import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { can, type Action } from '../../shared/domain/rbac'
import { schema, useDb } from './db'

export async function requireUser(event: H3Event) {
  const { user } = await requireUserSession(event)
  return user
}

export async function requireRole(event: H3Event, action: Action) {
  const user = await requireUser(event)
  if (!can(user.role, action)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return user
}

/** Resolves a trip the caller may act on: their own, or any trip if superadmin. */
export async function requireTrip(event: H3Event, tripId: string) {
  const user = await requireUser(event)
  const db = useDb(event)
  const [trip] = await db.select().from(schema.trips).where(eq(schema.trips.id, tripId)).limit(1)
  if (!trip) throw createError({ statusCode: 404, statusMessage: 'Trip not found' })

  const isOwner = trip.userId === user.id && can(user.role, 'own_trips')
  if (!isOwner && !can(user.role, 'any_trips')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return trip
}

export async function requireExpense(event: H3Event, expenseId: string) {
  const db = useDb(event)
  const [expense] = await db.select().from(schema.expenses).where(eq(schema.expenses.id, expenseId)).limit(1)
  if (!expense) throw createError({ statusCode: 404, statusMessage: 'Expense not found' })
  const trip = await requireTrip(event, expense.tripId)
  return { expense, trip }
}

/** Mutations are refused once a trip is closed, so a submitted report stays fixed. */
export function assertTripOpen(trip: { status: 'active' | 'closed' }) {
  if (trip.status === 'closed') {
    throw createError({ statusCode: 409, statusMessage: 'Trip is closed' })
  }
}
