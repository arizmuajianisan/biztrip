import { describe, expect, it } from 'vitest'
import { buildReport } from '../shared/domain/report'
import { REIMBURSABLE_CATEGORIES } from '../shared/domain/categories'
import type { ExpenseCategory } from '../shared/domain/categories'
import type { ReportExpense } from '../shared/domain/report'

const expense = (over: Partial<ReportExpense & { category: ExpenseCategory }> = {}) => ({
  id: 'e1',
  spentAt: '2026-08-20',
  amount: 1500000,
  currency: 'IDR',
  fxRateToHome: 0.0096,
  amountHome: 14400,
  rateSource: 'api' as const,
  note: null,
  receiptCount: 2,
  category: 'hotel' as ExpenseCategory,
  ...over
})

describe('buildReport', () => {
  it('returns the seven reimbursable categories in canonical order', () => {
    const r = buildReport({ budgets: [], expenses: [], advanceHome: 0 })
    expect(r.reimbursable.map(c => c.category)).toEqual([...REIMBURSABLE_CATEGORIES])
  })

  it('separates per diem from the reimbursable sections', () => {
    const r = buildReport({
      budgets: [{ category: 'per_diem', amount: 60000 }],
      expenses: [expense({ category: 'per_diem', id: 'p1', amountHome: 3000 })],
      advanceHome: 0
    })
    expect(r.perDiem.expenses).toHaveLength(1)
    expect(r.reimbursable.every(c => c.expenses.length === 0)).toBe(true)
    expect(r.summary.reimbursableActual).toBe(0)
    expect(r.summary.perDiemActual).toBe(3000)
  })

  it('itemizes expenses under their category and agrees with the summary', () => {
    const r = buildReport({
      budgets: [{ category: 'hotel', amount: 90000 }],
      expenses: [expense(), expense({ id: 'e2', amountHome: 10000 })],
      advanceHome: 200000
    })
    const hotel = r.reimbursable.find(c => c.category === 'hotel')!
    expect(hotel.expenses.map(e => e.id)).toEqual(['e1', 'e2'])
    expect(hotel.actual).toBe(24400)
    expect(r.summary.returnToCompany).toBe(175600)
  })

  it('sorts expenses within a category by date', () => {
    const r = buildReport({
      budgets: [],
      expenses: [
        expense({ id: 'late', spentAt: '2026-08-25' }),
        expense({ id: 'early', spentAt: '2026-08-19' })
      ],
      advanceHome: 0
    })
    const hotel = r.reimbursable.find(c => c.category === 'hotel')!
    expect(hotel.expenses.map(e => e.id)).toEqual(['early', 'late'])
  })

  it('never lets per diem leak into the return calculation', () => {
    const r = buildReport({
      budgets: [{ category: 'per_diem', amount: 60000 }, { category: 'hotel', amount: 90000 }],
      expenses: [
        expense({ id: 'h', category: 'hotel', amountHome: 50000 }),
        expense({ id: 'p', category: 'per_diem', amountHome: 60000 })
      ],
      advanceHome: 200000
    })
    expect(r.summary.returnToCompany).toBe(150000)
    expect(r.perDiem.actual).toBe(60000)
  })
})
