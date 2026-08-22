<script setup lang="ts">
import { CATEGORY_LABELS } from '#shared/domain/categories'
import { formatMoney } from '#shared/domain/money'
import type { ReportCategory } from '#shared/domain/report'

defineProps<{ row: ReportCategory }>()

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <section class="space-y-2">
    <div class="flex items-baseline justify-between gap-4 border-b border-default pb-1">
      <h3 class="font-medium">
        {{ CATEGORY_LABELS[row.category] }}
      </h3>
      <div class="text-sm tabular-nums flex gap-4">
        <span class="text-muted">Allowance {{ formatMoney(row.allowance, 'JPY') }}</span>
        <span>Actual {{ formatMoney(row.actual, 'JPY') }}</span>
        <span :class="row.overBy > 0 ? 'text-error' : 'text-success'">
          {{ row.overBy > 0 ? `Over ${formatMoney(row.overBy, 'JPY')}` : `Left ${formatMoney(row.remaining, 'JPY')}` }}
        </span>
      </div>
    </div>

    <p
      v-if="!row.expenses.length"
      class="text-sm text-muted"
    >
      No expenses recorded.
    </p>

    <table
      v-else
      class="w-full text-sm"
    >
      <thead class="text-xs text-muted uppercase tracking-wide">
        <tr>
          <th class="text-left font-normal py-1">
            Date
          </th>
          <th class="text-left font-normal py-1">
            Note
          </th>
          <th class="text-right font-normal py-1">
            As spent
          </th>
          <th class="text-right font-normal py-1">
            Rate
          </th>
          <th class="text-right font-normal py-1">
            JPY
          </th>
          <th class="text-right font-normal py-1">
            Receipts
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="expense in row.expenses"
          :key="expense.id"
          class="border-t border-default/60"
        >
          <td class="py-1 whitespace-nowrap">
            {{ formatDate(expense.spentAt) }}
          </td>
          <td class="py-1 text-muted">
            {{ expense.note || '—' }}
          </td>
          <td class="py-1 text-right tabular-nums whitespace-nowrap">
            {{ formatMoney(expense.amount, expense.currency) }}
          </td>
          <td class="py-1 text-right tabular-nums text-muted whitespace-nowrap">
            {{ expense.currency === 'JPY' ? '—' : expense.fxRateToHome }}
            <span
              v-if="expense.rateSource === 'manual'"
              class="text-warning"
            >*</span>
          </td>
          <td class="py-1 text-right tabular-nums whitespace-nowrap">
            {{ formatMoney(expense.amountHome, 'JPY') }}
          </td>
          <td class="py-1 text-right tabular-nums text-muted">
            {{ expense.receiptCount || '—' }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
