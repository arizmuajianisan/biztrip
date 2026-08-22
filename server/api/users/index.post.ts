import { eq } from 'drizzle-orm'
import { schema, useDb } from '../../utils/db'
import { requireRole } from '../../utils/guard'
import { assertMayAssignRole, userCreateSchema } from '../../utils/user'
import { validate } from '../../utils/validate'

export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, 'manage_users')
  const input = validate(userCreateSchema, await readBody(event))
  assertMayAssignRole(actor.role, input.role)

  const db = useDb(event)
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users)
    .where(eq(schema.users.email, input.email)).limit(1)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'That email is already registered' })
  }

  const [created] = await db.insert(schema.users).values({
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    passwordHash: await hashPassword(input.password)
  }).returning({ id: schema.users.id })

  setResponseStatus(event, 201)
  return { id: created!.id }
})
