import 'server-only'
import { query } from '../db.ts'
import type { DocKind } from '../law/types.ts'
import { PAGE_SIZE } from './validate.ts'

export type Tag = { kind: DocKind; key: string }
export type AnswerView = {
  id: string
  body: string
  authorId: string
  authorName: string
  createdAt: string
  updatedAt: string
}
export type QuestionSummary = {
  id: string
  title: string | null
  authorName: string
  createdAt: string
  tag: Tag | null
  answerCount: number
  deleted: boolean
}
export type QuestionDetail = QuestionSummary & {
  body: string | null
  authorId: string
  updatedAt: string
  answers: AnswerView[]
}
export type WriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'auth' | 'invalid' | 'notag' | 'forbidden' | 'notfound' }

type QuestionInput = { title: string; body: string; tag: Tag | null }

export async function resolveTag(tag: Tag): Promise<string | null> {
  const r = await query<{ id: string }>(
    `SELECT a.id::text AS id FROM articles a JOIN law_documents d ON d.id = a.document_id
     WHERE d.kind = $1 AND a.article_key = $2
     ORDER BY d.is_upcoming, d.id DESC LIMIT 1`,
    [tag.kind, tag.key],
  )
  return r.rows[0]?.id ?? null
}

async function whyNotOwned(userId: string, id: string): Promise<'forbidden' | 'notfound'> {
  const r = await query<{ author_id: string; deleted_at: string | null }>(
    'SELECT author_id::text AS author_id, deleted_at FROM questions WHERE id = $1',
    [id],
  )
  const row = r.rows[0]
  if (!row || row.deleted_at !== null) return 'notfound'
  return row.author_id === userId ? 'notfound' : 'forbidden'
}

export async function createQuestion(userId: string, v: QuestionInput): Promise<WriteResult> {
  let articleId: string | null = null
  if (v.tag) {
    articleId = await resolveTag(v.tag)
    if (articleId === null) return { ok: false, reason: 'notag' }
  }
  const r = await query<{ id: string }>(
    'INSERT INTO questions (author_id, article_id, title, body) VALUES ($1, $2, $3, $4) RETURNING id::text AS id',
    [userId, articleId, v.title, v.body],
  )
  return { ok: true, id: r.rows[0].id }
}

export async function updateQuestion(userId: string, id: string, v: QuestionInput): Promise<WriteResult> {
  let articleId: string | null = null
  if (v.tag) {
    articleId = await resolveTag(v.tag)
    if (articleId === null) return { ok: false, reason: 'notag' }
  }
  const r = await query(
    `UPDATE questions SET title = $3, body = $4, article_id = $5, updated_at = now()
     WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL`,
    [id, userId, v.title, v.body, articleId],
  )
  if (r.rowCount === 0) return { ok: false, reason: await whyNotOwned(userId, id) }
  return { ok: true, id }
}

export async function deleteQuestion(
  userId: string,
  id: string,
): Promise<{ ok: true; mode: 'hard' | 'soft' } | { ok: false; reason: 'forbidden' | 'notfound' }> {
  const hard = await query(
    `DELETE FROM questions WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM answers WHERE question_id = $1)`,
    [id, userId],
  )
  if (hard.rowCount) return { ok: true, mode: 'hard' }
  const soft = await query(
    'UPDATE questions SET deleted_at = now() WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL',
    [id, userId],
  )
  if (soft.rowCount) return { ok: true, mode: 'soft' }
  return { ok: false, reason: await whyNotOwned(userId, id) }
}

const VISIBLE = '(q.deleted_at IS NULL OR EXISTS (SELECT 1 FROM answers WHERE question_id = q.id))'

type Row = {
  id: string
  title: string
  body: string
  author_id: string
  author_name: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  tag_kind: DocKind | null
  tag_key: string | null
  answer_count: number
}

const SELECT_Q = `
  SELECT q.id::text AS id, q.title, q.body, q.author_id::text AS author_id, u.display_name AS author_name,
         q.created_at, q.updated_at, q.deleted_at, d.kind AS tag_kind, a.article_key AS tag_key,
         (SELECT count(*)::int FROM answers WHERE question_id = q.id) AS answer_count
  FROM questions q
  JOIN users u ON u.id = q.author_id
  LEFT JOIN articles a ON a.id = q.article_id
  LEFT JOIN law_documents d ON d.id = a.document_id`

function summary(r: Row): QuestionSummary {
  const deleted = r.deleted_at !== null
  return {
    id: r.id,
    title: deleted ? null : r.title,
    authorName: r.author_name,
    createdAt: new Date(r.created_at).toISOString(),
    tag: r.tag_kind && r.tag_key ? { kind: r.tag_kind, key: r.tag_key } : null,
    answerCount: r.answer_count,
    deleted,
  }
}

export async function listQuestions(opts: {
  page: number
  tag: Tag | null
}): Promise<{ items: QuestionSummary[]; total: number }> {
  const page = Number.isInteger(opts.page) && opts.page >= 1 ? opts.page : 1
  const kind = opts.tag?.kind ?? null
  const key = opts.tag?.key ?? null
  const filter = `${VISIBLE} AND ($1::text IS NULL OR q.article_id IN (
    SELECT a2.id FROM articles a2 JOIN law_documents d2 ON d2.id = a2.document_id
    WHERE d2.kind = $1 AND a2.article_key = $2))`
  const total = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM questions q WHERE ${filter}`,
    [kind, key],
  )
  const rows = await query<Row>(
    `${SELECT_Q} WHERE ${filter} ORDER BY q.created_at DESC, q.id DESC LIMIT $3 OFFSET $4`,
    [kind, key, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  )
  return { items: rows.rows.map(summary), total: total.rows[0].n }
}

export async function countQuestionsForTag(tag: Tag): Promise<number> {
  const r = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM questions q
     WHERE ${VISIBLE} AND q.article_id IN (
       SELECT a2.id FROM articles a2 JOIN law_documents d2 ON d2.id = a2.document_id
       WHERE d2.kind = $1 AND a2.article_key = $2)`,
    [tag.kind, tag.key],
  )
  return r.rows[0].n
}

export async function getQuestion(id: string): Promise<QuestionDetail | null> {
  if (!/^\d{1,18}$/.test(id)) return null
  const r = await query<Row>(`${SELECT_Q} WHERE q.id = $1 AND ${VISIBLE}`, [id])
  const row = r.rows[0]
  if (!row) return null
  const ans = await query<{
    id: string; body: string; author_id: string; author_name: string; created_at: Date; updated_at: Date
  }>(
    `SELECT an.id::text AS id, an.body, an.author_id::text AS author_id, u.display_name AS author_name,
            an.created_at, an.updated_at
     FROM answers an JOIN users u ON u.id = an.author_id
     WHERE an.question_id = $1 ORDER BY an.created_at, an.id`,
    [id],
  )
  const s = summary(row)
  return {
    ...s,
    body: s.deleted ? null : row.body,
    authorId: row.author_id,
    updatedAt: new Date(row.updated_at).toISOString(),
    answers: ans.rows.map((a) => ({
      id: a.id,
      body: a.body,
      authorId: a.author_id,
      authorName: a.author_name,
      createdAt: new Date(a.created_at).toISOString(),
      updatedAt: new Date(a.updated_at).toISOString(),
    })),
  }
}
