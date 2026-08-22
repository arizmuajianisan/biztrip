import { EXPENSE_CATEGORIES, PER_DIEM, isReimbursable, type ExpenseCategory } from './categories'
import { HOME_CURRENCY, roundMoney } from './money'

export interface BudgetInput { category: ExpenseCategory, amount: number }
export interface ExpenseInput { category: ExpenseCategory, amountHome: number }

export interface CategorySummary {
  category: ExpenseCategory
  allowance: number
  actual: number
  remaining: number
  overBy: number
}

export interface TripSummary {
  perCategory: CategorySummary[]
  reimbursableAllowance: number
  reimbursableActual: number
  budgetRemaining: number
  perDiemAllowance: number
  perDiemActual: number
  perDiemRemaining: number
  advanceHome: number
  advanceRemaining: number
  returnToCompany: number
  companyOwesEmployee: number
  isOverBudget: boolean
  overBudgetBy: number
}

const yen = (value: number) => roundMoney(value, HOME_CURRENCY)

/**
 * The single source of truth for every money figure the app shows.
 *
 * All inputs and outputs are in the home currency (JPY). Per Diem is tracked
 * alongside the reimbursable categories but deliberately excluded from
 * `reimbursableActual`, and therefore from `returnToCompany` — it is the
 * employee's own money.
 */
export function computeSummary(input: {
  budgets: BudgetInput[]
  expenses: ExpenseInput[]
  advanceHome: number
}): TripSummary {
  const allowanceOf = (category: ExpenseCategory) =>
    yen(input.budgets.filter(b => b.category === category).reduce((sum, b) => sum + b.amount, 0))

  const actualOf = (category: ExpenseCategory) =>
    yen(input.expenses.filter(e => e.category === category).reduce((sum, e) => sum + e.amountHome, 0))

  const perCategory: CategorySummary[] = EXPENSE_CATEGORIES.map((category) => {
    const allowance = allowanceOf(category)
    const actual = actualOf(category)
    const remaining = yen(allowance - actual)
    return { category, allowance, actual, remaining, overBy: remaining < 0 ? -remaining : 0 }
  })

  const reimbursable = perCategory.filter(r => isReimbursable(r.category))
  const reimbursableAllowance = yen(reimbursable.reduce((s, r) => s + r.allowance, 0))
  const reimbursableActual = yen(reimbursable.reduce((s, r) => s + r.actual, 0))
  const budgetRemaining = yen(reimbursableAllowance - reimbursableActual)

  const perDiem = perCategory.find(r => r.category === PER_DIEM)!
  const advanceHome = yen(input.advanceHome)
  const returnToCompany = yen(advanceHome - reimbursableActual)

  return {
    perCategory,
    reimbursableAllowance,
    reimbursableActual,
    budgetRemaining,
    perDiemAllowance: perDiem.allowance,
    perDiemActual: perDiem.actual,
    perDiemRemaining: perDiem.remaining,
    advanceHome,
    advanceRemaining: returnToCompany,
    returnToCompany,
    companyOwesEmployee: returnToCompany < 0 ? -returnToCompany : 0,
    isOverBudget: budgetRemaining < 0,
    overBudgetBy: budgetRemaining < 0 ? -budgetRemaining : 0
  }
}
