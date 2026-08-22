import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { schema, useDb } from '../../utils/db'

const body = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const { email, password } = body.parse(await readBody(event))
  const db = useDb(event)

  const [user] = await db.select().from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase())).limit(1)

  // Deactivated accounts get the same generic error, so account status never leaks.
  const invalid = () => createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  if (!user || !user.isActive) throw invalid()
  if (!await verifyPassword(user.passwordHash, password)) throw invalid()

  await setUserSession(event, {
    user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role }
  })
  return { ok: true }
})
