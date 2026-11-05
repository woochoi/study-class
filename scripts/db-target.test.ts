import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveScriptDb } from './db-target.ts'

const NEON = 'postgresql://u:p@ep-x.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
const LOCAL = 'postgresql://u:p@localhost:5433/my_study_cafe'

test('기본은 local, Neon 주소면 거부', () => {
  assert.equal(resolveScriptDb({ DATABASE_URL: LOCAL }).target, 'local')
  assert.throws(() => resolveScriptDb({ DATABASE_URL: NEON }), /로컬 명령이 Neon/)
})

test('DB_TARGET=neon은 Neon만 허용하고 정규화한다', () => {
  const r = resolveScriptDb({ DATABASE_URL: NEON, DB_TARGET: 'neon' })
  assert.equal(r.host, 'ep-x.ap-southeast-1.aws.neon.tech')
  assert.match(r.url, /sslmode=verify-full/)
  assert.throws(() => resolveScriptDb({ DATABASE_URL: LOCAL, DB_TARGET: 'neon' }), /Neon이 아닙니다/)
})

test('잘못된 DB_TARGET, 빈 DATABASE_URL은 거부', () => {
  assert.throws(() => resolveScriptDb({ DATABASE_URL: LOCAL, DB_TARGET: 'prod' }))
  assert.throws(() => resolveScriptDb({}))
})
