import type { Role } from '../domain/rbac'

declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    displayName: string
    role: Role
  }
}

export {}
