import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { query, closePool } from '../db.ts'
import { upsertGoogleUser } from '../auth/users.ts'
import type { User } from '../types.ts'
import { createQuestion, deleteQuestion, getQuestion } from './questions-db.ts'
import { createAnswer, deleteAnswer, getAnswer, updateAnswer } from './answers-db.ts'

const subA = 'test-' + randomUUID()
const subB = 'test-' + randomUUID()
let alice: User
let bob: User
const made: string[] = []

async function mk(user: User, title: string): Promise<string> {
  const r = await createQuestion(user.id, { title, body: 'b-' + title, tag: null })
  assert.ok(r.ok)
  made.push(r.id)
  return r.id
}

before(async () => {
  alice = await upsertGoogleUser({ sub: subA, email: null, name: 'Alice', picture: null })
  bob = await upsertGoogleUser({ sub: subB, email: null, name: 'Bob', picture: null })
})

after(async () => {
  await query('DELETE FROM answers WHERE author_id = ANY($1::bigint[]) OR question_id = ANY($2::bigint[])', [[alice.id, bob.id], made])
  await query('DELETE FROM questions WHERE author_id = ANY($1::bigint[])', [[alice.id, bob.id]])
  await query("DELETE FROM users WHERE provider = 'google' AND provider_user_id = ANY($1::text[])", [[subA, subB]])
  await closePool()
})

test('answers are listed in creation order with answerCount', async () => {
  const qid = await mk(alice, 'order')
  const a1 = await createAnswer(bob.id, qid, 'first')
  const a2 = await createAnswer(alice.id, qid, 'second')
  assert.ok(a1.ok && a2.ok)
  const q = await getQuestion(qid)
  assert.equal(q?.answerCount, 2)
  assert.deepEqual(q?.answers.map((a) => a.body), ['first', 'second'])
  assert.deepEqual(q?.answers.map((a) => a.id), [a1.id, a2.id])
  const one = await getAnswer(a1.id)
  assert.equal(one?.questionId, qid)
  assert.equal(one?.authorId, bob.id)
  assert.equal(one?.authorName, 'Bob')
  assert.equal(await getAnswer('999999999999'), null)
  assert.equal(await getAnswer('abc'), null)
})

test('cannot answer soft-deleted or missing questions', async () => {
  const qid = await mk(alice, 'soft')
  assert.ok((await createAnswer(bob.id, qid, 'a')).ok)
  assert.deepEqual(await deleteQuestion(alice.id, qid), { ok: true, mode: 'soft' })
  assert.deepEqual(await createAnswer(bob.id, qid, 'late'), { ok: false, reason: 'notfound' })
  assert.deepEqual(await createAnswer(bob.id, '999999999999', 'x'), { ok: false, reason: 'notfound' })
  assert.deepEqual(await createAnswer(bob.id, 'abc', 'x'), { ok: false, reason: 'notfound' })
})

test('others cannot update or delete an answer; unknown id is notfound', async () => {
  const qid = await mk(alice, 'perm')
  const a = await createAnswer(bob.id, qid, 'mine')
  assert.ok(a.ok)
  assert.deepEqual(await updateAnswer(alice.id, a.id, 'hack'), { ok: false, reason: 'forbidden' })
  assert.deepEqual(await deleteAnswer(alice.id, a.id), { ok: false, reason: 'forbidden' })
  assert.equal((await getAnswer(a.id))?.body, 'mine')
  assert.deepEqual(await updateAnswer(bob.id, '999999999999', 'x'), { ok: false, reason: 'notfound' })
  assert.deepEqual(await deleteAnswer(bob.id, '999999999999'), { ok: false, reason: 'notfound' })
  assert.deepEqual(await updateAnswer(bob.id, 'abc', 'x'), { ok: false, reason: 'notfound' })
  assert.deepEqual(await deleteAnswer(bob.id, 'abc'), { ok: false, reason: 'notfound' })
})

test('update changes body and updatedAt; delete returns questionId', async () => {
  const qid = await mk(alice, 'upd')
  const a = await createAnswer(bob.id, qid, 'before')
  assert.ok(a.ok)
  await new Promise((r) => setTimeout(r, 10))
  assert.deepEqual(await updateAnswer(bob.id, a.id, 'after'), { ok: true, id: a.id })
  const got = await getAnswer(a.id)
  assert.equal(got?.body, 'after')
  assert.ok(Date.parse(got!.updatedAt) > Date.parse(got!.createdAt))
  assert.deepEqual(await deleteAnswer(bob.id, a.id), { ok: true, questionId: qid })
  assert.equal(await getAnswer(a.id), null)
})

test('deleting the last answer of a soft-deleted question hides it', async () => {
  const qid = await mk(alice, 'hide')
  const a = await createAnswer(bob.id, qid, 'only')
  assert.ok(a.ok)
  assert.deepEqual(await deleteQuestion(alice.id, qid), { ok: true, mode: 'soft' })
  assert.ok(await getQuestion(qid))
  assert.deepEqual(await deleteAnswer(bob.id, a.id), { ok: true, questionId: qid })
  assert.equal(await getQuestion(qid), null)
})
