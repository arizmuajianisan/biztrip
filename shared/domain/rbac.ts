export const ROLES = ['superadmin', 'admin', 'user'] as const
export type Role = typeof ROLES[number]

export type Action = 'manage_users' | 'own_trips' | 'any_trips' | 'manage_budgets'

/**
 * `manage_budgets` is deliberately withheld from `user`: a traveller sets the
 * allowances when creating the trip, but from then on the budget is an
 * allocation from above and only admin or superadmin may change it.
 *
 * Admin and superadmin have identical reach over trip data; they differ only in
 * user management, where creating or promoting a privileged account stays
 * superadmin-only (see `assertMayAssignRole`).
 */
const MATRIX: Record<Role, Action[]> = {
  superadmin: ['manage_users', 'own_trips', 'any_trips', 'manage_budgets'],
  admin: ['manage_users', 'own_trips', 'any_trips', 'manage_budgets'],
  user: ['own_trips']
}

export function can(role: Role, action: Action): boolean {
  return MATRIX[role]?.includes(action) ?? false
}

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  user: 'User'
}
