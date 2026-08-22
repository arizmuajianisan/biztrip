import { describe, expect, it } from 'vitest'
import { can } from '../shared/domain/rbac'

describe('can', () => {
  it('lets only admin and superadmin manage users', () => {
    expect(can('admin', 'manage_users')).toBe(true)
    expect(can('superadmin', 'manage_users')).toBe(true)
    expect(can('user', 'manage_users')).toBe(false)
  })

  it('lets user and superadmin work with their own trips, but not admin', () => {
    expect(can('user', 'own_trips')).toBe(true)
    expect(can('superadmin', 'own_trips')).toBe(true)
    expect(can('admin', 'own_trips')).toBe(false)
  })

  it('lets only superadmin touch any user\'s trips', () => {
    expect(can('superadmin', 'any_trips')).toBe(true)
    expect(can('admin', 'any_trips')).toBe(false)
    expect(can('user', 'any_trips')).toBe(false)
  })
})
