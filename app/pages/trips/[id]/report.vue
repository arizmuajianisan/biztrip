<script setup lang="ts">
import { countryName } from '#shared/domain/currencies'
import { formatMoney } from '#shared/domain/money'

definePageMeta({ layout: 'blank' })

const route = useRoute()
const tripId = computed(() => route.params.id as string)

const { data, status } = await useFetch(() => `/api/reports/${tripId.value}`, { watch: [tripId] })

useSeoMeta({ title: () => data.value ? `${data.value.trip.name} — Report` : 'Report' })

const summary = computed(() => data.value?.report.summary)

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function print() {
  window.print()
}
</script>

<template>
  <div class="w-full max-w-3xl mx-auto py-6 sm:py-8 px-4 pb-safe inset-x-safe self-start">
    <div
      v-if="status === 'pending'"
      class="space-y-4"
    >
      <USkeleton class="h-8 w-64" />
      <USkeleton class="h-40 w-full" />
    </div>

    <div
      v-else-if="data && summary"
      class="space-y-6"
    >
      <div class="no-print flex items-center justify-between gap-2">
        <UButton
          :to="`/trips/${tripId}`"
          label="Back to trip"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="link"
          class="-ms-3"
        />
        <UButton
          icon="i-lucide-printer"
          label="Print / Save as PDF"
          aria-label="Print or save as PDF"
          :ui="{ label: 'hidden sm:inline' }"
          @click="print"
        />
      </div>

      <header class="space-y-1">
        <h1 class="text-xl sm:text-2xl font-semibold tracking-tight break-words">
          {{ data.trip.name }}
        </h1>
        <p class="text-sm text-muted">
          {{ countryName(data.trip.destinationCountry) }} ·
          {{ formatDate(data.trip.startDate) }} – {{ formatDate(data.trip.endDate) }}
        </p>
        <p class="text-sm text-muted">
          <span v-if="data.owner">{{ data.owner.displayName }} ({{ data.owner.email }}) · </span>
          Generated {{ formatDate(data.generatedAt) }}
        </p>
      </header>

      <ReportCategoryTable
        v-for="row in data.report.reimbursable"
        :key="row.category"
        :row="row"
      />

      <section class="space-y-2">
        <h3 class="font-medium border-b border-default pb-1">
          Reimbursable totals
        </h3>
        <dl class="text-sm space-y-1">
          <div class="flex justify-between">
            <dt>Total allowance</dt>
            <dd class="figure">
              {{ formatMoney(summary.reimbursableAllowance, 'JPY') }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt>Total actual</dt>
            <dd class="figure">
              {{ formatMoney(summary.reimbursableActual, 'JPY') }}
            </dd>
          </div>
        </dl>
        <div
          class="rounded-md px-3 py-2 text-sm font-medium"
          :class="summary.isOverBudget
            ? 'bg-error/10 text-error'
            : 'bg-success/10 text-success'"
        >
          {{ summary.isOverBudget
            ? `OVER BUDGET by ${formatMoney(summary.overBudgetBy, 'JPY')}`
            : `UNDER BUDGET by ${formatMoney(summary.budgetRemaining, 'JPY')}` }}
        </div>
      </section>

      <ReportSettlementBlock
        :summary="summary"
        :advance-amount="data.trip.temporaryPaymentAmount"
        :advance-currency="data.trip.temporaryPaymentCurrency"
        :advance-rate="data.trip.temporaryPaymentFxRateToHome"
        :settlement-currency="data.trip.settlementCurrency"
        :settlement="data.settlement"
      />

      <section class="space-y-2">
        <h3 class="font-medium border-b border-default pb-1">
          Per Diem — personal, not reimbursed
        </h3>
        <dl class="text-sm space-y-1">
          <div class="flex justify-between">
            <dt>Allowance</dt>
            <dd class="figure">
              {{ formatMoney(summary.perDiemAllowance, 'JPY') }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt>Spent</dt>
            <dd class="figure">
              {{ formatMoney(summary.perDiemActual, 'JPY') }}
            </dd>
          </div>
          <div class="flex justify-between font-medium">
            <dt>Remaining — kept by the employee</dt>
            <dd class="figure">
              {{ formatMoney(summary.perDiemRemaining, 'JPY') }}
            </dd>
          </div>
        </dl>
        <ReportCategoryTable
          v-if="data.report.perDiem.expenses.length"
          :row="data.report.perDiem"
        />
      </section>

      <ReportReceiptsAppendix :receipts="data.receipts" />
    </div>
  </div>
</template>
