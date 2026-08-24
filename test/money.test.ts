import { describe, expect, it } from 'vitest'
import { decimalsFor, formatMoney, roundMoney, toHome } from '../shared/domain/money'
import { currencyForCountry } from '../shared/domain/currencies'
import { EXPENSE_CATEGORIES, REIMBURSABLE_CATEGORIES } from '../shared/domain/categories'

describe('decimalsFor', () => {
  it('gives zero decimals to JPY and IDR', () => {
    expect(decimalsFor('JPY')).toBe(0)
    expect(decimalsFor('IDR')).toBe(0)
  })

  it('defaults to two decimals', () => {
    expect(decimalsFor('USD')).toBe(2)
    expect(decimalsFor('XYZ')).toBe(2)
  })
})

describe('roundMoney', () => {
  it('rounds to whole units for zero-decimal currencies', () => {
    expect(roundMoney(1234.56, 'JPY')).toBe(1235)
  })

  it('rounds to cents for two-decimal currencies', () => {
    expect(roundMoney(10.005, 'USD')).toBe(10.01)
  })

  it('kills float drift', () => {
    expect(roundMoney(0.1 + 0.2, 'USD')).toBe(0.3)
  })
})

describe('toHome', () => {
  it('converts to whole yen', () => {
    // 150000 IDR at 0.0096 JPY per IDR
    expect(toHome(150000, 0.0096)).toBe(1440)
  })

  it('is identity at rate 1', () => {
    expect(toHome(5000, 1)).toBe(5000)
  })
})

describe('formatMoney', () => {
  it('formats yen without decimals', () => {
    expect(formatMoney(1440, 'JPY')).toBe('¥1,440')
  })
})

describe('categories', () => {
  it('has eight categories, seven reimbursable', () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(8)
    expect(REIMBURSABLE_CATEGORIES).toHaveLength(7)
    expect(REIMBURSABLE_CATEGORIES).not.toContain('per_diem')
    expect(EXPENSE_CATEGORIES).toContain('per_diem')
  })
})

describe('currencyForCountry', () => {
  it('maps countries to their currency', () => {
    expect(currencyForCountry('JP')).toBe('JPY')
    expect(currencyForCountry('ID')).toBe('IDR')
    expect(currencyForCountry('SG')).toBe('SGD')
  })

  it('returns undefined for unknown countries', () => {
    expect(currencyForCountry('ZZ')).toBeUndefined()
  })
})
