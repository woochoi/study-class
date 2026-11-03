import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { query, closePool } from '../db.ts'
import { upsertGoogleUser } from './users.ts'

const sub = 'test-' + randomUUID()

after(async () => {
  await query("DELETE FROM users WHERE provider = 'google' AND provider_user_id = $1", [sub])
  await closePool()
})

test('upsert creates a user', async () => {
  const u = await upsertGoogleUser({ sub, email: 'u@example.com', name: 'First', picture: null })
  assert.equal(u.provider, 'google')
  assert.equal(u.providerUserId, sub)
  assert.equal(u.email, 'u@example.com')
  assert.equal(u.displayName, 'First')
  assert.equal(u.avatarUrl, null)
  assert.match(u.id, /^\d+$/)
})

test('second upsert with same sub updates name and keeps id', async () => {
  const a = await upsertGoogleUser({ sub, email: 'u@example.com', name: 'First', picture: null })
  const b = await upsertGoogleUser({ sub, email: 'u2@example.com', name: 'Second', picture: 'https://p/x' })
  assert.equal(b.id, a.id)
  assert.equal(b.displayName, 'Second')
  assert.equal(b.email, 'u2@example.com')
  assert.equal(b.avatarUrl, 'https://p/x')
  const r = await query<{ n: string }>(
    "SELECT count(*)::text AS n FROM users WHERE provider = 'google' AND provider_user_id = $1",
    [sub],
  )
  assert.equal(r.rows[0].n, '1')
})
