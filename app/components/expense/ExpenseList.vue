<script setup lang="ts">
import { CATEGORY_ICONS, CATEGORY_LABELS, type ExpenseCategory } from '#shared/domain/categories'
import { formatMoney } from '#shared/domain/money'

interface ExpenseRow {
  id: string
  category: ExpenseCategory
  amount: number
  currency: string
  amountHome: number
  rateSource: 'api' | 'manual'
  spentAt: string
  note: string | null
  receiptCount: number
}

const props = defineProps<{ expenses: ExpenseRow[], readonly?: boolean }>()

const emit = defineEmits<{ edit: [ExpenseRow], deleted: [], reordered: [] }>()

/*
 * The list runs newest day first, and each day reads in journey order, so a
 * neighbour is only reorderable when it falls on the same date. Comparing
 * against the adjacent row keeps this in step with whatever the server sent.
 */
function canMove(index: number, direction: 'up' | 'down') {
  const neighbour = props.expenses[direction === 'up' ? index - 1 : index + 1]
  return !!neighbour && neighbour.spentAt === props.expenses[index]!.spentAt
}

const moving = ref<string | null>(null)

async function move(expense: ExpenseRow, direction: 'up' | 'down') {
  moving.value = expense.id
  try {
    await $fetch(`/api/expenses/${expense.id}/move`, {
      method: 'POST',
      body: { direction }
    })
    emit('reordered')
  } finally {
    moving.value = null
  }
}

const deleting = ref<ExpenseRow | null>(null)
const busy = ref(false)

async function confirmDelete() {
  if (!deleting.value) return
  busy.value = true
  try {
    await $fetch(`/api/expenses/${deleting.value.id}`, { method: 'DELETE' })
    deleting.value = null
    emit('deleted')
  } finally {
    busy.value = false
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div>
    <p
      v-if="!expenses.length"
      class="text-sm text-muted py-6 text-center"
    >
      No expenses logged yet.
    </p>

    <ul
      v-else
      class="divide-y divide-default"
    >
      <li
        v-for="(expense, index) in expenses"
        :key="expense.id"
        class="py-3 flex items-center gap-2 sm:gap-3"
      >
        <!-- Only shown where a same-day neighbour exists to swap with. -->
        <div
          v-if="!readonly"
          class="flex flex-col shrink-0 -my-1"
        >
          <UButton
            icon="i-lucide-chevron-up"
            color="neutral"
            variant="ghost"
            size="xs"
            :disabled="!canMove(index, 'up') || moving === expense.id"
            :aria-label="`Move ${CATEGORY_LABELS[expense.category]} earlier in the day`"
            @click="move(expense, 'up')"
          />
          <UButton
            icon="i-lucide-chevron-down"
            color="neutral"
            variant="ghost"
            size="xs"
            :disabled="!canMove(index, 'down') || moving === expense.id"
            :aria-label="`Move ${CATEGORY_LABELS[expense.category]} later in the day`"
            @click="move(expense, 'down')"
          />
        </div>

        <UIcon
          :name="CATEGORY_ICONS[expense.category]"
          class="size-4 text-muted shrink-0"
        />

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm">{{ CATEGORY_LABELS[expense.category] }}</span>
            <UBadge
              v-if="expense.receiptCount"
              :label="`${expense.receiptCount}`"
              icon="i-lucide-paperclip"
              color="neutral"
              variant="subtle"
              size="sm"
            />
            <UBadge
              v-if="expense.rateSource === 'manual'"
              label="manual rate"
              color="warning"
              variant="subtle"
              size="sm"
            />
          </div>
          <p class="text-xs text-muted truncate">
            {{ formatDate(expense.spentAt) }}<span v-if="expense.note"> · {{ expense.note }}</span>
          </p>
        </div>

        <div class="text-right shrink-0">
          <p class="text-sm figure whitespace-nowrap">
            {{ formatMoney(expense.amount, expense.currency) }}
          </p>
          <p
            v-if="expense.currency !== 'JPY'"
            class="text-xs text-muted figure whitespace-nowrap"
          >
            {{ formatMoney(expense.amountHome, 'JPY') }}
          </p>
        </div>

        <!-- `sm` rather than `xs`: an xs icon button is ~24px, well under the 44px touch target. -->
        <div
          v-if="!readonly"
          class="flex gap-0.5 shrink-0"
        >
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Edit expense"
            @click="emit('edit', expense)"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Delete expense"
            @click="deleting = expense"
          />
        </div>
      </li>
    </ul>

    <UModal
      :open="!!deleting"
      title="Delete this expense?"
      description="The expense and its receipt images will be removed permanently."
      @update:open="deleting = null"
    >
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="deleting = null"
          />
          <UButton
            label="Delete"
            color="error"
            :loading="busy"
            @click="confirmDelete"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
