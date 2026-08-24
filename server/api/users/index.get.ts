import { asc } from 'drizzle-orm'
import { schema, useDb } from '../../utils/db'
import { requireRole } from '../../utils/guard'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'manage_users')
  const db = useDb(event)

  // Never select password_hash.
  return db.select({
    id: schema.users.id,
    email: schema.users.email,
    displayName: schema.users.displayName,
    role: schema.users.role,
    isActive: schema.users.isActive,
    createdAt: schema.users.createdAt
  }).from(schema.users).orderBy(asc(schema.users.email))
})
