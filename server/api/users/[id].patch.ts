import { eq } from 'drizzle-orm'
import { schema, useDb } from '../../utils/db'
import { requireRole } from '../../utils/guard'
import { assertMayAssignRole, userUpdateSchema } from '../../utils/user'
import { validate } from '../../utils/validate'

export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, 'manage_users')
  const userId = getRouterParam(event, 'id')!
  const input = validate(userUpdateSchema, await readBody(event))
  const db = useDb(event)

  const [target] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1)
  if (!target) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  // No locking yourself out and no self-promotion.
  if (target.id === actor.id) {
    if (input.isActive === false) {
      throw createError({ statusCode: 400, statusMessage: 'You cannot deactivate your own account' })
    }
    if (input.role !== undefined && input.role !== target.role) {
      throw createError({ statusCode: 400, statusMessage: 'You cannot change your own role' })
    }
  }

  if (input.role !== undefined && input.role !== target.role) {
    if (actor.role !== 'superadmin') {
      throw createError({ statusCode: 403, statusMessage: 'Only a superadmin may change a role' })
    }
    assertMayAssignRole(actor.role, input.role)
  }

  const patch: Partial<typeof schema.users.$inferInsert> = {}
  if (input.displayName !== undefined) patch.displayName = input.displayName
  if (input.role !== undefined) patch.role = input.role
  if (input.isActive !== undefined) patch.isActive = input.isActive
  if (input.password !== undefined) patch.passwordHash = await hashPassword(input.password)

  if (Object.keys(patch).length) {
    await db.update(schema.users).set(patch).where(eq(schema.users.id, userId))
  }

  return { ok: true }
})
