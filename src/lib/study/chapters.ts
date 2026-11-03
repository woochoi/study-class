import { compareArticleKeys } from '../law/article-key.ts'
import type { Chapter } from './types.ts'

export type UpcomingRow = {
  chapterLabel: string | null
  chapterTitle: string | null
  key: string
  title: string
}

/** 현행 장 목록에 시행예정 문서에만 있는 조문을 isUpcoming:true로 끼워 넣는다. 입력은 변경하지 않는다. */
export function mergeUpcomingArticles(current: Chapter[], upcoming: UpcomingRow[]): Chapter[] {
  const out: Chapter[] = current.map((c) => ({ ...c, articles: c.articles.map((a) => ({ ...a })) }))
  const existing = new Set(out.flatMap((c) => c.articles.map((a) => a.key)))
  const touched = new Set<Chapter>()
  for (const row of upcoming) {
    if (row.chapterLabel === null || existing.has(row.key)) continue
    let ch = out.find((c) => c.label === row.chapterLabel)
    if (!ch) {
      ch = { label: row.chapterLabel, title: row.chapterTitle ?? '', articles: [] }
      out.push(ch)
    }
    ch.articles.push({ key: row.key, title: row.title, isUpcoming: true })
    existing.add(row.key)
    touched.add(ch)
  }
  for (const ch of touched) ch.articles.sort((x, y) => compareArticleKeys(x.key, y.key))
  return out
}
