import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { query, closePool } from '../db.ts'
import { upsertGoogleUser } from '../auth/users.ts'
import { createSession } from '../auth/session.ts'
import type { User } from '../types.ts'

const SQL_PATH = new URL('../../../docs/ops/delete-user.sql', import.meta.url)
const PLACEHOLDER = "'user@example.com'"
const MARK_CHECK = '-- 1)'
const MARK_DELETE = '-- 2)'

const tag = randomUUID().replaceAll('-', '')
const victimEmail = `victim-${tag}@test.invalid`
const otherEmail = `other-${tag}@test.invalid`
const dupEmail = `dup-${tag}@test.invalid`
const subs = ['v', 'o', 'd1', 'd2'].map((s) => `test-${s}-${randomUUID()}`)
let victim: User
let other: User
let dup1: User
let dup2: User

function parts(email: string): { check: string; del: string } {
  const raw = readFileSync(SQL_PATH, 'utf8')
  assert.ok(raw.includes(PLACEHOLDER), 'SQL 파일에 이메일 자리표시자가 있어야 한다')
  const lit = `'${email}'`
  assert.match(email, /^[a-z0-9@.-]+$/)
  const sql = raw.replaceAll(PLACEHOLDER, lit)
  const i1 = sql.indexOf(MARK_CHECK)
  const i2 = sql.indexOf(MARK_DELETE)
  assert.ok(i1 >= 0 && i2 > i1, '-- 1) 와 -- 2) 구분 주석이 순서대로 있어야 한다')
  assert.equal(sql.indexOf(MARK_DELETE, i2 + 1), -1, '-- 2) 는 한 번만')
  return { check: sql.slice(i1, i2), del: sql.slice(i2) }
}

async function runBlock(sql: string): Promise<void> {
  try {
    await query(sql)
  } catch (e) {
    try {
      await query('ROLLBACK')
    } catch {
      // ignore
    }
    throw e
  }
}

async function count(sqlText: string, params: unknown[]): Promise<number> {
  const r = await query<{ n: string }>(sqlText, params)
  return Number(r.rows[0].n)
}

async function mkQuestion(authorId: string, title: string): Promise<string> {
  const r = await query<{ id: string }>(
    'INSERT INTO questions (author_id, title, body) VALUES ($1, $2, $3) RETURNING id::text AS id',
    [authorId, title, 'body'],
  )
  return r.rows[0].id
}

async function mkAnswer(authorId: string, questionId: string): Promise<string> {
  const r = await query<{ id: string }>(
    'INSERT INTO answers (question_id, author_id, body) VALUES ($1, $2, $3) RETURNING id::text AS id',
    [questionId, authorId, 'body'],
  )
  return r.rows[0].id
}

let vQ: string
let oQ: string
let otherAnswerOnVQ: string
let victimAnswerOnOQ: string

before(async () => {
  victim = await upsertGoogleUser({ sub: subs[0], email: victimEmail, name: 'Victim', picture: null })
  other = await upsertGoogleUser({ sub: subs[1], email: otherEmail, name: 'Other', picture: null })
  dup1 = await upsertGoogleUser({ sub: subs[2], email: dupEmail, name: 'Dup1', picture: null })
  dup2 = await upsertGoogleUser({ sub: subs[3], email: dupEmail, name: 'Dup2', picture: null })
  vQ = await mkQuestion(victim.id, 'victim-q')
  oQ = await mkQuestion(other.id, 'other-q')
  otherAnswerOnVQ = await mkAnswer(other.id, vQ)
  victimAnswerOnOQ = await mkAnswer(victim.id, oQ)
  await query('INSERT INTO user_settings (user_id, exam_date) VALUES ($1, $2)', [victim.id, '2027-01-01'])
  await createSession(victim.id)
  await createSession(other.id)
})

after(async () => {
  const ids = [victim, other, dup1, dup2].filter(Boolean).map((u) => u.id)
  await query('DELETE FROM answers WHERE author_id = ANY($1::bigint[])', [ids])
  await query('DELETE FROM questions WHERE author_id = ANY($1::bigint[])', [ids])
  await query("DELETE FROM users WHERE provider = 'google' AND provider_user_id = ANY($1::text[])", [subs])
  await closePool()
})

test('확인 조회는 대상 사용자 1행과 건수를 돌려준다', async () => {
  const { check } = parts(victimEmail)
  const r = await query(check)
  assert.equal(r.rows.length, 1)
  const row = r.rows[0] as Record<string, unknown>
  assert.equal(String(row.user_id), victim.id)
  assert.equal(row.display_name, 'Victim')
  assert.equal(Number(row.question_count), 1)
  assert.equal(Number(row.answer_count), 1)
  assert.equal(Number(row.user_match_count), 1)
  assert.equal(Number(row.settings_count), 1)
})

test('같은 이메일 사용자가 둘이면 아무것도 지우지 않는다', async () => {
  const { check, del } = parts(dupEmail)
  const r = await query(check)
  assert.ok(r.rows.every((x) => Number((x as Record<string, unknown>).user_match_count) === 2))
  await runBlock(del)
  assert.equal(await count('SELECT count(*) AS n FROM users WHERE id = ANY($1::bigint[])', [[dup1.id, dup2.id]]), 2)
})

test('없는 이메일이면 아무것도 지우지 않고 오류도 없다', async () => {
  const { del } = parts(`nobody-${tag}@test.invalid`)
  await runBlock(del)
  assert.equal(await count('SELECT count(*) AS n FROM users WHERE id = ANY($1::bigint[])', [[victim.id, other.id]]), 2)
})

test('삭제 블록은 대상 사용자의 데이터만 모두 지운다', async () => {
  const { del } = parts(victimEmail)
  await runBlock(del)
  const v = [victim.id]
  assert.equal(await count('SELECT count(*) AS n FROM users WHERE id = $1', v), 0)
  assert.equal(await count('SELECT count(*) AS n FROM sessions WHERE user_id = $1', v), 0)
  assert.equal(await count('SELECT count(*) AS n FROM user_settings WHERE user_id = $1', v), 0)
  assert.equal(await count('SELECT count(*) AS n FROM questions WHERE author_id = $1', v), 0)
  assert.equal(await count('SELECT count(*) AS n FROM answers WHERE author_id = $1', v), 0)
  assert.equal(await count('SELECT count(*) AS n FROM questions WHERE id = $1', [vQ]), 0)
  assert.equal(await count('SELECT count(*) AS n FROM answers WHERE id = $1', [otherAnswerOnVQ]), 0)
  assert.equal(await count('SELECT count(*) AS n FROM answers WHERE id = $1', [victimAnswerOnOQ]), 0)
  assert.equal(await count('SELECT count(*) AS n FROM users WHERE id = $1', [other.id]), 1)
  assert.equal(await count('SELECT count(*) AS n FROM questions WHERE id = $1', [oQ]), 1)
  assert.equal(await count('SELECT count(*) AS n FROM sessions WHERE user_id = $1', [other.id]), 1)
})
