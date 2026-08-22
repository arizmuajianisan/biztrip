<script setup lang="ts">
import { EXPENSE_CATEGORIES } from '../../../shared/domain/categories'
import { COUNTRIES, SELECTABLE_CURRENCIES, currencyForCountry } from '../../../shared/domain/currencies'
import { formatMoney, toHome } from '../../../shared/domain/money'
import type { BudgetInput } from '../../../shared/domain/summary'

useSeoMeta({ title: 'New trip' })

const today = new Date().toISOString().slice(0, 10)

const name = ref('')
const destinationCountry = ref('ID')
const defaultCurrency = ref(currencyForCountry('ID')!)
const settlementCurrency = ref('IDR')
const startDate = ref(today)
const endDate = ref(today)
const extraCurrencies = ref<string[]>([])
const budgets = ref<BudgetInput[]>(EXPENSE_CATEGORIES.map(category => ({ category, amount: 0 })))

const advanceAmount = ref(0)
const advanceCurrency = ref('JPY')
const advanceManualRate = ref<number | undefined>(undefined)

const error = ref<string | null>(null)
const submitting = ref(false)

watch(destinationCountry, (code) => {
  const currency = currencyForCountry(code)
  if (currency) defaultCurrency.value = currency
})

const enabledCurrencies = computed(() =>
  [...new Set(['JPY', defaultCurrency.value, settlementCurrency.value, ...extraCurrencies.value])])

// Live JPY equivalent of the advance, using the trip's start date.
const advanceRate = ref<number | null>(1)
const rateUnavailable = ref(false)
const rateLoading = ref(false)

watchEffect(async () => {
  const currency = advanceCurrency.value
  const on = startDate.value
  if (currency === 'JPY') {
    advanceRate.value = 1
    rateUnavailable.value = false
    return
  }
  rateLoading.value = true
  try {
    const result = await $fetch('/api/fx/rate', { query: { from: currency, to: 'JPY', date: on } })
    advanceRate.value = result.rate
    rateUnavailable.value = false
  } catch {
    advanceRate.value = null
    rateUnavailable.value = true
  } finally {
    rateLoading.value = false
  }
})

const effectiveAdvanceRate = computed(() => advanceRate.value ?? advanceManualRate.value ?? null)
const advanceHome = computed(() =>
  effectiveAdvanceRate.value === null ? null : toHome(advanceAmount.value, effectiveAdvanceRate.value))

const countryItems = COUNTRIES.map(c => ({ label: `${c.name} (${c.currency})`, value: c.code }))
const currencyItems = SELECTABLE_CURRENCIES

async function submit() {
  error.value = null
  if (!name.value.trim()) {
    error.value = 'Give the trip a name.'
    return
  }
  if (endDate.value < startDate.value) {
    error.value = 'The end date cannot be before the start date.'
    return
  }
  if (advanceAmount.value > 0 && effectiveAdvanceRate.value === null) {
    error.value = `No exchange rate available for ${advanceCurrency.value}. Enter one manually.`
    return
  }

  submitting.value = true
  try {
    const { id } = await $fetch('/api/trips', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        destinationCountry: destinationCountry.value,
        defaultCurrency: defaultCurrency.value,
        settlementCurrency: settlementCurrency.value,
        startDate: startDate.value,
        endDate: endDate.value,
        currencies: enabledCurrencies.value,
        budgets: budgets.value,
        temporaryPayment: {
          amount: advanceAmount.value,
          currency: advanceCurrency.value,
          fxRate: advanceManualRate.value
        }
      }
    })
    await navigateTo(`/trips/${id}`)
  } catch (e) {
    error.value = (e as { data?: { statusMessage?: string } }).data?.statusMessage
      ?? 'Could not create the trip.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <UButton
        to="/"
        label="Trips"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="link"
        class="-ms-3"
      />
      <h1 class="text-2xl font-semibold tracking-tight">
        New trip
      </h1>
      <p class="text-muted text-sm">
        Set the budget your company allocated and the cash advance you received.
      </p>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :description="error"
    />

    <UCard>
      <template #header>
        <h2 class="font-medium">
          Where and when
        </h2>
      </template>

      <div class="grid sm:grid-cols-2 gap-4">
        <UFormField
          label="Trip name"
          class="sm:col-span-2"
        >
          <UInput
            v-model="name"
            placeholder="Jakarta site visit"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Destination country"
          help="Sets the default currency for expenses"
        >
          <USelectMenu
            v-model="destinationCountry"
            :items="countryItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Default expense currency">
          <USelectMenu
            v-model="defaultCurrency"
            :items="currencyItems"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Start date">
          <UInput
            v-model="startDate"
            type="date"
            class="w-full"
          />
        </UFormField>

        <UFormField label="End date">
          <UInput
            v-model="endDate"
            type="date"
            class="w-full"
          />
        </UFormField>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-medium">
          Currencies you might spend in
        </h2>
      </template>

      <UFormField
        label="Additional currencies"
        :help="`Always available: ${enabledCurrencies.join(', ')}`"
      >
        <USelectMenu
          v-model="extraCurrencies"
          multiple
          :items="currencyItems"
          placeholder="Add a currency"
          class="w-full"
        />
      </UFormField>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-medium">
          Company budget (JPY)
        </h2>
        <p class="text-sm text-muted">
          What finance allocated per category.
        </p>
      </template>

      <TripBudgetForm v-model="budgets" />
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-medium">
          Temporary Payment
        </h2>
        <p class="text-sm text-muted">
          The cash advance handed to you. Anything left over goes back to the company.
        </p>
      </template>

      <div class="grid sm:grid-cols-2 gap-4">
        <UFormField label="Amount">
          <UInputNumber
            v-model="advanceAmount"
            :min="0"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Currency">
          <USelectMenu
            v-model="advanceCurrency"
            :items="currencyItems"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="rateUnavailable"
          label="Exchange rate"
          :help="`JPY per 1 ${advanceCurrency} — no published rate for this currency`"
          class="sm:col-span-2"
        >
          <UInputNumber
            v-model="advanceManualRate"
            :min="0"
            :step="0.0001"
            class="w-full"
          />
        </UFormField>

        <div class="sm:col-span-2 text-sm text-muted">
          <span v-if="rateLoading">Fetching rate…</span>
          <span v-else-if="advanceHome !== null">
            ≈ {{ formatMoney(advanceHome, 'JPY') }}
            <span v-if="advanceCurrency !== 'JPY'">
              at {{ effectiveAdvanceRate }} JPY per {{ advanceCurrency }}
            </span>
          </span>
          <span
            v-else
            class="text-warning"
          >Enter an exchange rate to see the JPY equivalent.</span>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-medium">
          Settlement
        </h2>
        <p class="text-sm text-muted">
          The currency you will actually transfer back to finance.
        </p>
      </template>

      <UFormField label="Settlement currency">
        <USelectMenu
          v-model="settlementCurrency"
          :items="currencyItems"
          class="w-full sm:w-60"
        />
      </UFormField>
    </UCard>

    <div class="flex justify-end gap-2">
      <UButton
        to="/"
        label="Cancel"
        color="neutral"
        variant="ghost"
      />
      <UButton
        label="Create trip"
        :loading="submitting"
        @click="submit"
      />
    </div>
  </div>
</template>
