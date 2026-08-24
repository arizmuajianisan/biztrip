<script setup lang="ts">
import { formatMoney, roundMoney } from '#shared/domain/money'
import type { TripSummary } from '#shared/domain/summary'

const props = defineProps<{
  summary: TripSummary
  advanceCurrency: string
  advanceAmount: number
  displayCurrency: string
}>()

// Indicative conversion of the headline figures into the trip's local currency.
const localRate = ref<number | null>(null)
const showLocal = ref(false)

watchEffect(async () => {
  if (props.displayCurrency === 'JPY') {
    localRate.value = 1
    return
  }
  try {
    const result = await $fetch('/api/fx/rate', { query: { from: 'JPY', to: props.displayCurrency } })
    localRate.value = result.rate
  } catch {
    localRate.value = null
  }
})

const canShowLocal = computed(() => props.displayCurrency !== 'JPY' && localRate.value !== null)

function display(yen: number) {
  if (!showLocal.value || !canShowLocal.value) return formatMoney(yen, 'JPY')
  return `≈ ${formatMoney(roundMoney(yen * localRate.value!, props.displayCurrency), props.displayCurrency)}`
}
</script>

<template>
  <div class="space-y-4">
    <div class="grid sm:grid-cols-2 gap-4">
      <UCard :ui="{ body: 'space-y-1' }">
        <p class="text-xs uppercase tracking-wide text-muted">
          Budget remaining
        </p>
        <p
          class="text-2xl sm:text-3xl font-semibold figure break-all"
          :class="summary.isOverBudget ? 'text-error' : 'text-highlighted'"
        >
          {{ display(summary.budgetRemaining) }}
        </p>
        <p
          v-if="summary.isOverBudget"
          class="text-sm text-error"
        >
          Over budget by {{ formatMoney(summary.overBudgetBy, 'JPY') }}
        </p>
        <p
          v-else
          class="text-sm text-muted figure"
        >
          {{ formatMoney(summary.reimbursableActual, 'JPY') }} of
          {{ formatMoney(summary.reimbursableAllowance, 'JPY') }} spent
        </p>
      </UCard>

      <UCard :ui="{ body: 'space-y-1' }">
        <div class="flex items-center gap-2">
          <p class="text-xs uppercase tracking-wide text-muted">
            Per Diem remaining
          </p>
          <UBadge
            label="Yours — not returned"
            color="primary"
            variant="subtle"
            size="sm"
          />
        </div>
        <p
          class="text-2xl sm:text-3xl font-semibold figure break-all"
          :class="summary.perDiemRemaining < 0 ? 'text-warning' : 'text-highlighted'"
        >
          {{ display(summary.perDiemRemaining) }}
        </p>
        <p class="text-sm text-muted figure">
          {{ formatMoney(summary.perDiemActual, 'JPY') }} of
          {{ formatMoney(summary.perDiemAllowance, 'JPY') }} spent
        </p>
      </UCard>
    </div>

    <!--
      Reconciliation figures. A flex row overflows a 375px screen, so these
      become stacked rows on mobile with the amount hard-right, which also
      lets the mono figures form a scannable column.
    -->
    <div class="rounded-lg border border-default bg-default/60 divide-y divide-default sm:divide-y-0">
      <dl class="text-sm divide-y divide-default sm:divide-y-0 sm:flex sm:gap-6 sm:p-4">
        <div class="flex items-baseline justify-between gap-3 px-4 py-2.5 sm:block sm:p-0">
          <dt class="text-muted text-xs whitespace-nowrap">
            Cash advance
          </dt>
          <dd class="figure text-right sm:text-left">
            {{ formatMoney(summary.advanceHome, 'JPY') }}
            <span
              v-if="advanceCurrency !== 'JPY'"
              class="text-muted block sm:inline text-xs"
            >
              ({{ formatMoney(advanceAmount, advanceCurrency) }})
            </span>
          </dd>
        </div>
        <div class="flex items-baseline justify-between gap-3 px-4 py-2.5 sm:block sm:p-0">
          <dt class="text-muted text-xs whitespace-nowrap">
            Reimbursable spent
          </dt>
          <dd class="figure">
            {{ formatMoney(summary.reimbursableActual, 'JPY') }}
          </dd>
        </div>
        <div class="flex items-baseline justify-between gap-3 px-4 py-2.5 sm:block sm:p-0">
          <dt class="text-muted text-xs whitespace-nowrap">
            {{ summary.companyOwesEmployee ? 'Company owes you' : 'Return to company' }}
          </dt>
          <dd
            class="figure font-medium"
            :class="summary.companyOwesEmployee ? 'text-warning' : ''"
          >
            {{ formatMoney(summary.companyOwesEmployee || summary.returnToCompany, 'JPY') }}
          </dd>
        </div>

        <USwitch
          v-if="canShowLocal"
          v-model="showLocal"
          :label="`Show in ${displayCurrency}`"
          size="sm"
          class="px-4 py-3 sm:p-0 sm:ms-auto sm:self-center"
        />
      </dl>
    </div>
  </div>
</template>
