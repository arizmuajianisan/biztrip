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
    <header class="no-print border-b border-default bg-default/85 backdrop-blur-md sticky top-0 z-20">
      <div class="max-w-5xl mx-auto px-4 h-14 flex items-center gap-2 sm:gap-6 inset-x-safe">
        <NuxtLink
          to="/"
          class="font-semibold tracking-tight flex items-center gap-2 shrink-0"
        >
          <UIcon
            name="i-lucide-receipt-text"
            class="text-primary size-5"
          />
          <!-- The wordmark is the first thing to go when space is tight. -->
          <span class="hidden sm:inline">Trip Ledger</span>
        </NuxtLink>

        <nav class="flex items-center gap-0.5 text-sm min-w-0">
          <UButton
            v-if="canSeeTrips"
            to="/"
            label="Trips"
            icon="i-lucide-luggage"
            color="neutral"
            variant="ghost"
            size="sm"
          />
          <UButton
            v-if="canManageUsers"
            to="/admin/users"
            label="Users"
            icon="i-lucide-users"
            color="neutral"
            variant="ghost"
            size="sm"
          />
        </nav>

        <div class="ms-auto flex items-center gap-1 shrink-0">
          <UColorModeButton />
          <UDropdownMenu :items="userMenu">
            <UButton
              :label="user?.displayName"
              icon="i-lucide-circle-user"
              color="neutral"
              variant="ghost"
              size="sm"
              trailing-icon="i-lucide-chevron-down"
              :ui="{ label: 'hidden md:inline', trailingIcon: 'hidden md:inline-block' }"
            />
          </UDropdownMenu>
        </div>
      </div>
    </header>

    <div class="flex-1 w-full max-w-5xl mx-auto px-4 py-6 sm:py-8 pb-safe inset-x-safe">
      <slot />
    </div>
  </div>
</template>
