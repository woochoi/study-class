import 'server-only'
import { query } from '../db.ts'
import type { User } from '../types.ts'
import type { GoogleProfile } from './google.ts'

type UserRow = {
  id: string
  provider: 'google'
  provider_user_id: string
  email: string | null
  display_name: string
  avatar_url: string | null
}

export async function upsertGoogleUser(p: GoogleProfile): Promise<User> {
  const r = await query<UserRow>(
    `INSERT INTO users (provider, provider_user_id, email, display_name, avatar_url)
     VALUES ('google', $1, $2, $3, $4)
     ON CONFLICT (provider, provider_user_id) DO UPDATE
       SET email = EXCLUDED.email,
           display_name = EXCLUDED.display_name,
           avatar_url = EXCLUDED.avatar_url,
           updated_at = now()
     RETURNING id::text AS id, provider, provider_user_id, email, display_name, avatar_url`,
    [p.sub, p.email, p.name, p.picture],
  )
  const row = r.rows[0]
  return {
    id: row.id,
    provider: row.provider,
    providerUserId: row.provider_user_id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  }
}
