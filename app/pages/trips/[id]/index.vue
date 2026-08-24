<script setup lang="ts">
import type { ExpenseCategory } from '#shared/domain/categories'
import { countryName } from '#shared/domain/currencies'
import { can } from '#shared/domain/rbac'

const route = useRoute()
const tripId = computed(() => route.params.id as string)

const { trip, summary, currencies, owner, expenses, status, refresh } = useTrip(tripId)

useSeoMeta({ title: () => trip.value?.name ?? 'Trip' })

interface EditableExpense {
  id: string
  category: ExpenseCategory
  amount: number
  currency: string
  spentAt: string
  note: string | null
}

const { user } = useUserSession()
const canReassign = computed(() => !!user.value && can(user.value.role, 'any_trips'))

const formOpen = ref(false)
const editing = ref<EditableExpense | undefined>(undefined)
const editTripOpen = ref(false)
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

// Secondary actions collapse into a menu on mobile so the primary action keeps
// its own space instead of three buttons wrapping onto three lines.
const secondaryActions = computed(() => [[
  {
    label: 'Report',
    icon: 'i-lucide-file-text',
    to: `/trips/${tripId.value}/report`
  },
  {
    label: 'Edit trip',
    icon: 'i-lucide-pencil',
    onSelect: () => { editTripOpen.value = true }
  },
  ...(readonly.value
    ? []
    : [{
        label: 'Close trip',
        icon: 'i-lucide-check',
        onSelect: () => { closeOpen.value = true }
      }])
]])

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
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-xl sm:text-2xl font-semibold tracking-tight break-words">
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
          <p
            v-if="canReassign && owner"
            class="text-xs text-dimmed mt-0.5 truncate"
          >
            {{ owner.displayName }} ({{ owner.email }})
          </p>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <!-- Mobile: everything secondary lives behind one menu button. -->
          <UDropdownMenu
            :items="secondaryActions"
            class="sm:hidden"
          >
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="subtle"
              aria-label="Trip actions"
            />
          </UDropdownMenu>

          <div class="hidden sm:flex sm:gap-2">
            <UButton
              :to="`/trips/${trip.id}/report`"
              label="Report"
              icon="i-lucide-file-text"
              color="neutral"
              variant="subtle"
            />
            <UButton
              label="Edit"
              icon="i-lucide-pencil"
              color="neutral"
              variant="subtle"
              @click="editTripOpen = true"
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
            class="hidden sm:inline-flex"
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

    <!--
      Logging an expense is what you open this app to do, usually one-handed
      and standing up. On mobile it gets a fixed, thumb-reachable bar rather
      than a button at the top of a long scroll.
    -->
    <div
      v-if="!readonly"
      class="sm:hidden h-16"
      aria-hidden="true"
    />
    <div
      v-if="!readonly"
      class="no-print sm:hidden fixed bottom-0 inset-x-0 z-20 border-t border-default bg-default/90 backdrop-blur-md px-4 pt-3 pb-safe inset-x-safe"
    >
      <UButton
        label="Add expense"
        icon="i-lucide-plus"
        size="lg"
        block
        @click="addExpense"
      />
    </div>

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

    <TripEditTripDialog
      v-model:open="editTripOpen"
      :trip-id="trip.id"
      :name="trip.name"
      :owner="owner"
      :can-reassign="canReassign"
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
