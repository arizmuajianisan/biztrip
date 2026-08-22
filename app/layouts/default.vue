<script setup lang="ts">
import { can } from '#shared/domain/rbac'

const { user, clear } = useUserSession()

const canManageUsers = computed(() => !!user.value && can(user.value.role, 'manage_users'))
const canSeeTrips = computed(() => !!user.value && can(user.value.role, 'own_trips'))

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  await navigateTo('/login')
}

const userMenu = computed(() => [[
  {
    label: user.value?.displayName ?? '',
    type: 'label' as const
  }
], [
  {
    label: 'Sign out',
    icon: 'i-lucide-log-out',
    onSelect: logout
  }
]])
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="no-print border-b border-default bg-default sticky top-0 z-10">
      <div class="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
        <NuxtLink
          to="/"
          class="font-semibold tracking-tight flex items-center gap-2"
        >
          <UIcon
            name="i-lucide-receipt-text"
            class="text-primary size-5"
          />
          Trip Ledger
        </NuxtLink>

        <nav class="flex items-center gap-1 text-sm">
          <UButton
            v-if="canSeeTrips"
            to="/"
            label="Trips"
            color="neutral"
            variant="ghost"
            size="sm"
          />
          <UButton
            v-if="canManageUsers"
            to="/admin/users"
            label="Users"
            color="neutral"
            variant="ghost"
            size="sm"
          />
        </nav>

        <div class="ms-auto flex items-center gap-2">
          <UColorModeButton />
          <UDropdownMenu :items="userMenu">
            <UButton
              :label="user?.displayName"
              icon="i-lucide-circle-user"
              color="neutral"
              variant="ghost"
              size="sm"
              trailing-icon="i-lucide-chevron-down"
            />
          </UDropdownMenu>
        </div>
      </div>
    </header>

    <div class="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
      <slot />
    </div>
  </div>
</template>
