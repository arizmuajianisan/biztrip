<script setup lang="ts">
import { formatMoney, roundMoney } from '../../../shared/domain/money'
import type { TripSummary } from '../../../shared/domain/summary'

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
          class="text-3xl font-semibold tabular-nums"
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
          class="text-sm text-muted tabular-nums"
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
          class="text-3xl font-semibold tabular-nums"
          :class="summary.perDiemRemaining < 0 ? 'text-warning' : 'text-highlighted'"
        >
          {{ display(summary.perDiemRemaining) }}
        </p>
        <p class="text-sm text-muted tabular-nums">
          {{ formatMoney(summary.perDiemActual, 'JPY') }} of
          {{ formatMoney(summary.perDiemAllowance, 'JPY') }} spent
        </p>
      </UCard>
    </div>

    <div class="flex items-center justify-between gap-4 flex-wrap">
      <dl class="flex gap-6 text-sm">
        <div>
          <dt class="text-muted text-xs">
            Cash advance
          </dt>
          <dd class="tabular-nums">
            {{ formatMoney(summary.advanceHome, 'JPY') }}
            <span
              v-if="advanceCurrency !== 'JPY'"
              class="text-muted"
            >
              ({{ formatMoney(advanceAmount, advanceCurrency) }})
            </span>
          </dd>
        </div>
        <div>
          <dt class="text-muted text-xs">
            Reimbursable spent
          </dt>
          <dd class="tabular-nums">
            {{ formatMoney(summary.reimbursableActual, 'JPY') }}
          </dd>
        </div>
        <div>
          <dt class="text-muted text-xs">
            {{ summary.companyOwesEmployee ? 'Company owes you' : 'Return to company' }}
          </dt>
          <dd
            class="tabular-nums font-medium"
            :class="summary.companyOwesEmployee ? 'text-warning' : ''"
          >
            {{ formatMoney(summary.companyOwesEmployee || summary.returnToCompany, 'JPY') }}
          </dd>
        </div>
      </dl>

      <USwitch
        v-if="canShowLocal"
        v-model="showLocal"
        :label="`Show in ${displayCurrency}`"
        size="sm"
      />
    </div>
  </div>
</template>
