<script setup lang="ts">
import { countryName } from '#shared/domain/currencies'
import { formatMoney } from '#shared/domain/money'
import { can } from '#shared/domain/rbac'

useSeoMeta({ title: 'Trips' })

const { user } = useUserSession()
const seesEveryone = computed(() => !!user.value && can(user.value.role, 'any_trips'))

// Superadmins can narrow the all-users view to one owner.
const ownerFilter = ref<string | undefined>(undefined)

const { data: trips, status } = await useFetch('/api/trips', {
  query: { userId: ownerFilter },
  default: () => []
})

const { data: owners, execute: loadOwners } = await useFetch('/api/users', {
  immediate: false,
  default: () => [] as { id: string, displayName: string, email: string }[]
})

onMounted(() => {
  if (seesEveryone.value) loadOwners()
})

const ownerItems = computed(() => [
  { label: 'All users', value: undefined as string | undefined },
  ...owners.value.map(o => ({ label: `${o.displayName} (${o.email})`, value: o.id as string | undefined }))
])

function dateRange(start: string, end: string) {
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
}
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-3 sm:space-y-0 sm:flex sm:items-start sm:justify-between sm:gap-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h1 class="text-xl sm:text-2xl font-semibold tracking-tight">
            Trips
          </h1>
          <p class="text-muted text-sm">
            {{ seesEveryone ? 'Every trip across all users.' : 'Your business trips and their budgets.' }}
          </p>
        </div>
        <!-- Icon-only on mobile; the heading already says what this page is. -->
        <UButton
          to="/trips/new"
          icon="i-lucide-plus"
          aria-label="New trip"
          class="sm:hidden shrink-0"
        />
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <USelectMenu
          v-if="seesEveryone"
          v-model="ownerFilter"
          :items="ownerItems"
          value-key="value"
          placeholder="All users"
          class="w-full sm:w-56"
        />
        <UButton
          to="/trips/new"
          label="New trip"
          icon="i-lucide-plus"
          class="hidden sm:inline-flex"
        />
      </div>
    </div>

    <div
      v-if="status === 'pending'"
      class="space-y-3"
    >
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-24 w-full" />
    </div>

    <UCard v-else-if="!trips.length">
      <div class="text-center py-10 space-y-3">
        <UIcon
          name="i-lucide-luggage"
          class="size-10 text-muted mx-auto"
        />
        <div>
          <p class="font-medium">
            No trips yet
          </p>
          <p class="text-sm text-muted">
            Create your first trip to start logging expenses.
          </p>
        </div>
        <UButton
          to="/trips/new"
          label="Create your first trip"
          icon="i-lucide-plus"
        />
      </div>
    </UCard>

    <div
      v-else
      class="space-y-3"
    >
      <ULink
        v-for="trip in trips"
        :key="trip.id"
        :to="`/trips/${trip.id}`"
        class="block"
      >
        <UCard
          class="transition-colors hover:border-primary/40"
          :ui="{ body: 'sm:flex sm:items-center sm:gap-6' }"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-medium truncate">{{ trip.name }}</span>
              <UBadge
                v-if="trip.status === 'closed'"
                label="Closed"
                color="neutral"
                variant="subtle"
                size="sm"
              />
              <UBadge
                v-if="trip.isOverBudget"
                label="Over budget"
                color="error"
                variant="subtle"
                size="sm"
              />
            </div>
            <p class="text-sm text-muted">
              {{ countryName(trip.destinationCountry) }} · {{ dateRange(trip.startDate, trip.endDate) }}
            </p>
            <p
              v-if="seesEveryone"
              class="text-xs text-dimmed mt-0.5"
            >
              {{ trip.ownerName }} ({{ trip.ownerEmail }})
            </p>
          </div>

          <!-- Mobile: label left, figures right, separated by a hairline rule. -->
          <div
            class="mt-3 pt-2.5 border-t border-default flex items-baseline justify-between gap-3
                      sm:mt-0 sm:pt-0 sm:border-0 sm:block sm:text-right sm:shrink-0"
          >
            <p class="text-xs text-muted uppercase tracking-wide">
              Budget remaining
            </p>
            <div>
              <p
                class="text-lg font-semibold figure whitespace-nowrap"
                :class="trip.isOverBudget ? 'text-error' : 'text-highlighted'"
              >
                {{ formatMoney(trip.budgetRemaining, 'JPY') }}
              </p>
              <p class="text-xs text-muted figure whitespace-nowrap">
                {{ formatMoney(trip.reimbursableActual, 'JPY') }} of
                {{ formatMoney(trip.reimbursableAllowance, 'JPY') }}
              </p>
            </div>
          </div>
        </UCard>
      </ULink>
    </div>
  </div>
</template>
