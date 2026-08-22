export const REIMBURSABLE_CATEGORIES = [
  'air_ticket',
  'taxi_bus',
  'hotel',
  'train',
  'travel_procedure',
  'travel_insurance',
  'other'
] as const

export const PER_DIEM = 'per_diem' as const

export const EXPENSE_CATEGORIES = [...REIMBURSABLE_CATEGORIES, PER_DIEM] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  air_ticket: 'Air Ticket',
  taxi_bus: 'Taxi & Bus',
  hotel: 'Hotel Bill',
  train: 'Train Fee',
  travel_procedure: 'Travel Procedure Expense',
  travel_insurance: 'Travel Insurance',
  other: 'Other',
  per_diem: 'Per Diem'
}

export const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  air_ticket: 'i-lucide-plane',
  taxi_bus: 'i-lucide-bus',
  hotel: 'i-lucide-bed',
  train: 'i-lucide-train-front',
  travel_procedure: 'i-lucide-file-text',
  travel_insurance: 'i-lucide-shield-check',
  other: 'i-lucide-ellipsis',
  per_diem: 'i-lucide-wallet'
}

/** Per Diem is the employee's own money and never enters the return calculation. */
export function isReimbursable(category: ExpenseCategory): boolean {
  return category !== PER_DIEM
}
