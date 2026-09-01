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
  /** The main cash advance. */
  advanceBase: number
  /** Emergency top-up handed over on top of the main advance. */
  advanceAdditional: number
  /** Total cash the employee is holding: base + additional. */
  advanceHome: number
  /** The per diem the employee keeps — the full allowance, spent or not. */
  perDiemKept: number
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
  /** The main cash advance, in JPY. */
  advanceHome: number
  /** Optional emergency top-up handed over on top of it, in JPY. */
  additionalAdvanceHome?: number
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

  const advanceBase = yen(input.advanceHome)
  const advanceAdditional = yen(input.additionalAdvanceHome ?? 0)
  const advanceHome = yen(advanceBase + advanceAdditional)

  /*
   * The advance is one lump of cash that funds both the reimbursable spending
   * and the per diem. The per diem is a fixed entitlement the employee keeps
   * whether or not they spend it, so it must come out of the cash before the
   * remainder goes back — otherwise the unspent per diem gets clawed back and
   * the report contradicts its own "kept by the employee" line.
   */
  const perDiemKept = perDiem.allowance
  const returnToCompany = yen(advanceHome - reimbursableActual - perDiemKept)

  return {
    perCategory,
    reimbursableAllowance,
    reimbursableActual,
    budgetRemaining,
    perDiemAllowance: perDiem.allowance,
    perDiemActual: perDiem.actual,
    perDiemRemaining: perDiem.remaining,
    advanceBase,
    advanceAdditional,
    advanceHome,
    perDiemKept,
    returnToCompany,
    companyOwesEmployee: returnToCompany < 0 ? -returnToCompany : 0,
    isOverBudget: budgetRemaining < 0,
    overBudgetBy: budgetRemaining < 0 ? -budgetRemaining : 0
  }
}
