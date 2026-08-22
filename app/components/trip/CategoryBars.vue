<script setup lang="ts">
import { CATEGORY_ICONS, CATEGORY_LABELS, PER_DIEM } from '#shared/domain/categories'
import { formatMoney } from '#shared/domain/money'
import type { CategorySummary, TripSummary } from '#shared/domain/summary'

const props = defineProps<{ summary: TripSummary }>()

const reimbursable = computed(() => props.summary.perCategory.filter(r => r.category !== PER_DIEM))
const perDiem = computed(() => props.summary.perCategory.find(r => r.category === PER_DIEM)!)

function percent(row: CategorySummary) {
  if (row.allowance <= 0) return row.actual > 0 ? 100 : 0
  return Math.min(100, Math.round((row.actual / row.allowance) * 100))
}
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="row in reimbursable"
      :key="row.category"
      class="space-y-1.5"
    >
      <div class="flex items-center gap-2 text-sm">
        <UIcon
          :name="CATEGORY_ICONS[row.category]"
          class="size-4 text-muted shrink-0"
        />
        <span class="flex-1 min-w-0 truncate">{{ CATEGORY_LABELS[row.category] }}</span>
        <span class="tabular-nums text-muted text-xs">
          {{ formatMoney(row.actual, 'JPY') }} / {{ formatMoney(row.allowance, 'JPY') }}
        </span>
        <UBadge
          v-if="row.overBy > 0"
          :label="`+${formatMoney(row.overBy, 'JPY')}`"
          color="error"
          variant="subtle"
          size="sm"
        />
      </div>
      <UProgress
        :model-value="percent(row)"
        :color="row.overBy > 0 ? 'error' : 'primary'"
        size="sm"
      />
    </div>

    <USeparator />

    <div class="space-y-1.5">
      <div class="flex items-center gap-2 text-sm">
        <UIcon
          :name="CATEGORY_ICONS[PER_DIEM]"
          class="size-4 text-primary shrink-0"
        />
        <span class="flex-1 min-w-0">
          {{ CATEGORY_LABELS[PER_DIEM] }}
          <span class="text-xs text-muted block">Personal — excluded from the return calculation</span>
        </span>
        <span class="tabular-nums text-muted text-xs">
          {{ formatMoney(perDiem.actual, 'JPY') }} / {{ formatMoney(perDiem.allowance, 'JPY') }}
        </span>
      </div>
      <UProgress
        :model-value="percent(perDiem)"
        :color="perDiem.overBy > 0 ? 'warning' : 'primary'"
        size="sm"
      />
    </div>
  </div>
</template>
