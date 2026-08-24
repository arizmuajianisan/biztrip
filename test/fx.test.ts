import { describe, expect, it } from 'vitest'
import { parseFrankfurter } from '../server/utils/fx'

describe('parseFrankfurter', () => {
  it('extracts the rate and effective date', () => {
    const parsed = parseFrankfurter(
      { amount: 1, base: 'IDR', date: '2026-08-20', rates: { JPY: 0.0096 } },
      'JPY'
    )
    expect(parsed).toEqual({ rate: 0.0096, date: '2026-08-20' })
  })

  it('throws when the target currency is missing', () => {
    expect(() => parseFrankfurter({ date: '2026-08-20', rates: {} }, 'JPY')).toThrow()
  })

  it('throws on a malformed payload', () => {
    expect(() => parseFrankfurter(null, 'JPY')).toThrow()
  })

  it('rejects a non-positive rate', () => {
    expect(() => parseFrankfurter({ date: '2026-08-20', rates: { JPY: 0 } }, 'JPY')).toThrow()
  })
})
