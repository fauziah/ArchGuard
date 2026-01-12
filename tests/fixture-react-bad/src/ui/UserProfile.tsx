import React, { useEffect } from 'react'
import { User } from '../domain/user'

export function UserProfile() {
  const users: User[] = []

  for (let i = 0; i < users.length; i++) {
    console.log(users[i])
  }

  useEffect(() => {
    fetch('/api/user')
  }, [])

  return <div>User</div>
}
