import { can } from '#shared/domain/rbac'

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession()

  if (to.path === '/login') {
    return loggedIn.value ? navigateTo('/') : undefined
  }

  if (!loggedIn.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  const role = user.value!.role

  // Admin and superadmin both reach trip data now, so every signed-in role
  // lands on the trip list; only /admin is gated.
  if (to.path.startsWith('/admin') && !can(role, 'manage_users')) {
    return navigateTo('/')
  }
})
