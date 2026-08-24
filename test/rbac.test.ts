import { describe, expect, it } from 'vitest'
import { can } from '../shared/domain/rbac'

describe('can', () => {
  it('lets only admin and superadmin manage users', () => {
    expect(can('admin', 'manage_users')).toBe(true)
    expect(can('superadmin', 'manage_users')).toBe(true)
    expect(can('user', 'manage_users')).toBe(false)
  })

  it('lets every role work with their own trips', () => {
    expect(can('user', 'own_trips')).toBe(true)
    expect(can('superadmin', 'own_trips')).toBe(true)
    expect(can('admin', 'own_trips')).toBe(true)
  })

  it('lets admin and superadmin touch any user\'s trips, but not a plain user', () => {
    expect(can('superadmin', 'any_trips')).toBe(true)
    expect(can('admin', 'any_trips')).toBe(true)
    expect(can('user', 'any_trips')).toBe(false)
  })

  it('lets only admin and superadmin edit budgets after setup', () => {
    expect(can('superadmin', 'manage_budgets')).toBe(true)
    expect(can('admin', 'manage_budgets')).toBe(true)
    expect(can('user', 'manage_budgets')).toBe(false)
  })

  it('gives admin the same trip reach as superadmin', () => {
    for (const action of ['own_trips', 'any_trips', 'manage_budgets'] as const) {
      expect(can('admin', action)).toBe(can('superadmin', action))
    }
  })
})
