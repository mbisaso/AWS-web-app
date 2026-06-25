import type { UserRole } from '../services/api'

export interface CurrentUser {
  id: number
  name: string
  email: string
  role: UserRole
}

export function useCurrentUser(): { user: CurrentUser | null; isLoading: boolean } {
  return {
    user: { id: 1, name: 'Sarah Kintu', email: 'sarah@awsmonitor.ug', role: 'admin' },
    isLoading: false,
  }
}
