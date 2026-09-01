import { describe, expect, it } from 'vitest'
import { computeSummary } from '../shared/domain/summary'
import { EXPENSE_CATEGORIES } from '../shared/domain/categories'

const budgets = [
  { category: 'air_ticket' as const, amount: 120000 },
  { category: 'taxi_bus' as const, amount: 20000 },
  { category: 'hotel' as const, amount: 90000 },
  { category: 'train' as const, amount: 10000 },
  { category: 'travel_procedure' as const, amount: 15000 },
  { category: 'travel_insurance' as const, amount: 5000 },
  { category: 'other' as const, amount: 10000 },
  { category: 'per_diem' as const, amount: 60000 }
]

describe('computeSummary', () => {
  it('returns a row for every category in canonical order', () => {
    const s = computeSummary({ budgets, expenses: [], advanceHome: 0 })
    expect(s.perCategory.map(r => r.category)).toEqual([...EXPENSE_CATEGORIES])
  })

  it('treats missing budget rows as zero allowance', () => {
    const s = computeSummary({ budgets: [], expenses: [], advanceHome: 0 })
    expect(s.reimbursableAllowance).toBe(0)
    expect(s.perDiemAllowance).toBe(0)
  })

  it('excludes per diem from reimbursable totals', () => {
    const s = computeSummary({ budgets, expenses: [], advanceHome: 0 })
    expect(s.reimbursableAllowance).toBe(270000)
    expect(s.perDiemAllowance).toBe(60000)
  })

  it('computes budget remaining from reimbursable actuals only', () => {
    const s = computeSummary({
      budgets,
      expenses: [
        { category: 'hotel', amountHome: 80000 },
        { category: 'per_diem', amountHome: 50000 }
      ],
      advanceHome: 0
    })
    expect(s.reimbursableActual).toBe(80000)
    expect(s.budgetRemaining).toBe(190000)
    expect(s.perDiemActual).toBe(50000)
    expect(s.perDiemRemaining).toBe(10000)
  })

  it('per diem spending never affects return to company', () => {
    const s = computeSummary({
      budgets,
      expenses: [
        { category: 'hotel', amountHome: 80000 },
        { category: 'per_diem', amountHome: 60000 }
      ],
      advanceHome: 200000
    })
    // 200000 advance − 80000 reimbursable − 60000 per diem entitlement
    expect(s.returnToCompany).toBe(60000)
    expect(s.companyOwesEmployee).toBe(0)
  })

  it('reports a negative return as company owing the employee', () => {
    const s = computeSummary({
      budgets,
      expenses: [{ category: 'air_ticket', amountHome: 250000 }],
      advanceHome: 200000
    })
    // 200000 − 250000 − 60000 per diem entitlement
    expect(s.returnToCompany).toBe(-110000)
    expect(s.companyOwesEmployee).toBe(110000)
  })

  it('flags over budget with the overage amount', () => {
    const s = computeSummary({
      budgets,
      expenses: [{ category: 'air_ticket', amountHome: 300000 }],
      advanceHome: 0
    })
    expect(s.isOverBudget).toBe(true)
    expect(s.overBudgetBy).toBe(30000)
  })

  it('is not over budget when exactly on budget', () => {
    const s = computeSummary({
      budgets,
      expenses: [{ category: 'air_ticket', amountHome: 270000 }],
      advanceHome: 0
    })
    expect(s.isOverBudget).toBe(false)
    expect(s.overBudgetBy).toBe(0)
  })

  it('reports per-category overage independently', () => {
    const s = computeSummary({
      budgets,
      expenses: [{ category: 'taxi_bus', amountHome: 25000 }],
      advanceHome: 0
    })
    const taxi = s.perCategory.find(r => r.category === 'taxi_bus')!
    expect(taxi.actual).toBe(25000)
    expect(taxi.remaining).toBe(-5000)
    expect(taxi.overBy).toBe(5000)
  })

  it('keeps the sign when per diem is overspent', () => {
    const s = computeSummary({
      budgets,
      expenses: [{ category: 'per_diem', amountHome: 70000 }],
      advanceHome: 0
    })
    expect(s.perDiemRemaining).toBe(-10000)
  })

  /*
   * Regression: the "Zero Ichi Matsuri" report told the employee to return
   * ¥46,145 while simultaneously stating they keep ¥13,598 of unspent Per
   * Diem. Both could not be true — the cash advance already contained the Per
   * Diem, so returning `advance − reimbursables` clawed the Per Diem back.
   */
  describe('per diem is funded out of the advance', () => {
    const realTrip = {
      budgets: [
        { category: 'hotel' as const, amount: 50000 },
        { category: 'train' as const, amount: 10000 },
        { category: 'per_diem' as const, amount: 30000 }
      ],
      expenses: [
        { category: 'hotel' as const, amountHome: 42285 },
        { category: 'train' as const, amountHome: 6570 },
        { category: 'per_diem' as const, amountHome: 16402 }
      ],
      advanceHome: 90000,
      additionalAdvanceHome: 5000
    }

    it('deducts the per diem entitlement from the cash held', () => {
      const s = computeSummary(realTrip)
      expect(s.advanceHome).toBe(95000)
      expect(s.reimbursableActual).toBe(48855)
      expect(s.perDiemKept).toBe(30000)
      expect(s.returnToCompany).toBe(16145)
    })

    it('keeps the additional emergency payment out of the budget', () => {
      const s = computeSummary(realTrip)
      expect(s.advanceBase).toBe(90000)
      expect(s.advanceAdditional).toBe(5000)
      expect(s.reimbursableAllowance).toBe(60000)
    })

    /*
     * The invariant the old formula broke: whatever the employee does not
     * spend on reimbursables and does not return must equal the per diem
     * they were told they keep. Anything else is money appearing or vanishing.
     */
    it('reconciles — cash − reimbursables − return equals the per diem kept', () => {
      const s = computeSummary(realTrip)
      expect(s.advanceHome - s.reimbursableActual - s.returnToCompany).toBe(s.perDiemKept)
    })

    it('keeps the whole per diem entitlement even when none of it was spent', () => {
      const s = computeSummary({ ...realTrip, expenses: [{ category: 'hotel', amountHome: 42285 }] })
      expect(s.perDiemActual).toBe(0)
      expect(s.perDiemKept).toBe(30000)
      expect(s.returnToCompany).toBe(95000 - 42285 - 30000)
    })

    it('treats a missing additional payment as zero', () => {
      const s = computeSummary({ ...realTrip, additionalAdvanceHome: undefined })
      expect(s.advanceAdditional).toBe(0)
      expect(s.advanceHome).toBe(90000)
      expect(s.returnToCompany).toBe(90000 - 48855 - 30000)
    })
  })

  it('rounds to whole yen', () => {
    const s = computeSummary({
      budgets: [{ category: 'other', amount: 1000 }],
      expenses: [
        { category: 'other', amountHome: 333.33 },
        { category: 'other', amountHome: 333.33 }
      ],
      advanceHome: 0
    })
    expect(s.reimbursableActual).toBe(667)
  })
})
