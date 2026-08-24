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

  it('per diem never affects return to company', () => {
    const s = computeSummary({
      budgets,
      expenses: [
        { category: 'hotel', amountHome: 80000 },
        { category: 'per_diem', amountHome: 60000 }
      ],
      advanceHome: 200000
    })
    expect(s.returnToCompany).toBe(120000)
    expect(s.advanceRemaining).toBe(120000)
    expect(s.companyOwesEmployee).toBe(0)
  })

  it('reports a negative return as company owing the employee', () => {
    const s = computeSummary({
      budgets,
      expenses: [{ category: 'air_ticket', amountHome: 250000 }],
      advanceHome: 200000
    })
    expect(s.returnToCompany).toBe(-50000)
    expect(s.companyOwesEmployee).toBe(50000)
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
