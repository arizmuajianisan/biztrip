export interface RateResult { rate: number, date: string, source: 'api' }

export function parseFrankfurter(payload: unknown, to: string): { rate: number, date: string } {
  const data = payload as { date?: string, rates?: Record<string, number> } | null
  const rate = data?.rates?.[to]
  if (!data?.date || typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`RATE_UNAVAILABLE: no ${to} rate in response`)
  }
  return { rate, date: data.date }
}

/**
 * `to`-per-unit-of-`from` on `on` (YYYY-MM-DD), falling back to the latest rate.
 *
 * Frankfurter serves ECB reference rates: weekend and holiday dates resolve to
 * the previous business day, which comes back in `date`. Currencies outside the
 * ECB list 404 — that is the manual-rate path.
 */
export async function fetchRate(from: string, to: string, on?: string): Promise<RateResult> {
  if (from === to) {
    return { rate: 1, date: on ?? new Date().toISOString().slice(0, 10), source: 'api' }
  }
  const segment = on ?? 'latest'
  const url = `https://api.frankfurter.dev/v1/${segment}?base=${from}&symbols=${to}`
  const payload = await $fetch(url, { timeout: 5000 })
  const { rate, date } = parseFrankfurter(payload, to)
  return { rate, date, source: 'api' }
}
