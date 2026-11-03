import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createPkcePair, buildAuthUrl, exchangeCode } from './google.ts'

const NOW = new Date('2026-11-03T00:00:00Z')
const CLIENT_ID = 'client-id-123'
const CLIENT_SECRET = 'super-secret-value'

function b64(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}

function fakeFetch(payload: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(
      JSON.stringify(status === 200 ? { id_token: 'h.' + b64(payload) + '.s' } : { error: 'bad' }),
      { status },
    )) as typeof fetch
}

function validClaims(extra: Record<string, unknown> = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    exp: Math.floor(NOW.getTime() / 1000) + 3600,
    sub: 'sub-1',
    email: 'a@b.com',
    name: 'Alice',
    picture: 'https://img/x.png',
    ...extra,
  }
}

function exchange(fetchFn: typeof fetch) {
  return exchangeCode({
    code: 'the-code',
    verifier: 'v',
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: 'http://localhost:3000/cb',
    fetchFn,
    now: NOW,
  })
}

test('buildAuthUrl includes pkce and scopes', () => {
  const u = new URL(
    buildAuthUrl({ clientId: 'cid', redirectUri: 'http://localhost:3000/cb', state: 'st', codeChallenge: 'ch' }),
  )
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth')
  assert.equal(u.searchParams.get('response_type'), 'code')
  assert.equal(u.searchParams.get('scope'), 'openid email profile')
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(u.searchParams.get('code_challenge'), 'ch')
  assert.equal(u.searchParams.get('state'), 'st')
  assert.equal(u.searchParams.get('prompt'), 'select_account')
  assert.equal(u.searchParams.get('client_id'), 'cid')
  assert.equal(u.searchParams.get('redirect_uri'), 'http://localhost:3000/cb')
})

test('challenge is sha256 of verifier', () => {
  const { verifier, challenge } = createPkcePair()
  assert.equal(verifier.length, 43)
  assert.match(verifier, /^[A-Za-z0-9_-]+$/)
  assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'))
})

test('exchangeCode returns profile for valid token', async () => {
  const p = await exchange(fakeFetch(validClaims()))
  assert.deepEqual(p, { sub: 'sub-1', email: 'a@b.com', name: 'Alice', picture: 'https://img/x.png' })
})

test('exchangeCode sends form-urlencoded POST to token endpoint', async () => {
  let url = ''
  let init: RequestInit | undefined
  const f = (async (u: string, i: RequestInit) => {
    url = u
    init = i
    return new Response(JSON.stringify({ id_token: 'h.' + b64(validClaims()) + '.s' }), { status: 200 })
  }) as unknown as typeof fetch
  await exchange(f)
  assert.equal(url, 'https://oauth2.googleapis.com/token')
  assert.equal(init?.method, 'POST')
  const body = new URLSearchParams(String(init?.body))
  assert.equal(body.get('grant_type'), 'authorization_code')
  assert.equal(body.get('code'), 'the-code')
  assert.equal(body.get('code_verifier'), 'v')
})

test('exchangeCode rejects wrong aud', async () => {
  await assert.rejects(exchange(fakeFetch(validClaims({ aud: 'other' }))), /invalid id_token/)
})

test('exchangeCode rejects wrong iss', async () => {
  await assert.rejects(exchange(fakeFetch(validClaims({ iss: 'https://evil.example' }))), /invalid id_token/)
})

test('exchangeCode accepts bare accounts.google.com iss', async () => {
  const p = await exchange(fakeFetch(validClaims({ iss: 'accounts.google.com' })))
  assert.equal(p.sub, 'sub-1')
})

test('exchangeCode rejects expired token', async () => {
  const exp = Math.floor(NOW.getTime() / 1000) - 1
  await assert.rejects(exchange(fakeFetch(validClaims({ exp }))), /invalid id_token/)
})

test('exchangeCode rejects malformed id_token', async () => {
  const f = (async () => new Response(JSON.stringify({ id_token: 'abc' }), { status: 200 })) as typeof fetch
  await assert.rejects(exchange(f), /invalid id_token/)
  await assert.rejects(exchange(fakeFetch(validClaims({ sub: undefined }))), /invalid id_token/)
})

test('exchangeCode rejects non-200 token response without leaking secrets', async () => {
  await assert.rejects(exchange(fakeFetch({}, 400)), (e: Error) => {
    assert.ok(!e.message.includes(CLIENT_SECRET))
    assert.ok(!e.message.includes('the-code'))
    return true
  })
})

test('name falls back to email local part', async () => {
  const p = await exchange(fakeFetch(validClaims({ name: undefined, email: 'bob@example.com' })))
  assert.equal(p.name, 'bob')
})

test('name falls back to 스터디원 and empty picture/email become null', async () => {
  const p = await exchange(fakeFetch(validClaims({ name: undefined, email: '', picture: '' })))
  assert.equal(p.name, '스터디원')
  assert.equal(p.email, null)
  assert.equal(p.picture, null)
})
