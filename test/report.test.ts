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
  createdAt: '2026-08-20T00:00:00Z',
  sortIndex: 1,
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

  /*
   * Regression: the report query had no ORDER BY, so same-day expenses came
   * back in whatever order Postgres chose — which shifts when a row is
   * updated. A return train journey could print above its outbound leg.
   * Only the date is recorded, so log time is the tie-break.
   */
  it('breaks same-date ties by the order the expenses were logged', () => {
    const r = buildReport({
      budgets: [],
      expenses: [
        expense({ id: 'return', category: 'train', spentAt: '2026-08-28', createdAt: '2026-09-01T04:29:55Z' }),
        expense({ id: 'outbound', category: 'train', spentAt: '2026-08-28', createdAt: '2026-09-01T04:29:10Z' }),
        expense({ id: 'middle', category: 'train', spentAt: '2026-08-28', createdAt: '2026-09-01T04:29:36Z' })
      ],
      advanceHome: 0
    })
    const train = r.reimbursable.find(c => c.category === 'train')!
    expect(train.expenses.map(e => e.id)).toEqual(['outbound', 'middle', 'return'])
  })

  /*
   * A leg added later (splitting one journey into two) is logged last but
   * belongs mid-sequence, so an explicit position must beat the log time.
   */
  it('honours the manual position ahead of the log time', () => {
    const r = buildReport({
      budgets: [],
      expenses: [
        expense({ id: 'kikuna-to-hotel', category: 'train', spentAt: '2026-08-28', sortIndex: 7, createdAt: '2026-09-01T04:29:55Z' }),
        expense({ id: 'shinyoko-to-kikuna', category: 'train', spentAt: '2026-08-28', sortIndex: 6, createdAt: '2026-09-02T10:00:00Z' }),
        expense({ id: 'hotel-to-denki', category: 'train', spentAt: '2026-08-28', sortIndex: 5, createdAt: '2026-09-01T04:29:10Z' })
      ],
      advanceHome: 0
    })
    const train = r.reimbursable.find(c => c.category === 'train')!
    expect(train.expenses.map(e => e.id))
      .toEqual(['hotel-to-denki', 'shinyoko-to-kikuna', 'kikuna-to-hotel'])
  })

  it('does not depend on the order rows arrive in', () => {
    const rows = [
      expense({ id: 'a', category: 'train', spentAt: '2026-08-26', createdAt: '2026-09-01T04:26:51Z' }),
      expense({ id: 'b', category: 'train', spentAt: '2026-08-26', createdAt: '2026-09-01T04:27:15Z' }),
      expense({ id: 'c', category: 'train', spentAt: '2026-08-25', createdAt: '2026-09-01T04:25:14Z' })
    ]
    const forward = buildReport({ budgets: [], expenses: rows, advanceHome: 0 })
    const reversed = buildReport({ budgets: [], expenses: [...rows].reverse(), advanceHome: 0 })
    const ids = (r: typeof forward) =>
      r.reimbursable.find(c => c.category === 'train')!.expenses.map(e => e.id)
    expect(ids(forward)).toEqual(['c', 'a', 'b'])
    expect(ids(reversed)).toEqual(ids(forward))
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

  it('never lets per diem spending drive the return calculation', () => {
    const r = buildReport({
      budgets: [{ category: 'per_diem', amount: 60000 }, { category: 'hotel', amount: 90000 }],
      expenses: [
        expense({ id: 'h', category: 'hotel', amountHome: 50000 }),
        expense({ id: 'p', category: 'per_diem', amountHome: 60000 })
      ],
      advanceHome: 200000
    })
    // 200000 cash − 50000 reimbursable − 60000 per diem entitlement
    expect(r.summary.returnToCompany).toBe(90000)
    expect(r.perDiem.actual).toBe(60000)
  })

  it('carries the additional emergency payment through to the report', () => {
    const r = buildReport({
      budgets: [{ category: 'per_diem', amount: 30000 }, { category: 'hotel', amount: 50000 }],
      expenses: [expense({ id: 'h', category: 'hotel', amountHome: 42285 })],
      advanceHome: 90000,
      additionalAdvanceHome: 5000
    })
    expect(r.summary.advanceBase).toBe(90000)
    expect(r.summary.advanceAdditional).toBe(5000)
    expect(r.summary.advanceHome).toBe(95000)
    expect(r.summary.returnToCompany).toBe(95000 - 42285 - 30000)
  })
})
