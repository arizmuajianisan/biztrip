<script setup lang="ts">
import { ROLE_LABELS, ROLES, can, type Role } from '#shared/domain/rbac'

useSeoMeta({ title: 'Users' })

interface ManagedUser {
  id: string
  email: string
  displayName: string
  role: Role
  isActive: boolean
  createdAt: string
}

const { user: actor } = useUserSession()
const { data: users, refresh, status } = await useFetch<ManagedUser[]>('/api/users', { default: () => [] })

// An admin can only ever create or manage plain users.
const assignableRoles = computed(() =>
  (actor.value && can(actor.value.role, 'any_trips') ? ROLES : ['user'] as const)
    .map(value => ({ label: ROLE_LABELS[value as Role], value: value as Role })))

const canChangeRole = computed(() => !!actor.value && can(actor.value.role, 'any_trips'))

const createOpen = ref(false)
const editing = ref<ManagedUser | null>(null)
const passwordFor = ref<ManagedUser | null>(null)
const error = ref<string | null>(null)
const busy = ref(false)

const draft = reactive({ email: '', displayName: '', role: 'user' as Role, password: '' })
const editDraft = reactive({ displayName: '', role: 'user' as Role })
const newPassword = ref('')

function openCreate() {
  Object.assign(draft, { email: '', displayName: '', role: 'user' as Role, password: '' })
  error.value = null
  createOpen.value = true
}

function openEdit(target: ManagedUser) {
  editing.value = target
  Object.assign(editDraft, { displayName: target.displayName, role: target.role })
  error.value = null
}

function message(e: unknown) {
  return (e as { data?: { statusMessage?: string } }).data?.statusMessage ?? 'Something went wrong.'
}

async function create() {
  error.value = null
  busy.value = true
  try {
    await $fetch('/api/users', { method: 'POST', body: { ...draft } })
    createOpen.value = false
    await refresh()
  } catch (e) {
    error.value = message(e)
  } finally {
    busy.value = false
  }
}

async function saveEdit() {
  if (!editing.value) return
  error.value = null
  busy.value = true
  try {
    await $fetch(`/api/users/${editing.value.id}`, {
      method: 'PATCH',
      body: {
        displayName: editDraft.displayName,
        role: canChangeRole.value ? editDraft.role : undefined
      }
    })
    editing.value = null
    await refresh()
  } catch (e) {
    error.value = message(e)
  } finally {
    busy.value = false
  }
}

async function toggleActive(target: ManagedUser) {
  error.value = null
  try {
    await $fetch(`/api/users/${target.id}`, { method: 'PATCH', body: { isActive: !target.isActive } })
    await refresh()
  } catch (e) {
    error.value = message(e)
  }
}

async function resetPassword() {
  if (!passwordFor.value) return
  error.value = null
  busy.value = true
  try {
    await $fetch(`/api/users/${passwordFor.value.id}`, {
      method: 'PATCH',
      body: { password: newPassword.value }
    })
    passwordFor.value = null
    newPassword.value = ''
  } catch (e) {
    error.value = message(e)
  } finally {
    busy.value = false
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          Users
        </h1>
        <p class="text-muted text-sm">
          Accounts that can sign in to Trip Ledger.
        </p>
      </div>
      <UButton
        label="New user"
        icon="i-lucide-user-plus"
        @click="openCreate"
      />
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :description="error"
    />

    <UCard v-if="status === 'pending'">
      <USkeleton class="h-32 w-full" />
    </UCard>

    <UCard
      v-else
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <ul class="divide-y divide-default">
        <li
          v-for="row in users"
          :key="row.id"
          class="p-4 flex items-center gap-3 flex-wrap"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-medium truncate">{{ row.displayName }}</span>
              <UBadge
                :label="ROLE_LABELS[row.role]"
                :color="row.role === 'user' ? 'neutral' : 'primary'"
                variant="subtle"
                size="sm"
              />
              <UBadge
                v-if="!row.isActive"
                label="Deactivated"
                color="warning"
                variant="subtle"
                size="sm"
              />
            </div>
            <p class="text-sm text-muted truncate">
              {{ row.email }} · added {{ formatDate(row.createdAt) }}
            </p>
          </div>

          <div class="flex items-center gap-1">
            <UButton
              label="Edit"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="openEdit(row)"
            />
            <UButton
              label="Reset password"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="passwordFor = row; newPassword = ''"
            />
            <UButton
              :label="row.isActive ? 'Deactivate' : 'Activate'"
              :color="row.isActive ? 'neutral' : 'primary'"
              variant="ghost"
              size="xs"
              :disabled="row.id === actor?.id"
              @click="toggleActive(row)"
            />
          </div>
        </li>
      </ul>
    </UCard>

    <UModal
      v-model:open="createOpen"
      title="New user"
    >
      <template #body>
        <div class="space-y-3">
          <UFormField label="Email">
            <UInput
              v-model="draft.email"
              type="email"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Display name">
            <UInput
              v-model="draft.displayName"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Role">
            <USelectMenu
              v-model="draft.role"
              :items="assignableRoles"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Password"
            help="At least 8 characters"
          >
            <UInput
              v-model="draft.password"
              type="password"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="createOpen = false"
          />
          <UButton
            label="Create user"
            :loading="busy"
            @click="create"
          />
        </div>
      </template>
    </UModal>

    <UModal
      :open="!!editing"
      title="Edit user"
      @update:open="editing = null"
    >
      <template #body>
        <div class="space-y-3">
          <UFormField label="Display name">
            <UInput
              v-model="editDraft.displayName"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Role"
            :help="canChangeRole ? undefined : 'Only a superadmin can change roles'"
          >
            <USelectMenu
              v-model="editDraft.role"
              :items="assignableRoles"
              value-key="value"
              :disabled="!canChangeRole || editing?.id === actor?.id"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="editing = null"
          />
          <UButton
            label="Save"
            :loading="busy"
            @click="saveEdit"
          />
        </div>
      </template>
    </UModal>

    <UModal
      :open="!!passwordFor"
      title="Reset password"
      :description="passwordFor?.email"
      @update:open="passwordFor = null"
    >
      <template #body>
        <UFormField
          label="New password"
          help="At least 8 characters"
        >
          <UInput
            v-model="newPassword"
            type="password"
            class="w-full"
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="passwordFor = null"
          />
          <UButton
            label="Set password"
            :loading="busy"
            @click="resetPassword"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
