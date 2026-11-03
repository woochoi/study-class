import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { query, closePool } from '../db.ts'
import { createSession, getUserBySessionToken, deleteSession, hashToken } from './session.ts'

let userId: string

before(async () => {
  const r = await query<{ id: string }>(
    `INSERT INTO users (provider, provider_user_id, email, display_name)
     VALUES ('google', $1, $2, $3) RETURNING id::text AS id`,
    ['test-' + randomUUID(), 'session-test@example.com', 'Session Test'],
  )
  userId = r.rows[0].id
})

after(async () => {
  await query('DELETE FROM users WHERE id = $1', [userId])
  await closePool()
})

test('created session resolves to its user', async () => {
  const { token } = await createSession(userId)
  const user = await getUserBySessionToken(token)
  assert.equal(user?.id, userId)
  assert.equal(user?.provider, 'google')
  assert.equal(user?.displayName, 'Session Test')
  await deleteSession(token)
})

test('only the hash is stored', async () => {
  const { token } = await createSession(userId)
  const r = await query<{ token_hash: string }>(
    'SELECT token_hash FROM sessions WHERE user_id = $1',
    [userId],
  )
  assert.equal(r.rowCount, 1)
  assert.equal(r.rows[0].token_hash, hashToken(token))
  assert.notEqual(r.rows[0].token_hash, token)
  await deleteSession(token)
})

test('expired session returns null and is deleted', async () => {
  const past = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
  const { token } = await createSession(userId, past)
  assert.equal(await getUserBySessionToken(token), null)
  const r = await query('SELECT 1 FROM sessions WHERE token_hash = $1', [hashToken(token)])
  assert.equal(r.rowCount, 0)
})

test('deleteSession removes the row', async () => {
  const { token } = await createSession(userId)
  await deleteSession(token)
  const r = await query('SELECT 1 FROM sessions WHERE token_hash = $1', [hashToken(token)])
  assert.equal(r.rowCount, 0)
  assert.equal(await getUserBySessionToken(token), null)
})

test('unknown token returns null', async () => {
  assert.equal(await getUserBySessionToken('no-such-token'), null)
})
