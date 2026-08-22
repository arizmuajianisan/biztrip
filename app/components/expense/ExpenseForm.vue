<script setup lang="ts">
import { CATEGORY_ICONS, CATEGORY_LABELS, EXPENSE_CATEGORIES } from '../../../shared/domain/categories'
import { formatMoney, toHome } from '../../../shared/domain/money'

interface ExistingExpense {
  id: string
  category: typeof EXPENSE_CATEGORIES[number]
  amount: number
  currency: string
  spentAt: string
  note: string | null
}

const props = defineProps<{
  tripId: string
  currencies: string[]
  defaultCurrency: string
  startDate: string
  endDate: string
  expense?: ExistingExpense
}>()

const emit = defineEmits<{ saved: [] }>()

const open = defineModel<boolean>('open', { required: true })

const today = new Date().toISOString().slice(0, 10)

const amount = ref<number>(0)
const currency = ref(props.defaultCurrency)
const category = ref<typeof EXPENSE_CATEGORIES[number]>('other')
const spentAt = ref(today)
const note = ref('')
const manualRate = ref<number | undefined>(undefined)

const error = ref<string | null>(null)
const saving = ref(false)
const uploader = useTemplateRef<{ upload: (id: string) => Promise<void> }>('uploader')

// Reset to either the edited expense or a blank entry each time the modal opens.
watch(open, (isOpen) => {
  if (!isOpen) return
  error.value = null
  manualRate.value = undefined
  if (props.expense) {
    amount.value = props.expense.amount
    currency.value = props.expense.currency
    category.value = props.expense.category
    spentAt.value = props.expense.spentAt
    note.value = props.expense.note ?? ''
  } else {
    amount.value = 0
    currency.value = props.defaultCurrency
    category.value = 'other'
    spentAt.value = today >= props.startDate && today <= props.endDate ? today : props.startDate
    note.value = ''
  }
}, { immediate: true })

const rate = ref<number | null>(1)
const rateUnavailable = ref(false)
const rateLoading = ref(false)

watchEffect(async () => {
  if (!open.value) return
  const from = currency.value
  const on = spentAt.value
  if (from === 'JPY') {
    rate.value = 1
    rateUnavailable.value = false
    return
  }
  rateLoading.value = true
  try {
    const result = await $fetch('/api/fx/rate', { query: { from, to: 'JPY', date: on } })
    rate.value = result.rate
    rateUnavailable.value = false
  } catch {
    rate.value = null
    rateUnavailable.value = true
  } finally {
    rateLoading.value = false
  }
})

const effectiveRate = computed(() => rate.value ?? manualRate.value ?? null)
const homeEquivalent = computed(() =>
  effectiveRate.value === null ? null : toHome(amount.value, effectiveRate.value))

const outsideTripDates = computed(() => spentAt.value < props.startDate || spentAt.value > props.endDate)

const categoryItems = EXPENSE_CATEGORIES.map(value => ({
  label: CATEGORY_LABELS[value],
  icon: CATEGORY_ICONS[value],
  value
}))

async function save() {
  error.value = null
  if (!amount.value || amount.value <= 0) {
    error.value = 'Enter an amount greater than zero.'
    return
  }
  if (effectiveRate.value === null) {
    error.value = `No published rate for ${currency.value}. Enter one manually.`
    return
  }

  saving.value = true
  try {
    let expenseId = props.expense?.id
    if (expenseId) {
      await $fetch(`/api/expenses/${expenseId}`, {
        method: 'PATCH',
        body: {
          category: category.value,
          amount: amount.value,
          currency: currency.value,
          spentAt: spentAt.value,
          note: note.value.trim() || null,
          fxRate: manualRate.value
        }
      })
    } else {
      const created = await $fetch('/api/expenses', {
        method: 'POST',
        body: {
          tripId: props.tripId,
          category: category.value,
          amount: amount.value,
          currency: currency.value,
          spentAt: spentAt.value,
          note: note.value.trim() || undefined,
          fxRate: manualRate.value
        }
      })
      expenseId = created.id
    }

    await uploader.value?.upload(expenseId!)
    open.value = false
    emit('saved')
  } catch (e) {
    error.value = (e as { data?: { statusMessage?: string } }).data?.statusMessage
      ?? 'Could not save the expense.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="expense ? 'Edit expense' : 'Add expense'"
    :ui="{ content: 'max-w-lg' }"
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

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Amount">
            <UInputNumber
              v-model="amount"
              :min="0"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Currency">
            <USelectMenu
              v-model="currency"
              :items="currencies"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Category"
            class="col-span-2"
          >
            <USelectMenu
              v-model="category"
              :items="categoryItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Date"
            class="col-span-2"
            :help="outsideTripDates ? 'This date falls outside the trip dates.' : undefined"
          >
            <UInput
              v-model="spentAt"
              type="date"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="rateUnavailable"
            label="Exchange rate"
            class="col-span-2"
            :help="`JPY per 1 ${currency} — no published rate for this currency or date`"
          >
            <UInputNumber
              v-model="manualRate"
              :min="0"
              :step="0.0001"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Note"
            class="col-span-2"
          >
            <UInput
              v-model="note"
              placeholder="Optional"
              class="w-full"
            />
          </UFormField>
        </div>

        <p class="text-sm text-muted">
          <span v-if="rateLoading">Fetching rate…</span>
          <span v-else-if="homeEquivalent !== null">
            ≈ {{ formatMoney(homeEquivalent, 'JPY') }}
            <span v-if="currency !== 'JPY'">at {{ effectiveRate }} JPY per {{ currency }}</span>
          </span>
          <span
            v-else
            class="text-warning"
          >Enter an exchange rate to see the JPY equivalent.</span>
        </p>

        <div>
          <p class="text-sm font-medium mb-2">
            Receipts
          </p>
          <ExpenseReceiptUploader
            ref="uploader"
            :expense-id="expense?.id"
          />
        </div>
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
          :label="expense ? 'Save changes' : 'Add expense'"
          :loading="saving"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
