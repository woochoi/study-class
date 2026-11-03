import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { query, closePool } from '../db.ts'
import { upsertGoogleUser } from '../auth/users.ts'
import type { User } from '../types.ts'
import { getUserProgress } from './queries.ts'
import {
  applyProgressChange, type ProgressChange, resetCardLevels, setCardLevel, setExamDate, setUnitReads,
} from './progress-db.ts'

const sub = 'test-' + randomUUID()
let user: User
let cardA: string
let cardB: string

async function counts(): Promise<string> {
  const r = await query<{ n: string }>(
    `SELECT ((SELECT count(*) FROM user_unit_reads WHERE user_id = $1)
      + (SELECT count(*) FROM user_card_levels WHERE user_id = $1)
      + (SELECT count(*) FROM user_settings WHERE user_id = $1))::text AS n`,
    [user.id],
  )
  return r.rows[0].n
}

before(async () => {
  user = await upsertGoogleUser({ sub, email: null, name: 'Prog', picture: null })
  const c = await query<{ id: string }>('SELECT id::text AS id FROM cards ORDER BY id LIMIT 2')
  assert.equal(c.rows.length, 2, 'seed must contain cards')
  cardA = c.rows[0].id
  cardB = c.rows[1].id
})

after(async () => {
  await query("DELETE FROM users WHERE provider = 'google' AND provider_user_id = $1", [sub])
  await closePool()
})

test('reads round trip and overwrite', async () => {
  await setUnitReads(user.id, 'a1-1', 2)
  assert.equal((await getUserProgress(user.id)).reads['a1-1'], 2)
  await setUnitReads(user.id, 'a1-1', 0)
  assert.equal((await getUserProgress(user.id)).reads['a1-1'], 0)
})

test('card level round trip, overwrite and reset', async () => {
  await setCardLevel(user.id, cardA, 3)
  await setCardLevel(user.id, cardB, 2)
  await setCardLevel(user.id, cardA, 2)
  let p = await getUserProgress(user.id)
  assert.equal(p.levels[cardA], 2)
  assert.equal(p.levels[cardB], 2)
  await resetCardLevels(user.id, [cardA])
  p = await getUserProgress(user.id)
  assert.equal(p.levels[cardA], undefined)
  assert.equal(p.levels[cardB], 2)
  await resetCardLevels(user.id, [])
})

test('exam date round trip, overwrite and clear', async () => {
  assert.equal((await getUserProgress(user.id)).examDate, null)
  await setExamDate(user.id, '2026-11-15')
  assert.equal((await getUserProgress(user.id)).examDate, '2026-11-15')
  await setExamDate(user.id, '2026-12-01')
  assert.equal((await getUserProgress(user.id)).examDate, '2026-12-01')
  await setExamDate(user.id, null)
  assert.equal((await getUserProgress(user.id)).examDate, null)
})

test('low-level setters reject out of range values', async () => {
  await assert.rejects(setUnitReads(user.id, 'a1-1', 4 as 3), /invalid progress value/)
  await assert.rejects(setUnitReads(user.id, 'a1-1', -1 as 0), /invalid progress value/)
  await assert.rejects(setCardLevel(user.id, cardA, 0 as 1), /invalid progress value/)
  await assert.rejects(setCardLevel(user.id, cardA, 4 as 3), /invalid progress value/)
  await assert.rejects(setExamDate(user.id, '2026/11/15'), /invalid progress value/)
})

test('applyProgressChange(null, ...) is auth failure with no writes', async () => {
  const before = await counts()
  const changes: ProgressChange[] = [
    { type: 'reads', unitId: 'a1-1', reads: 1 },
    { type: 'level', cardId: cardA, level: 2 },
    { type: 'reset', cardIds: [cardA] },
    { type: 'exam', date: '2026-11-15' },
  ]
  for (const c of changes) {
    assert.deepEqual(await applyProgressChange(null, c), { ok: false, reason: 'auth' })
  }
  assert.equal(await counts(), before)
})

test('applyProgressChange saves valid changes', async () => {
  assert.deepEqual(await applyProgressChange(user, { type: 'reads', unitId: 'a1-1', reads: 3 }), { ok: true })
  assert.deepEqual(await applyProgressChange(user, { type: 'level', cardId: cardA, level: 3 }), { ok: true })
  assert.deepEqual(await applyProgressChange(user, { type: 'exam', date: '2026-11-15' }), { ok: true })
  const p = await getUserProgress(user.id)
  assert.equal(p.reads['a1-1'], 3)
  assert.equal(p.levels[cardA], 3)
  assert.equal(p.examDate, '2026-11-15')
  assert.deepEqual(await applyProgressChange(user, { type: 'reset', cardIds: [cardA] }), { ok: true })
  assert.equal((await getUserProgress(user.id)).levels[cardA], undefined)
})

test('applyProgressChange returns invalid, never throws', async () => {
  const bad: ProgressChange[] = [
    { type: 'reads', unitId: 'a1-1', reads: 4 },
    { type: 'reads', unitId: 'a1-1', reads: 1.5 },
    { type: 'reads', unitId: 'nope', reads: 1 },
    { type: 'level', cardId: cardA, level: 0 },
    { type: 'level', cardId: '999999999999', level: 1 },
    { type: 'level', cardId: 'abc', level: 1 },
    { type: 'reset', cardIds: ['abc'] },
    { type: 'exam', date: '2026-13-45' },
    { type: 'exam', date: '2026-02-30' },
    { type: 'exam', date: 'tomorrow' },
  ]
  for (const c of bad) {
    assert.deepEqual(await applyProgressChange(user, c), { ok: false, reason: 'invalid' }, JSON.stringify(c))
  }
})

test('malformed inputs are invalid and write nothing', async () => {
  const before = await counts()
  const bad = [
    { type: 'reads', unitId: undefined, reads: 1 },
    { type: 'reads', unitId: null, reads: 1 },
    { type: 'reads', unitId: 5, reads: 1 },
    { type: 'reads', unitId: ['a1-1'], reads: 1 },
    { type: 'reads', unitId: 'a1-1', reads: '2' },
    { type: 'reads', unitId: 'a1-1', reads: null },
    { type: 'level', cardId: undefined, level: 1 },
    { type: 'level', cardId: 5, level: 1 },
    { type: 'level', cardId: cardA, level: '2' },
    { type: 'reset', cardIds: 'abc' },
    { type: 'reset', cardIds: null },
    { type: 'reset', cardIds: [5] },
    { type: 'reset', cardIds: Array.from({ length: 1001 }, () => cardA) },
    { type: 'bogus' },
  ] as unknown as ProgressChange[]
  for (const c of bad) {
    assert.deepEqual(await applyProgressChange(user, c), { ok: false, reason: 'invalid' }, JSON.stringify(c))
  }
  assert.equal(await counts(), before)
})
