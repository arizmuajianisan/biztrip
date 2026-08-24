<script setup lang="ts">
import { formatMoney, roundMoney } from '#shared/domain/money'
import type { TripSummary } from '#shared/domain/summary'

const props = defineProps<{
  summary: TripSummary
  advanceAmount: number
  advanceCurrency: string
  advanceRate: number
  settlementCurrency: string
  settlement: { currency: string, rate: number, rateDate: string, amount: number } | null
}>()

// When the rate API is unreachable the figure is still computable by hand.
const manualRate = ref<number | undefined>(undefined)

const effective = computed(() => {
  if (props.settlement) return props.settlement
  if (manualRate.value === undefined || manualRate.value <= 0) return null
  return {
    currency: props.settlementCurrency,
    rate: manualRate.value,
    rateDate: 'manual',
    amount: roundMoney(props.summary.returnToCompany * manualRate.value, props.settlementCurrency)
  }
})

const owed = computed(() => props.summary.companyOwesEmployee > 0)
</script>

<template>
  <section class="space-y-3">
    <h3 class="font-medium border-b border-default pb-1">
      Settlement
    </h3>

    <dl class="text-sm space-y-1.5">
      <div class="flex justify-between gap-4">
        <dt>Temporary Payment (cash advance)</dt>
        <dd class="figure text-right">
          {{ formatMoney(summary.advanceHome, 'JPY') }}
          <span
            v-if="advanceCurrency !== 'JPY'"
            class="text-muted block text-xs"
          >
            {{ formatMoney(advanceAmount, advanceCurrency) }} at {{ advanceRate }} JPY per {{ advanceCurrency }}
          </span>
        </dd>
      </div>

      <div class="flex justify-between gap-4">
        <dt>Total reimbursable expenses</dt>
        <dd class="figure">
          − {{ formatMoney(summary.reimbursableActual, 'JPY') }}
        </dd>
      </div>

      <div class="flex justify-between gap-4 border-t border-default pt-1.5 font-medium text-base">
        <dt>{{ owed ? 'Company owes you' : 'Return to company' }}</dt>
        <dd
          class="figure"
          :class="owed ? 'text-warning' : ''"
        >
          {{ formatMoney(owed ? summary.companyOwesEmployee : summary.returnToCompany, 'JPY') }}
        </dd>
      </div>

      <p class="text-xs text-muted">
        Per Diem is excluded — it is your personal money and is not returned.
      </p>
    </dl>

    <div class="bg-elevated/60 rounded-md p-3 space-y-2">
      <div
        v-if="effective"
        class="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4 text-sm"
      >
        <div>
          <p class="font-medium">
            {{ owed ? 'Company owes you' : 'Amount to transfer' }} in {{ effective.currency }}
          </p>
          <p class="text-xs text-muted">
            At {{ effective.rate }} {{ effective.currency }} per JPY
            <span v-if="effective.rateDate !== 'manual'">· rate of {{ effective.rateDate }}</span>
            <span v-else>· rate entered manually</span>
          </p>
        </div>
        <p class="figure font-semibold text-lg whitespace-nowrap sm:text-right">
          {{ formatMoney(Math.abs(effective.amount), effective.currency) }}
        </p>
      </div>

      <div
        v-else
        class="space-y-2"
      >
        <p class="text-sm text-warning">
          No published JPY → {{ settlementCurrency }} rate available. Enter one to convert.
        </p>
        <UFormField
          :label="`${settlementCurrency} per 1 JPY`"
          class="no-print"
        >
          <UInputNumber
            v-model="manualRate"
            :min="0"
            :step="0.0001"
            class="w-full sm:w-60"
          />
        </UFormField>
      </div>
    </div>
  </section>
</template>
