import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { query } from '../db.ts'
import type { User } from '../types.ts'

export const SESSION_COOKIE = 'sc_session'
export const SESSION_TTL_DAYS = 30

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(
  userId: string,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  await query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [hashToken(token), userId, expiresAt],
  )
  return { token, expiresAt }
}

type UserRow = {
  id: string
  provider: 'google'
  provider_user_id: string
  email: string | null
  display_name: string
  avatar_url: string | null
  expires_at: Date
}

export async function getUserBySessionToken(
  token: string,
  now: Date = new Date(),
): Promise<User | null> {
  const tokenHash = hashToken(token)
  const r = await query<UserRow>(
    `SELECT u.id::text AS id, u.provider, u.provider_user_id, u.email,
            u.display_name, u.avatar_url, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1`,
    [tokenHash],
  )
  const row = r.rows[0]
  if (!row) return null
  if (row.expires_at.getTime() <= now.getTime()) {
    await query('DELETE FROM sessions WHERE token_hash = $1 AND expires_at <= $2', [tokenHash, now])
    return null
  }
  return {
    id: row.id,
    provider: row.provider,
    providerUserId: row.provider_user_id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  }
}

export async function deleteSession(token: string): Promise<void> {
  await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)])
}
