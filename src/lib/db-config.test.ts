import test from 'node:test'
import assert from 'node:assert/strict'
import { parse } from 'pg-connection-string'
import { assertTarget, dbHost, normalizeConnectionString, POOL_OPTIONS } from './db-config.ts'

const NEON =
  'postgresql://u:secretpw@ep-cool-1-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
const LOCAL = 'postgresql://studycafe:pw@localhost:5433/my_study_cafe'

test('normalizeConnectionString: require → verify-full, 다른 파라미터 유지', () => {
  const u = new URL(normalizeConnectionString(NEON))
  assert.equal(u.searchParams.get('sslmode'), 'verify-full')
  assert.equal(u.searchParams.get('channel_binding'), 'require')
  assert.equal(u.password, 'secretpw')
})

test('normalizeConnectionString: prefer·verify-ca도 verify-full로', () => {
  for (const m of ['prefer', 'verify-ca']) {
    const u = new URL(normalizeConnectionString(`${LOCAL}?sslmode=${m}`))
    assert.equal(u.searchParams.get('sslmode'), 'verify-full')
  }
})

test('normalizeConnectionString: sslmode 없음·disable·verify-full은 그대로', () => {
  assert.equal(normalizeConnectionString(LOCAL), LOCAL)
  for (const m of ['disable', 'verify-full']) {
    const s = `${LOCAL}?sslmode=${m}`
    assert.equal(normalizeConnectionString(s), s)
  }
})

test('정규화한 Neon 문자열은 pg 경고 없이 ssl 설정이 켜진다', async () => {
  const warnings: string[] = []
  const onWarn = (w: Error) => warnings.push(w.message)
  process.on('warning', onWarn)
  const cfg = parse(normalizeConnectionString(NEON))
  await new Promise((r) => setImmediate(r))
  process.off('warning', onWarn)
  assert.ok(cfg.ssl && typeof cfg.ssl === 'object')
  assert.notEqual((cfg.ssl as { rejectUnauthorized?: boolean }).rejectUnauthorized, false)
  assert.deepEqual(warnings.filter((m) => m.includes('SECURITY WARNING')), [])
})

test('dbHost는 비밀번호를 내보내지 않는다', () => {
  assert.equal(dbHost(NEON), 'ep-cool-1-pooler.ap-southeast-1.aws.neon.tech')
  assert.ok(!dbHost(NEON).includes('secretpw'))
})

test('assertTarget', () => {
  assert.equal(assertTarget(LOCAL, 'local'), 'localhost')
  assert.throws(() => assertTarget(NEON, 'local'), /로컬 명령이 Neon/)
  assert.equal(assertTarget(NEON, 'neon'), 'ep-cool-1-pooler.ap-southeast-1.aws.neon.tech')
  assert.throws(() => assertTarget(LOCAL, 'neon'), /Neon이 아닙니다/)
  assert.throws(
    () => assertTarget('postgresql://u:p@evil-neon.tech.example.com/db', 'neon'),
    /Neon이 아닙니다/,
  )
})

test('POOL_OPTIONS', () => {
  assert.deepEqual(POOL_OPTIONS, { max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 })
})

test('잘못된 연결 문자열 오류에는 비밀값이 담기지 않는다', () => {
  const bad = 'postgresql://u:secretpw@[bad host/db'
  for (const fn of [() => dbHost(bad), () => assertTarget(bad, 'local'), () => assertTarget(bad, 'neon')]) {
    assert.throws(fn, (err: Error) => {
      assert.equal(err.message, 'DATABASE_URL을 해석할 수 없습니다.')
      assert.equal(err.cause, undefined)
      const dump = JSON.stringify(err, Object.getOwnPropertyNames(err)) + String(err)
      assert.ok(!dump.includes('secretpw'))
      assert.ok(!Object.values(err).some((v) => String(v).includes('secretpw')))
      return true
    })
  }
})
