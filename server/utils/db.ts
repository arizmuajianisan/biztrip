import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import type { H3Event } from 'h3'
import * as schema from '../database/schema'

let cached: { url: string, db: ReturnType<typeof drizzle<typeof schema>> } | null = null

/**
 * Neon over HTTP — Workers cannot open raw TCP sockets, so the `pg` driver is
 * not an option. The client is stateless, so caching it across requests is safe.
 */
export function useDb(event: H3Event) {
  const url = useRuntimeConfig(event).dbUrl
  if (!url) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_DB_URL is not configured' })
  }
  if (!cached || cached.url !== url) {
    cached = { url, db: drizzle(neon(url), { schema }) }
  }
  return cached.db
}

export { schema }
