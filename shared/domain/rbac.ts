export const ROLES = ['superadmin', 'admin', 'user'] as const
export type Role = typeof ROLES[number]

export type Action = 'manage_users' | 'own_trips' | 'any_trips'

const MATRIX: Record<Role, Action[]> = {
  superadmin: ['manage_users', 'own_trips', 'any_trips'],
  admin: ['manage_users'],
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
