import type { ZodType } from 'zod'

/**
 * Turns a schema mismatch into a 400 with a readable message. Calling
 * `schema.parse` directly would surface as an opaque 500 instead.
 */
export function validate<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: result.error.issues
        .map(issue => `${issue.path.join('.') || 'body'}: ${issue.message}`)
        .join('; ')
    })
  }
  return result.data
}
