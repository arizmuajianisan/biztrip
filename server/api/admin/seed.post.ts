import { eq } from 'drizzle-orm'
import { schema, useDb } from '../../utils/db'

const SEED_USERS = [
  { email: 'superadmin@trip-ledger.local', displayName: 'Super Admin', role: 'superadmin' as const, password: 'superadmin123' },
  { email: 'admin@trip-ledger.local', displayName: 'Admin', role: 'admin' as const, password: 'admin123' },
  { email: 'user@trip-ledger.local', displayName: 'Traveller', role: 'user' as const, password: 'user123' }
]

/**
 * Idempotent seeder. Lives as a route rather than a script because `hashPassword`
 * is a Nitro-only auto-import, and because it must also be runnable against the
 * deployed Worker.
 */
export default defineEventHandler(async (event) => {
  const expected = useRuntimeConfig(event).seedToken
  if (!expected || getHeader(event, 'x-seed-token') !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = useDb(event)
  const results: string[] = []

  for (const seed of SEED_USERS) {
    const [existing] = await db.select({ id: schema.users.id }).from(schema.users)
      .where(eq(schema.users.email, seed.email)).limit(1)
    if (existing) {
      results.push(`skipped ${seed.email}`)
      continue
    }
    await db.insert(schema.users).values({
      email: seed.email,
      passwordHash: await hashPassword(seed.password),
      displayName: seed.displayName,
      role: seed.role
    })
    results.push(`created ${seed.email}`)
  }

  return { results }
})
