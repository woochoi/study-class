import 'server-only'
import { query } from '../db.ts'
import type { AnswerView, WriteResult } from './questions-db.ts'

const ID = /^\d{1,18}$/

async function whyNotOwned(userId: string, answerId: string): Promise<'forbidden' | 'notfound'> {
  const r = await query<{ author_id: string }>(
    'SELECT author_id::text AS author_id FROM answers WHERE id = $1',
    [answerId],
  )
  const row = r.rows[0]
  if (!row) return 'notfound'
  return row.author_id === userId ? 'notfound' : 'forbidden'
}

export async function createAnswer(userId: string, questionId: string, body: string): Promise<WriteResult> {
  if (!ID.test(questionId)) return { ok: false, reason: 'notfound' }
  try {
    const r = await query<{ id: string }>(
      `INSERT INTO answers (question_id, author_id, body)
       SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM questions WHERE id = $1 AND deleted_at IS NULL)
       RETURNING id::text AS id`,
      [questionId, userId, body],
    )
    if (r.rows.length === 0) return { ok: false, reason: 'notfound' }
    return { ok: true, id: r.rows[0].id }
  } catch (e) {
    if ((e as { code?: string }).code === '23503') return { ok: false, reason: 'notfound' }
    throw e
  }
}

export async function updateAnswer(userId: string, answerId: string, body: string): Promise<WriteResult> {
  if (!ID.test(answerId)) return { ok: false, reason: 'notfound' }
  const r = await query(
    'UPDATE answers SET body = $3, updated_at = now() WHERE id = $1 AND author_id = $2',
    [answerId, userId, body],
  )
  if (r.rowCount === 0) return { ok: false, reason: await whyNotOwned(userId, answerId) }
  return { ok: true, id: answerId }
}

export async function deleteAnswer(
  userId: string,
  answerId: string,
): Promise<{ ok: true; questionId: string } | { ok: false; reason: 'forbidden' | 'notfound' }> {
  if (!ID.test(answerId)) return { ok: false, reason: 'notfound' }
  const r = await query<{ question_id: string }>(
    'DELETE FROM answers WHERE id = $1 AND author_id = $2 RETURNING question_id::text AS question_id',
    [answerId, userId],
  )
  if (r.rows.length === 0) return { ok: false, reason: await whyNotOwned(userId, answerId) }
  return { ok: true, questionId: r.rows[0].question_id }
}

export async function getAnswer(answerId: string): Promise<(AnswerView & { questionId: string }) | null> {
  if (!ID.test(answerId)) return null
  const r = await query<{
    id: string; question_id: string; body: string; author_id: string; author_name: string
    created_at: Date; updated_at: Date
  }>(
    `SELECT an.id::text AS id, an.question_id::text AS question_id, an.body, an.author_id::text AS author_id,
            u.display_name AS author_name, an.created_at, an.updated_at
     FROM answers an JOIN users u ON u.id = an.author_id WHERE an.id = $1`,
    [answerId],
  )
  const a = r.rows[0]
  if (!a) return null
  return {
    id: a.id,
    questionId: a.question_id,
    body: a.body,
    authorId: a.author_id,
    authorName: a.author_name,
    createdAt: new Date(a.created_at).toISOString(),
    updatedAt: new Date(a.updated_at).toISOString(),
  }
}
