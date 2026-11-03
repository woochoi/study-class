import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { query, closePool } from '../db.ts'
import { upsertGoogleUser } from '../auth/users.ts'
import type { User } from '../types.ts'
import { PAGE_SIZE } from './validate.ts'
import {
  countQuestionsForTag, createQuestion, deleteQuestion, getQuestion, listQuestions, resolveTag, updateQuestion,
} from './questions-db.ts'

const tagId = randomUUID()
const subA = 'test-' + randomUUID()
const subB = 'test-' + randomUUID()
let alice: User
let bob: User
const docIds: string[] = []
const artIds: Record<string, string> = {}
const made: string[] = []

async function mkDoc(kind: string, upcoming: boolean, keys: string[]): Promise<void> {
  const d = await query<{ id: string }>(
    `INSERT INTO law_documents (kind, title, promulgation_no, effective_on, is_upcoming, source)
     VALUES ($1, 'test-board', $2, '2099-01-01', $3, 'seed') RETURNING id::text AS id`,
    [kind, `test-board-${tagId}-${kind}-${upcoming}`, upcoming],
  )
  docIds.push(d.rows[0].id)
  for (const [i, k] of keys.entries()) {
    const a = await query<{ id: string }>(
      `INSERT INTO articles (document_id, article_key, title, sort_order) VALUES ($1, $2, 't', $3) RETURNING id::text AS id`,
      [d.rows[0].id, k, i],
    )
    artIds[`${kind}/${upcoming ? 'up' : 'cur'}/${k}`] = a.rows[0].id
  }
}

async function mk(user: User, title: string, tag: { kind: 'law' | 'decree'; key: string } | null = null): Promise<string> {
  const r = await createQuestion(user.id, { title, body: 'b-' + title, tag })
  assert.ok(r.ok)
  made.push(r.id)
  return r.id
}

before(async () => {
  alice = await upsertGoogleUser({ sub: subA, email: null, name: 'Alice', picture: null })
  bob = await upsertGoogleUser({ sub: subB, email: null, name: 'Bob', picture: null })
  await mkDoc('law', false, ['901', '902의2'])
  await mkDoc('law', true, ['901', '902의2', '903'])
  await mkDoc('decree', false, ['901'])
})

after(async () => {
  await query('DELETE FROM answers WHERE author_id = ANY($1::bigint[]) OR question_id = ANY($2::bigint[])', [[alice.id, bob.id], made])
  await query('DELETE FROM questions WHERE author_id = ANY($1::bigint[])', [[alice.id, bob.id]])
  await query('DELETE FROM law_documents WHERE id = ANY($1::bigint[])', [docIds])
  await query("DELETE FROM users WHERE provider = 'google' AND provider_user_id = ANY($1::text[])", [[subA, subB]])
  await closePool()
})

test('create → getQuestion round trip with tag', async () => {
  const id = await mk(alice, 'rt', { kind: 'law', key: '901' })
  const q = await getQuestion(id)
  assert.ok(q)
  assert.deepEqual(q.tag, { kind: 'law', key: '901' })
  assert.equal(q.answerCount, 0)
  assert.equal(q.deleted, false)
  assert.equal(q.title, 'rt')
  assert.equal(q.body, 'b-rt')
  assert.equal(q.authorName, 'Alice')
  assert.equal(q.authorId, alice.id)
  assert.deepEqual(q.answers, [])
  assert.ok(!Number.isNaN(Date.parse(q.createdAt)))
  assert.ok(!Number.isNaN(Date.parse(q.updatedAt)))
})

test('resolveTag prefers current document, falls back to upcoming', async () => {
  assert.equal(await resolveTag({ kind: 'law', key: '901' }), artIds['law/cur/901'])
  assert.equal(await resolveTag({ kind: 'law', key: '902의2' }), artIds['law/cur/902의2'])
  assert.equal(await resolveTag({ kind: 'law', key: '903' }), artIds['law/up/903'])
  assert.equal(await resolveTag({ kind: 'decree', key: '901' }), artIds['decree/cur/901'])
  assert.equal(await resolveTag({ kind: 'law', key: '999999' }), null)
  assert.deepEqual(await createQuestion(alice.id, { title: 't', body: 'b', tag: { kind: 'law', key: '999999' } }), { ok: false, reason: 'notag' })
})

test('others cannot update or delete; unknown id is notfound', async () => {
  const id = await mk(alice, 'mine')
  assert.deepEqual(await updateQuestion(bob.id, id, { title: 'x', body: 'y', tag: null }), { ok: false, reason: 'forbidden' })
  assert.deepEqual(await deleteQuestion(bob.id, id), { ok: false, reason: 'forbidden' })
  const q = await getQuestion(id)
  assert.equal(q?.title, 'mine')
  assert.equal(q?.body, 'b-mine')
  assert.deepEqual(await updateQuestion(alice.id, '999999999999', { title: 'x', body: 'y', tag: null }), { ok: false, reason: 'notfound' })
  assert.deepEqual(await deleteQuestion(alice.id, '999999999999'), { ok: false, reason: 'notfound' })
})

test('update changes content and updated_at, can change tag', async () => {
  const id = await mk(alice, 'before', { kind: 'law', key: '901' })
  await new Promise((r) => setTimeout(r, 10))
  const r = await updateQuestion(alice.id, id, { title: 'after', body: 'nb', tag: null })
  assert.deepEqual(r, { ok: true, id })
  const q = await getQuestion(id)
  assert.equal(q?.title, 'after')
  assert.equal(q?.tag, null)
  assert.ok(Date.parse(q!.updatedAt) > Date.parse(q!.createdAt))
  assert.deepEqual(await updateQuestion(alice.id, id, { title: 'a', body: 'b', tag: { kind: 'law', key: '999999' } }), { ok: false, reason: 'notag' })
})

test('delete without answers hard-deletes', async () => {
  const id = await mk(alice, 'gone')
  assert.deepEqual(await deleteQuestion(alice.id, id), { ok: true, mode: 'hard' })
  assert.equal(await getQuestion(id), null)
})

test('delete with answers soft-deletes and keeps answers', async () => {
  const id = await mk(alice, 'soft')
  await query('INSERT INTO answers (question_id, author_id, body) VALUES ($1, $2, $3)', [id, bob.id, 'ans1'])
  assert.deepEqual(await deleteQuestion(alice.id, id), { ok: true, mode: 'soft' })
  const q = await getQuestion(id)
  assert.ok(q)
  assert.equal(q.title, null)
  assert.equal(q.body, null)
  assert.equal(q.deleted, true)
  assert.equal(q.answers.length, 1)
  assert.equal(q.answers[0].body, 'ans1')
  assert.equal(q.answers[0].authorName, 'Bob')
  assert.deepEqual(await updateQuestion(alice.id, id, { title: 'x', body: 'y', tag: null }), { ok: false, reason: 'notfound' })
  assert.deepEqual(await deleteQuestion(alice.id, id), { ok: false, reason: 'notfound' })
  // answers removed -> hidden
  await query('DELETE FROM answers WHERE question_id = $1', [id])
  assert.equal(await getQuestion(id), null)
  const l = await listQuestions({ page: 1, tag: { kind: 'law', key: '901' } })
  assert.ok(!l.items.some((i) => i.id === id))
})

test('list: newest first, answerCount, paging, tag filter, count', async () => {
  const ids: string[] = []
  for (let i = 0; i < PAGE_SIZE + 2; i++) {
    ids.push(await mk(bob, `lst-${i}`, { kind: 'law', key: '902의2' }))
  }
  const other = await mk(bob, 'other-tag', { kind: 'decree', key: '901' })
  const untagged = await mk(bob, 'untagged')
  await query('INSERT INTO answers (question_id, author_id, body) VALUES ($1, $2, $3), ($1, $2, $3)', [ids[0], alice.id, 'a'])

  const total = await countQuestionsForTag({ kind: 'law', key: '902의2' })
  const p1 = await listQuestions({ page: 1, tag: { kind: 'law', key: '902의2' } })
  const p2 = await listQuestions({ page: 2, tag: { kind: 'law', key: '902의2' } })
  assert.equal(p1.total, total)
  assert.equal(p1.items.length, PAGE_SIZE)
  const mine = [...p1.items, ...p2.items].filter((i) => ids.includes(i.id))
  assert.equal(mine.length, ids.length)
  assert.deepEqual(mine.map((i) => i.id), [...ids].reverse())
  assert.ok(p1.items.every((i) => i.tag?.kind === 'law' && i.tag.key === '902의2'))
  assert.equal(mine.find((i) => i.id === ids[0])?.answerCount, 2)
  assert.equal(mine.find((i) => i.id === ids[1])?.answerCount, 0)
  assert.ok(total >= ids.length)

  const all = await listQuestions({ page: 1, tag: null })
  assert.ok(all.total >= ids.length + 2)
  assert.ok(all.items.length <= PAGE_SIZE)
  // newest first overall: untagged was created last by this file
  assert.equal(all.items[0].id, untagged)
  assert.ok(!p1.items.some((i) => i.id === other || i.id === untagged))
})
