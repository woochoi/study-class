import 'server-only'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import type { User } from '../types.ts'
import { SESSION_COOKIE, getUserBySessionToken } from './session.ts'

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  // cookies() resolves during the App Shell prefetch; the DB lookup and its
  // expiry clock must run per request.
  await connection()
  return getUserBySessionToken(token)
}
