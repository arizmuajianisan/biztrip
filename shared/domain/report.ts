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
}): Report {
  const summary = computeSummary({
    budgets: input.budgets,
    expenses: input.expenses.map(e => ({ category: e.category, amountHome: e.amountHome })),
    advanceHome: input.advanceHome
  })

  const itemsFor = (category: ExpenseCategory): ReportExpense[] =>
    input.expenses
      .filter(e => e.category === category)
      .sort((a, b) => a.spentAt < b.spentAt ? -1 : a.spentAt > b.spentAt ? 1 : 0)
      .map(({ category: _category, ...expense }) => expense)

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
