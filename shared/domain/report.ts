import { PER_DIEM, REIMBURSABLE_CATEGORIES, type ExpenseCategory } from './categories'
import { computeSummary, type BudgetInput, type CategorySummary, type TripSummary } from './summary'

export interface ReportExpense {
  id: string
  spentAt: string
  amount: number
  currency: string
  fxRateToHome: number
  amountHome: number
  rateSource: 'api' | 'manual'
  note: string | null
  receiptCount: number
  /** Only the date of an expense is recorded, so this breaks same-day ties. */
  createdAt: string
}

export interface ReportCategory extends CategorySummary {
  expenses: ReportExpense[]
}

export interface Report {
  summary: TripSummary
  reimbursable: ReportCategory[]
  perDiem: ReportCategory
}

/**
 * Groups itemized expenses under their category. Every total comes from
 * `computeSummary`, so the report can never disagree with the dashboard.
 */
export function buildReport(input: {
  budgets: BudgetInput[]
  expenses: (ReportExpense & { category: ExpenseCategory })[]
  advanceHome: number
  additionalAdvanceHome?: number
}): Report {
  const summary = computeSummary({
    budgets: input.budgets,
    expenses: input.expenses.map(e => ({ category: e.category, amountHome: e.amountHome })),
    advanceHome: input.advanceHome,
    additionalAdvanceHome: input.additionalAdvanceHome
  })

  /*
   * Chronological, and fully determined by the data rather than by the order
   * rows happened to arrive in. Expenses carry a date but no time, so the
   * moment each one was logged is the tie-break — people record a trip's legs
   * in the order they travel them, so the outbound leg precedes the return.
   */
  const byWhenItHappened = (a: ReportExpense, b: ReportExpense) =>
    a.spentAt.localeCompare(b.spentAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)

  const itemsFor = (category: ExpenseCategory): ReportExpense[] =>
    input.expenses
      .filter(e => e.category === category)
      .map(({ category: _category, ...expense }) => expense)
      .sort(byWhenItHappened)

  const rowFor = (category: ExpenseCategory): ReportCategory => ({
    ...summary.perCategory.find(r => r.category === category)!,
    expenses: itemsFor(category)
  })

  return {
    summary,
    reimbursable: REIMBURSABLE_CATEGORIES.map(rowFor),
    perDiem: rowFor(PER_DIEM)
  }
}
