import 'server-only'
import { cookies } from 'next/headers'
import type { User } from '../types.ts'
import { SESSION_COOKIE, getUserBySessionToken } from './session.ts'

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  return getUserBySessionToken(token)
}
