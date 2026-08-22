import { z } from 'zod'
import { ROLES, type Role } from '../../shared/domain/rbac'

export const userCreateSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase()),
  displayName: z.string().trim().min(1).max(120),
  role: z.enum(ROLES),
  password: z.string().min(8).max(200)
})

export const userUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(200).optional()
})

/**
 * Only a superadmin may mint or promote privileged accounts, so an admin cannot
 * escalate itself by creating a superadmin.
 */
export function assertMayAssignRole(actorRole: Role, targetRole: Role) {
  if (targetRole !== 'user' && actorRole !== 'superadmin') {
    throw createError({ statusCode: 403, statusMessage: 'Only a superadmin may assign that role' })
  }
}
