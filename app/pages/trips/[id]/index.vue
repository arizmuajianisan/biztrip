<script setup lang="ts">
import type { ExpenseCategory } from '../../../../shared/domain/categories'
import { countryName } from '../../../../shared/domain/currencies'

const route = useRoute()
const tripId = computed(() => route.params.id as string)

const { trip, summary, currencies, expenses, status, refresh } = useTrip(tripId)

useSeoMeta({ title: () => trip.value?.name ?? 'Trip' })

interface EditableExpense {
  id: string
  category: ExpenseCategory
  amount: number
  currency: string
  spentAt: string
  note: string | null
}

const formOpen = ref(false)
const editing = ref<EditableExpense | undefined>(undefined)
const closing = ref(false)
const closeOpen = ref(false)

const readonly = computed(() => trip.value?.status === 'closed')

function addExpense() {
  editing.value = undefined
  formOpen.value = true
}

function editExpense(expense: EditableExpense) {
  editing.value = expense
  formOpen.value = true
}

async function closeTrip() {
  closing.value = true
  try {
    await $fetch(`/api/trips/${tripId.value}`, { method: 'PATCH', body: { status: 'closed' } })
    closeOpen.value = false
    await navigateTo(`/trips/${tripId.value}/report`)
  } finally {
    closing.value = false
  }
}

function dateRange(start: string, end: string) {
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
}
</script>

<template>
  <div
    v-if="status === 'pending' && !trip"
    class="space-y-4"
  >
    <USkeleton class="h-8 w-64" />
    <USkeleton class="h-28 w-full" />
  </div>

  <div
    v-else-if="trip && summary"
    class="space-y-6"
  >
    <div>
      <UButton
        to="/"
        label="Trips"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="link"
        class="-ms-3"
      />
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-semibold tracking-tight">
              {{ trip.name }}
            </h1>
            <UBadge
              v-if="readonly"
              label="Closed"
              color="neutral"
              variant="subtle"
            />
          </div>
          <p class="text-muted text-sm">
            {{ countryName(trip.destinationCountry) }} · {{ dateRange(trip.startDate, trip.endDate) }}
          </p>
        </div>

        <div class="flex gap-2">
          <UButton
            :to="`/trips/${trip.id}/report`"
            label="Report"
            icon="i-lucide-file-text"
            color="neutral"
            variant="subtle"
          />
          <UButton
            v-if="!readonly"
            label="Close trip"
            icon="i-lucide-check"
            color="neutral"
            variant="subtle"
            @click="closeOpen = true"
          />
          <UButton
            v-if="!readonly"
            label="Add expense"
            icon="i-lucide-plus"
            @click="addExpense"
          />
        </div>
      </div>
    </div>

    <TripSummaryHeadline
      :summary="summary"
      :advance-currency="trip.temporaryPaymentCurrency"
      :advance-amount="trip.temporaryPaymentAmount"
      :display-currency="trip.defaultCurrency"
    />

    <UCard>
      <template #header>
        <h2 class="font-medium">
          By category
        </h2>
      </template>
      <TripCategoryBars :summary="summary" />
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-medium">
            Expenses
          </h2>
          <UButton
            v-if="!readonly"
            label="Add"
            icon="i-lucide-plus"
            size="xs"
            variant="ghost"
            color="neutral"
            @click="addExpense"
          />
        </div>
      </template>
      <ExpenseList
        :expenses="expenses"
        :readonly="readonly"
        @edit="editExpense"
        @deleted="refresh"
      />
    </UCard>

    <ExpenseForm
      v-model:open="formOpen"
      :trip-id="trip.id"
      :currencies="currencies"
      :default-currency="trip.defaultCurrency"
      :start-date="trip.startDate"
      :end-date="trip.endDate"
      :expense="editing"
      @saved="refresh"
    />

    <UModal
      v-model:open="closeOpen"
      title="Close this trip?"
      description="Closing locks the expenses so the report stays fixed. A superadmin can reopen it."
    >
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="closeOpen = false"
          />
          <UButton
            label="Close trip"
            :loading="closing"
            @click="closeTrip"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
