import test from 'node:test'
import assert from 'node:assert/strict'
import { requiredEnv, appUrl } from './env.ts'

function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
  const saved: Record<string, string | undefined> = {}
  for (const k of Object.keys(vars)) saved[k] = process.env[k]
  try {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    fn()
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

test('requiredEnv: 값이 있으면 그대로', () => {
  withEnv({ GOOGLE_CLIENT_ID: 'abc' }, () => assert.equal(requiredEnv('GOOGLE_CLIENT_ID'), 'abc'))
})

test('requiredEnv: 없거나 공백이면 이름이 담긴 오류', () => {
  for (const v of [undefined, '', '  '])
    withEnv({ APP_URL: v }, () =>
      assert.throws(() => requiredEnv('APP_URL'), /APP_URL 환경 변수가 비어 있습니다/),
    )
})

test('appUrl은 끝의 / 를 뗀다', () => {
  withEnv({ APP_URL: 'https://study-class.vercel.app/' }, () =>
    assert.equal(appUrl(), 'https://study-class.vercel.app'),
  )
})
