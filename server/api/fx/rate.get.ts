import { z } from 'zod'
import { fetchRate } from '../../utils/fx'
import { requireUser } from '../../utils/guard'
import { validate } from '../../utils/validate'

const query = z.object({
  from: z.string().length(3),
  to: z.string().length(3),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
})

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const { from, to, date } = validate(query, getQuery(event))
  try {
    return await fetchRate(from.toUpperCase(), to.toUpperCase(), date)
  } catch {
    // 422 rather than 502: the client's job is to offer a manual rate, not retry.
    throw createError({ statusCode: 422, statusMessage: 'RATE_UNAVAILABLE' })
  }
})
