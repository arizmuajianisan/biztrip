<script setup lang="ts">
import { EXPENSE_CATEGORIES } from '#shared/domain/categories'
import { formatMoney } from '#shared/domain/money'
import type { BudgetInput } from '#shared/domain/summary'

const props = defineProps<{
  tripId: string
  /** Current allowances, plus the actuals already spent against each. */
  perCategory: { category: BudgetInput['category'], allowance: number, actual: number }[]
}>()

const emit = defineEmits<{ saved: [] }>()

const open = defineModel<boolean>('open', { required: true })

const budgets = ref<BudgetInput[]>([])
const error = ref<string | null>(null)
const saving = ref(false)

function reset() {
  budgets.value = EXPENSE_CATEGORIES.map(category => ({
    category,
    amount: props.perCategory.find(r => r.category === category)?.allowance ?? 0
  }))
}

watch(open, (isOpen) => {
  if (!isOpen) return
  error.value = null
  reset()
}, { immediate: true })

/**
 * Cutting an allowance below what has already been spent is legal but pushes
 * the category over budget, so it is called out rather than silently applied.
 */
const nowOverspent = computed(() => props.perCategory
  .map(row => ({
    ...row,
    next: budgets.value.find(b => b.category === row.category)?.amount ?? 0
  }))
  .filter(row => row.actual > row.next && row.actual <= row.allowance))

async function save() {
  error.value = null
  saving.value = true
  try {
    await $fetch(`/api/trips/${props.tripId}`, {
      method: 'PATCH',
      body: { budgets: budgets.value }
    })
    open.value = false
    emit('saved')
  } catch (e) {
    error.value = (e as { data?: { statusMessage?: string } }).data?.statusMessage
      ?? 'Could not save the budgets.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Edit budgets"
    description="What finance allocated per category, in JPY."
    :ui="{ content: 'max-w-lg', body: 'max-h-[70vh] overflow-y-auto' }"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="error"
        />

        <TripBudgetForm v-model="budgets" />

        <UAlert
          v-for="row in nowOverspent"
          :key="row.category"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="`This puts that category over budget — ${formatMoney(row.actual, 'JPY')} is already spent against it.`"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          label="Cancel"
          color="neutral"
          variant="ghost"
          @click="open = false"
        />
        <UButton
          label="Save budgets"
          :loading="saving"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
