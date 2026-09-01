import { boolean, date, index, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('user_role', ['superadmin', 'admin', 'user'])
export const categoryEnum = pgEnum('expense_category', [
  'air_ticket', 'taxi_bus', 'hotel', 'train',
  'travel_procedure', 'travel_insurance', 'other', 'per_diem'
])
export const tripStatusEnum = pgEnum('trip_status', ['active', 'closed'])
export const rateSourceEnum = pgEnum('rate_source', ['api', 'manual'])

const money = (name: string) => numeric(name, { precision: 18, scale: 4, mode: 'number' })
const fxRate = (name: string) => numeric(name, { precision: 18, scale: 8, mode: 'number' })

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('user'),
  displayName: text('display_name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const trips = pgTable('trips', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  destinationCountry: text('destination_country').notNull(),
  defaultCurrency: text('default_currency').notNull(),
  homeCurrency: text('home_currency').notNull().default('JPY'),
  settlementCurrency: text('settlement_currency').notNull().default('IDR'),
  temporaryPaymentAmount: money('temporary_payment_amount').notNull().default(0),
  temporaryPaymentCurrency: text('temporary_payment_currency').notNull().default('JPY'),
  temporaryPaymentFxRateToHome: fxRate('temporary_payment_fx_rate_to_home').notNull().default(1),
  temporaryPaymentAmountHome: money('temporary_payment_amount_home').notNull().default(0),
  // Emergency cash handed over on top of the main advance. Deliberately not a
  // budget category: it funds nothing in particular and is returned if unused.
  additionalPaymentAmount: money('additional_payment_amount').notNull().default(0),
  additionalPaymentCurrency: text('additional_payment_currency').notNull().default('JPY'),
  additionalPaymentFxRateToHome: fxRate('additional_payment_fx_rate_to_home').notNull().default(1),
  additionalPaymentAmountHome: money('additional_payment_amount_home').notNull().default(0),
  status: tripStatusEnum('status').notNull().default('active'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => [index('trips_user_id_idx').on(t.userId)])

export const tripBudgets = pgTable('trip_budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  category: categoryEnum('category').notNull(),
  amount: money('amount').notNull().default(0)
}, t => [index('trip_budgets_trip_id_idx').on(t.tripId)])

export const tripCurrencies = pgTable('trip_currencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  currency: text('currency').notNull()
}, t => [index('trip_currencies_trip_id_idx').on(t.tripId)])

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  category: categoryEnum('category').notNull(),
  amount: money('amount').notNull(),
  currency: text('currency').notNull(),
  fxRateToHome: fxRate('fx_rate_to_home').notNull(),
  amountHome: money('amount_home').notNull(),
  rateSource: rateSourceEnum('rate_source').notNull().default('api'),
  spentAt: date('spent_at').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => [index('expenses_trip_id_idx').on(t.tripId)])

export const receipts = pgTable('receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  expenseId: uuid('expense_id').notNull().references(() => expenses.id, { onDelete: 'cascade' }),
  r2Key: text('r2_key').notNull(),
  filename: text('filename').notNull(),
  contentType: text('content_type').notNull(),
  size: numeric('size', { precision: 12, scale: 0, mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => [index('receipts_expense_id_idx').on(t.expenseId)])
