import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeOAuthCookie, decodeOAuthCookie, safeReturnTo } from './oauth-cookie.ts'

test('round-trips', () => {
  const v = { state: 's1', verifier: 'v1', returnTo: '/board?page=2' }
  assert.deepEqual(decodeOAuthCookie(encodeOAuthCookie(v)), v)
})

test('garbage decodes to null', () => {
  assert.equal(decodeOAuthCookie(undefined), null)
  assert.equal(decodeOAuthCookie(''), null)
  assert.equal(decodeOAuthCookie('!!!not-base64!!!'), null)
  assert.equal(decodeOAuthCookie(Buffer.from('{"state":1}').toString('base64url')), null)
  assert.equal(decodeOAuthCookie(Buffer.from('nope').toString('base64url')), null)
})

test('safeReturnTo blocks external urls', () => {
  for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'evil', '', null, '/\t/evil.example', '/\n/evil.example', '/\t\\evil.example',
    '/..//evil.example', '/.//evil.example', '/a/../..//evil.example', '/.%2e//evil.example']) {
    assert.equal(safeReturnTo(bad), '/')
  }
  assert.equal(safeReturnTo('/board?page=2'), '/board?page=2')
  assert.equal(safeReturnTo('/ /x'), '/%20/x')
})
