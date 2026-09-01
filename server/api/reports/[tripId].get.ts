import { asc, count, eq } from 'drizzle-orm'
import { roundMoney } from '../../../shared/domain/money'
import { buildReport } from '../../../shared/domain/report'
import { schema, useDb } from '../../utils/db'
import { fetchRate } from '../../utils/fx'
import { requireTrip } from '../../utils/guard'

export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, 'tripId')!
  const trip = await requireTrip(event, tripId)
  const db = useDb(event)

  const [budgets, expenseRows, receiptCounts, receiptRows, owner] = await Promise.all([
    db.select().from(schema.tripBudgets).where(eq(schema.tripBudgets.tripId, tripId)),
    // Without an explicit order Postgres is free to return these however it
    // likes, and that order changes as rows get updated.
    db.select().from(schema.expenses)
      .where(eq(schema.expenses.tripId, tripId))
      .orderBy(asc(schema.expenses.spentAt), asc(schema.expenses.createdAt)),
    db.select({ expenseId: schema.receipts.expenseId, total: count() })
      .from(schema.receipts)
      .innerJoin(schema.expenses, eq(schema.expenses.id, schema.receipts.expenseId))
      .where(eq(schema.expenses.tripId, tripId))
      .groupBy(schema.receipts.expenseId),
    db.select({
      id: schema.receipts.id,
      expenseId: schema.receipts.expenseId,
      filename: schema.receipts.filename,
      contentType: schema.receipts.contentType
    })
      .from(schema.receipts)
      .innerJoin(schema.expenses, eq(schema.expenses.id, schema.receipts.expenseId))
      .where(eq(schema.expenses.tripId, tripId))
      .orderBy(asc(schema.receipts.createdAt)),
    db.select({ displayName: schema.users.displayName, email: schema.users.email })
      .from(schema.users).where(eq(schema.users.id, trip.userId)).limit(1)
  ])

  const counts = new Map(receiptCounts.map(r => [r.expenseId, r.total]))

  const report = buildReport({
    budgets: budgets.map(b => ({ category: b.category, amount: b.amount })),
    expenses: expenseRows.map(e => ({
      id: e.id,
      category: e.category,
      spentAt: e.spentAt,
      amount: e.amount,
      currency: e.currency,
      fxRateToHome: e.fxRateToHome,
      amountHome: e.amountHome,
      rateSource: e.rateSource,
      note: e.note,
      receiptCount: counts.get(e.id) ?? 0,
      createdAt: e.createdAt.toISOString()
    })),
    advanceHome: trip.temporaryPaymentAmountHome,
    additionalAdvanceHome: trip.additionalPaymentAmountHome
  })

  // The settlement figure uses today's rate, not a frozen one — it is what the
  // employee will actually transfer. A missing rate must not break the report.
  let settlement: { currency: string, rate: number, rateDate: string, amount: number } | null
  try {
    const { rate, date } = await fetchRate('JPY', trip.settlementCurrency)
    settlement = {
      currency: trip.settlementCurrency,
      rate,
      rateDate: date,
      amount: roundMoney(report.summary.returnToCompany * rate, trip.settlementCurrency)
    }
  } catch {
    settlement = null
  }

  return {
    trip,
    owner: owner[0] ?? null,
    report,
    receipts: receiptRows,
    settlement,
    generatedAt: new Date().toISOString()
  }
})
