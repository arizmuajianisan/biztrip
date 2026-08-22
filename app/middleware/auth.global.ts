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

  if (to.path.startsWith('/admin') && !can(role, 'manage_users')) {
    return navigateTo('/')
  }

  // A plain admin has no trip access at all, so user management is their home.
  if (to.path === '/' && !can(role, 'own_trips') && can(role, 'manage_users')) {
    return navigateTo('/admin/users')
  }
})
