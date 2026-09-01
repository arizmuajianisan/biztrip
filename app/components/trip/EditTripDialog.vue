<script setup lang="ts">
import { formatMoney } from '#shared/domain/money'

interface TripOwner { id: string, displayName: string, email: string }

const props = defineProps<{
  tripId: string
  name: string
  owner: TripOwner | null
  /** Only a superadmin may reassign; the picker is hidden otherwise. */
  canReassign: boolean
  advanceAmount: number
  advanceCurrency: string
  additionalAmount: number
  /** Closing a trip freezes the cash figures, so they become read-only. */
  locked: boolean
}>()

const emit = defineEmits<{ saved: [] }>()

const open = defineModel<boolean>('open', { required: true })

const name = ref(props.name)
const ownerId = ref<string | undefined>(props.owner?.id)
const advance = ref(props.advanceAmount)
const additional = ref(props.additionalAmount)
const error = ref<string | null>(null)
const saving = ref(false)

const { data: users, execute: loadUsers } = await useFetch('/api/users', {
  immediate: false,
  default: () => [] as { id: string, displayName: string, email: string, role: string, isActive: boolean }[]
})

// Admins cannot own trips and deactivated accounts cannot sign in, so neither
// is a valid destination for a reassignment.
const ownerItems = computed(() => users.value
  .filter(u => u.isActive && (u.role === 'user' || u.role === 'superadmin'))
  .map(u => ({ label: `${u.displayName} (${u.email})`, value: u.id })))

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = props.name
  ownerId.value = props.owner?.id
  advance.value = props.advanceAmount
  additional.value = props.additionalAmount
  error.value = null
  if (props.canReassign && !users.value.length) loadUsers()
}, { immediate: true })

const reassigning = computed(() => props.canReassign && ownerId.value !== props.owner?.id)

async function save() {
  error.value = null
  if (!name.value.trim()) {
    error.value = 'Give the trip a name.'
    return
  }

  saving.value = true
  try {
    await $fetch(`/api/trips/${props.tripId}`, {
      method: 'PATCH',
      body: {
        name: name.value.trim(),
        userId: reassigning.value ? ownerId.value : undefined,
        temporaryPayment: props.locked
          ? undefined
          : { amount: advance.value, currency: props.advanceCurrency },
        additionalPayment: props.locked
          ? undefined
          : { amount: additional.value, currency: props.advanceCurrency }
      }
    })
    open.value = false
    emit('saved')
  } catch (e) {
    error.value = (e as { data?: { statusMessage?: string } }).data?.statusMessage
      ?? 'Could not save the trip.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Edit trip"
    description="Rename the trip, or hand it to a different traveller."
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

        <UFormField label="Trip name">
          <UInput
            v-model="name"
            placeholder="Jakarta site visit"
            class="w-full"
            autofocus
          />
        </UFormField>

        <UFormField
          v-if="canReassign"
          label="Assigned to"
          help="Moves the trip, its expenses and its receipts to another traveller."
        >
          <USelectMenu
            v-model="ownerId"
            :items="ownerItems"
            value-key="value"
            placeholder="Select a traveller"
            class="w-full"
          />
        </UFormField>

        <USeparator />

        <div class="grid grid-cols-2 gap-3">
          <UFormField
            label="Temporary Payment"
            :help="`Cash advance, in ${advanceCurrency}`"
          >
            <UInputNumber
              v-model="advance"
              :min="0"
              :disabled="locked"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Additional payment"
            help="Emergency cash on top"
          >
            <UInputNumber
              v-model="additional"
              :min="0"
              :disabled="locked"
              class="w-full"
            />
          </UFormField>
        </div>

        <p
          v-if="locked"
          class="text-xs text-muted"
        >
          Cash figures are frozen because the trip is closed. Reopen it to change them.
        </p>
        <p
          v-else
          class="text-sm text-muted"
        >
          Total cash held: <span class="figure">{{ formatMoney(advance + additional, advanceCurrency) }}</span>
        </p>

        <UAlert
          v-if="reassigning"
          color="warning"
          variant="subtle"
          icon="i-lucide-user-round-cog"
          title="This trip will change hands"
          description="The current owner will no longer see it in their trip list."
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
          label="Save changes"
          :loading="saving"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
