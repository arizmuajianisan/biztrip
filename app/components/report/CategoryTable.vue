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
    <div class="border-b border-default pb-1 sm:flex sm:items-baseline sm:justify-between sm:gap-4">
      <h3 class="font-medium">
        {{ CATEGORY_LABELS[row.category] }}
      </h3>
      <!-- Allowance / actual / variance: a row on desktop, a tidy trio on mobile. -->
      <div class="text-xs sm:text-sm figure flex justify-between gap-3 sm:gap-4 mt-0.5 sm:mt-0">
        <span class="text-muted">
          <span class="sm:hidden block text-[0.65rem] uppercase tracking-wide">Allowance</span>
          <span class="hidden sm:inline">Allowance </span>{{ formatMoney(row.allowance, 'JPY') }}
        </span>
        <span>
          <span class="sm:hidden block text-[0.65rem] uppercase tracking-wide text-muted">Actual</span>
          <span class="hidden sm:inline">Actual </span>{{ formatMoney(row.actual, 'JPY') }}
        </span>
        <span
          class="text-right"
          :class="row.overBy > 0 ? 'text-error' : 'text-success'"
        >
          <span class="sm:hidden block text-[0.65rem] uppercase tracking-wide text-muted">
            {{ row.overBy > 0 ? 'Over' : 'Left' }}
          </span>
          <span class="hidden sm:inline">{{ row.overBy > 0 ? 'Over ' : 'Left ' }}</span>
          {{ formatMoney(row.overBy > 0 ? row.overBy : row.remaining, 'JPY') }}
        </span>
      </div>
    </div>

    <p
      v-if="!row.expenses.length"
      class="text-sm text-muted"
    >
      No expenses recorded.
    </p>

    <template v-else>
      <!--
        Six columns cannot fit a phone, and a horizontally scrolling financial
        table hides figures the reader needs. On mobile each expense becomes a
        small card; print and desktop get the real table.
      -->
      <ul class="space-y-2 sm:hidden print-hidden">
        <li
          v-for="expense in row.expenses"
          :key="expense.id"
          class="rounded-md border border-default px-3 py-2 text-sm"
        >
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-xs text-muted whitespace-nowrap">{{ formatDate(expense.spentAt) }}</span>
            <span class="figure font-medium">{{ formatMoney(expense.amountHome, 'JPY') }}</span>
          </div>
          <div class="flex items-baseline justify-between gap-3 text-xs text-muted mt-0.5">
            <span class="truncate">{{ expense.note || '—' }}</span>
            <span
              v-if="expense.currency !== 'JPY'"
              class="figure whitespace-nowrap"
            >
              {{ formatMoney(expense.amount, expense.currency) }} @ {{ expense.fxRateToHome }}
              <span
                v-if="expense.rateSource === 'manual'"
                class="text-warning"
              >*</span>
            </span>
          </div>
          <p
            v-if="expense.receiptCount"
            class="text-xs text-muted mt-1 flex items-center gap-1"
          >
            <UIcon
              name="i-lucide-paperclip"
              class="size-3"
            />
            {{ expense.receiptCount }} receipt{{ expense.receiptCount === 1 ? '' : 's' }}
          </p>
        </li>
      </ul>

      <table class="w-full text-sm hidden sm:table print-table">
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
            <td class="py-1 text-right figure whitespace-nowrap">
              {{ formatMoney(expense.amount, expense.currency) }}
            </td>
            <td class="py-1 text-right figure text-muted whitespace-nowrap">
              {{ expense.currency === 'JPY' ? '—' : expense.fxRateToHome }}
              <span
                v-if="expense.rateSource === 'manual'"
                class="text-warning"
              >*</span>
            </td>
            <td class="py-1 text-right figure whitespace-nowrap">
              {{ formatMoney(expense.amountHome, 'JPY') }}
            </td>
            <td class="py-1 text-right figure text-muted">
              {{ expense.receiptCount || '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </section>
</template>
