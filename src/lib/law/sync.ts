import type pg from 'pg'
import type { DocKind, ParsedDocument, ParsedLink } from './types.ts'

export type SaveResult = { documents: number; articles: number; links: number; skippedLinks: number }

type Loaded = { doc: ParsedDocument; documentId: number; articleIds: Map<string, number> }

export async function saveLawData(
  client: pg.ClientBase,
  data: { docs: ParsedDocument[]; links: ParsedLink[] },
  now: Date,
): Promise<SaveResult> {
  await client.query('BEGIN')
  try {
    const loaded: Loaded[] = []
    let articleCount = 0
    for (const doc of data.docs) {
      const d = await client.query(
        `INSERT INTO law_documents (kind, title, promulgation_no, promulgated_on, effective_on, is_upcoming, source, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'api', $7)
         ON CONFLICT (kind, promulgation_no) DO UPDATE SET
           title = EXCLUDED.title, promulgated_on = EXCLUDED.promulgated_on,
           effective_on = EXCLUDED.effective_on, is_upcoming = EXCLUDED.is_upcoming,
           source = 'api', fetched_at = EXCLUDED.fetched_at
         RETURNING id`,
        [doc.kind, doc.title, doc.promulgationNo, doc.promulgatedOn, doc.effectiveOn, doc.isUpcoming, now],
      )
      const documentId: number = d.rows[0].id

      const chapterIds = new Map<string, number>()
      for (const ch of doc.chapters) {
        const c = await client.query(
          `INSERT INTO law_chapters (document_id, label, title, sort_order) VALUES ($1, $2, $3, $4)
           ON CONFLICT (document_id, label) DO UPDATE SET title = EXCLUDED.title, sort_order = EXCLUDED.sort_order
           RETURNING id`,
          [documentId, ch.label, ch.title, ch.sortOrder],
        )
        chapterIds.set(ch.label, c.rows[0].id)
      }

      for (const a of doc.articles) {
        const chapterId = a.chapterLabel === null ? null : (chapterIds.get(a.chapterLabel) ?? null)
        await client.query(
          `INSERT INTO articles (document_id, chapter_id, article_key, title, body, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (document_id, article_key) DO UPDATE SET
             title = EXCLUDED.title, body = EXCLUDED.body, chapter_id = EXCLUDED.chapter_id, sort_order = EXCLUDED.sort_order`,
          [documentId, chapterId, a.key, a.title, a.body, a.sortOrder],
        )
        articleCount++
      }

      const ids = await client.query('SELECT id, article_key FROM articles WHERE document_id = $1', [documentId])
      const articleIds = new Map<string, number>()
      for (const r of ids.rows) articleIds.set(r.article_key, r.id)
      loaded.push({ doc, documentId, articleIds })
    }

    const resolve = (kind: DocKind, key: string): number | undefined => {
      const candidates = loaded.filter((l) => l.doc.kind === kind)
      // 현행(is_upcoming=false) 문서를 먼저, 없으면 시행예정 문서의 조문
      candidates.sort((x, y) => Number(x.doc.isUpcoming) - Number(y.doc.isUpcoming))
      for (const c of candidates) {
        const id = c.articleIds.get(key)
        if (id !== undefined) return id
      }
      return undefined
    }

    await client.query(
      'DELETE FROM article_links WHERE from_article_id IN (SELECT id FROM articles WHERE document_id = ANY($1::bigint[]))',
      [loaded.map((l) => l.documentId)],
    )

    const from: number[] = []
    const to: number[] = []
    const notes: (string | null)[] = []
    let skipped = 0
    for (const l of data.links) {
      const f = resolve(l.fromKind, l.fromKey)
      const t = resolve(l.toKind, l.toKey)
      if (f === undefined || t === undefined) {
        skipped++
        continue
      }
      from.push(f)
      to.push(t)
      notes.push(l.note)
    }
    let linkCount = 0
    if (from.length > 0) {
      const r = await client.query(
        `INSERT INTO article_links (from_article_id, to_article_id, note)
         SELECT * FROM unnest($1::bigint[], $2::bigint[], $3::text[])
         ON CONFLICT DO NOTHING`,
        [from, to, notes],
      )
      linkCount = r.rowCount ?? 0
    }

    await client.query('COMMIT')
    return { documents: loaded.length, articles: articleCount, links: linkCount, skippedLinks: skipped }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  }
}
