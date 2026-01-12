import { login } from '../features/auth'

export type User = {
  id: string
}

export function getUser(): User {
  return { id: '1' }
}
