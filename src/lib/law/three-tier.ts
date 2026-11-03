import 'server-only'
import { query } from '../db.ts'
import { compareArticleKeys } from './article-key.ts'
import type { DocKind } from './types.ts'

export type ArticleView = {
  id: string
  kind: DocKind
  key: string
  title: string
  body: string | null
  doc: {
    title: string
    promulgationNo: string
    effectiveOn: string
    isUpcoming: boolean
    fetchedAt: string | null
  }
}

export type ThreeTier = {
  entry: ArticleView
  law: ArticleView[]
  decree: ArticleView[]
  notice: ArticleView[]
}

const KINDS: readonly string[] = ['law', 'decree', 'notice']

export function parseArticleParams(kind: string, key: string): { kind: DocKind; key: string } | null {
  if (!KINDS.includes(kind)) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(key)
  } catch {
    return null
  }
  if (!/^\d+(의\d+)?$/.test(decoded)) return null
  return { kind: kind as DocKind, key: decoded }
}

type Row = {
  id: string
  kind: DocKind
  key: string
  title: string
  body: string | null
  doc_title: string
  promulgation_no: string
  effective_on: string
  is_upcoming: boolean
  fetched_at: string | null
}

const SELECT = `
  SELECT a.id::text AS id, d.kind, a.article_key AS key, a.title, a.body,
         d.title AS doc_title, d.promulgation_no,
         to_char(d.effective_on, 'YYYY-MM-DD') AS effective_on, d.is_upcoming,
         to_char(d.fetched_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS fetched_at
    FROM articles a JOIN law_documents d ON d.id = a.document_id`

function toView(r: Row): ArticleView {
  return {
    id: r.id,
    kind: r.kind,
    key: r.key,
    title: r.title,
    body: r.body,
    doc: {
      title: r.doc_title,
      promulgationNo: r.promulgation_no,
      effectiveOn: r.effective_on,
      isUpcoming: r.is_upcoming,
      fetchedAt: r.fetched_at,
    },
  }
}

function sortDedupe(rows: ArticleView[]): ArticleView[] {
  const seen = new Map<string, ArticleView>()
  for (const r of rows) if (!seen.has(r.id)) seen.set(r.id, r)
  return [...seen.values()].sort((a, b) => compareArticleKeys(a.key, b.key))
}

async function linkedTo(ids: string[], dir: 'down' | 'up', kind: DocKind): Promise<ArticleView[]> {
  if (ids.length === 0) return []
  const [self, other] = dir === 'down' ? ['from_article_id', 'to_article_id'] : ['to_article_id', 'from_article_id']
  const res = await query<Row>(
    `${SELECT} JOIN article_links l ON l.${other} = a.id
      WHERE l.${self} = ANY($1::bigint[]) AND d.kind = $2`,
    [ids, kind],
  )
  return sortDedupe(res.rows.map(toView))
}

/** 키에 해당하는 조문: 현행(가장 최근 시행일) 우선, 법률은 시행예정 문서를 대체로 사용. */
async function findEntry(kind: DocKind, key: string): Promise<ArticleView | null> {
  const res = await query<Row>(
    `${SELECT} WHERE d.kind = $1 AND a.article_key = $2
      ORDER BY d.is_upcoming ASC, d.effective_on DESC, d.id DESC LIMIT 1`,
    [kind, key],
  )
  return res.rows[0] ? toView(res.rows[0]) : null
}

export async function getThreeTier(kind: DocKind, key: string): Promise<ThreeTier | null> {
  const entry = await findEntry(kind, key)
  if (!entry) return null
  const ids = [entry.id]
  let law: ArticleView[] = []
  let decree: ArticleView[] = []
  let notice: ArticleView[] = []
  if (kind === 'law') {
    law = [entry]
    decree = await linkedTo(ids, 'down', 'decree')
    notice = await linkedTo(decree.map((d) => d.id), 'down', 'notice')
  } else if (kind === 'decree') {
    decree = [entry]
    law = await linkedTo(ids, 'up', 'law')
    notice = await linkedTo(ids, 'down', 'notice')
  } else {
    notice = [entry]
    decree = await linkedTo(ids, 'up', 'decree')
    law = await linkedTo(decree.map((d) => d.id), 'up', 'law')
  }
  return { entry, law, decree, notice }
}
