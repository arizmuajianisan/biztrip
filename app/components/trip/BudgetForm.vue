<script setup lang="ts">
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  PER_DIEM,
  REIMBURSABLE_CATEGORIES
} from '#shared/domain/categories'
import { formatMoney, roundMoney } from '#shared/domain/money'
import type { BudgetInput } from '#shared/domain/summary'

const model = defineModel<BudgetInput[]>({ required: true })

function amountFor(category: string) {
  return model.value.find(b => b.category === category)?.amount ?? 0
}

function setAmount(category: string, amount: number | undefined) {
  const next = model.value.filter(b => b.category !== category)
  next.push({ category: category as BudgetInput['category'], amount: amount ?? 0 })
  model.value = next
}

const reimbursableTotal = computed(() =>
  roundMoney(REIMBURSABLE_CATEGORIES.reduce((sum, c) => sum + amountFor(c), 0), 'JPY'))
const perDiemTotal = computed(() => roundMoney(amountFor(PER_DIEM), 'JPY'))
const grandTotal = computed(() => roundMoney(reimbursableTotal.value + perDiemTotal.value, 'JPY'))
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="category in REIMBURSABLE_CATEGORIES"
      :key="category"
      class="flex items-center gap-3"
    >
      <UIcon
        :name="CATEGORY_ICONS[category]"
        class="size-4 text-muted shrink-0"
      />
      <span class="text-sm flex-1 min-w-0 truncate">{{ CATEGORY_LABELS[category] }}</span>
      <UInputNumber
        :model-value="amountFor(category)"
        :min="0"
        :step="1000"
        :format-options="{ style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }"
        class="w-44"
        @update:model-value="setAmount(category, $event)"
      />
    </div>

    <USeparator />

    <div class="flex items-center gap-3">
      <UIcon
        :name="CATEGORY_ICONS[PER_DIEM]"
        class="size-4 text-primary shrink-0"
      />
      <div class="flex-1 min-w-0">
        <div class="text-sm">
          {{ CATEGORY_LABELS[PER_DIEM] }}
        </div>
        <div class="text-xs text-muted">
          Your personal budget — not returned to the company
        </div>
      </div>
      <UInputNumber
        :model-value="amountFor(PER_DIEM)"
        :min="0"
        :step="1000"
        :format-options="{ style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }"
        class="w-44"
        @update:model-value="setAmount(PER_DIEM, $event)"
      />
    </div>

    <USeparator />

    <dl class="text-sm space-y-1">
      <div class="flex justify-between text-muted">
        <dt>Reimbursable total</dt>
        <dd class="tabular-nums">
          {{ formatMoney(reimbursableTotal, 'JPY') }}
        </dd>
      </div>
      <div class="flex justify-between text-muted">
        <dt>Per Diem</dt>
        <dd class="tabular-nums">
          {{ formatMoney(perDiemTotal, 'JPY') }}
        </dd>
      </div>
      <div class="flex justify-between font-medium">
        <dt>Grand total</dt>
        <dd class="tabular-nums">
          {{ formatMoney(grandTotal, 'JPY') }}
        </dd>
      </div>
    </dl>
  </div>
</template>
