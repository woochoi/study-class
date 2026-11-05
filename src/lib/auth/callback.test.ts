import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { query, closePool } from '../db.ts'
import { encodeOAuthCookie } from './oauth-cookie.ts'
import { handleGoogleCallback } from './callback.ts'
import type { GoogleProfile } from './google.ts'

const sub = 'test-' + randomUUID()
const profile: GoogleProfile = { sub, email: 'cb@example.com', name: 'CB', picture: null }
const cookie = encodeOAuthCookie({ state: 'st', verifier: 'vf', returnTo: '/board' })
const log = () => {}

async function sessionCount(): Promise<number> {
  const r = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE u.provider = 'google' AND u.provider_user_id = $1`,
    [sub],
  )
  return Number(r.rows[0].n)
}

const ENV_KEYS = ['APP_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] as const
const savedEnv: Record<string, string | undefined> = {}
before(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k]
  process.env.APP_URL = 'http://localhost:3000'
  process.env.GOOGLE_CLIENT_ID = 'test-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
})

after(async () => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
  await query("DELETE FROM users WHERE provider = 'google' AND provider_user_id = $1", [sub])
  await closePool()
})

test('valid callback creates session and redirects to returnTo', async () => {
  const before = await sessionCount()
  const r = await handleGoogleCallback({
    code: 'c', state: 'st', oauthCookie: cookie,
    deps: { exchange: async () => profile, log },
  })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.redirectTo, '/board')
  assert.ok(r.token.length > 20)
  assert.ok(r.expiresAt.getTime() > Date.now())
  assert.equal(await sessionCount(), before + 1)
})

test('state mismatch fails without calling exchange', async () => {
  let called = false
  const r = await handleGoogleCallback({
    code: 'c', state: 'other', oauthCookie: cookie,
    deps: { exchange: async () => { called = true; return profile }, log },
  })
  assert.deepEqual(r, { ok: false, redirectTo: '/?login_error=1' })
  assert.equal(called, false)
})

test('missing oauth cookie fails', async () => {
  const before = await sessionCount()
  let called = false
  const r = await handleGoogleCallback({
    code: 'c', state: 'st', oauthCookie: undefined,
    deps: { exchange: async () => { called = true; return profile }, log },
  })
  assert.deepEqual(r, { ok: false, redirectTo: '/?login_error=1' })
  assert.equal(called, false)
  assert.equal(await sessionCount(), before)
})

test('exchange throwing (reused code) fails gracefully', async () => {
  const before = await sessionCount()
  const r = await handleGoogleCallback({
    code: 'used', state: 'st', oauthCookie: cookie,
    deps: { exchange: async () => { throw new Error('invalid_grant') }, log },
  })
  assert.deepEqual(r, { ok: false, redirectTo: '/?login_error=1' })
  assert.equal(await sessionCount(), before)
})

test('missing code fails', async () => {
  const before = await sessionCount()
  let called = false
  const r = await handleGoogleCallback({
    code: null, state: 'st', oauthCookie: cookie,
    deps: { exchange: async () => { called = true; return profile }, log },
  })
  assert.deepEqual(r, { ok: false, redirectTo: '/?login_error=1' })
  assert.equal(called, false)
  assert.equal(await sessionCount(), before)
})

test('missing required env fails without calling exchange', async () => {
  const prev = process.env.GOOGLE_CLIENT_ID
  process.env.GOOGLE_CLIENT_ID = ''
  try {
    let called = false
    const logs: string[] = []
    const r = await handleGoogleCallback({
      code: 'c',
      state: 'st',
      oauthCookie: cookie,
      deps: { exchange: async () => { called = true; return profile }, log: (m) => logs.push(m) },
    })
    assert.equal(r.ok, false)
    assert.equal(called, false)
    assert.match(logs[0], /GOOGLE_CLIENT_ID/)
  } finally {
    process.env.GOOGLE_CLIENT_ID = prev
  }
})
