import 'server-only'
import { query } from '../db.ts'
import { compareArticleKeys } from '../law/article-key.ts'
import type {
  Anchor, Area, Card, Chapter, HistoryEvent, Mnemonic, Unit, UserProgress,
} from './types.ts'

export type StudyData = {
  areas: Area[]
  anchors: Anchor[]
  mnemonics: Mnemonic[]
  cards: Card[]
  history: HistoryEvent[]
  lawChapters: Chapter[]
  decreeChapters: Chapter[]
}

type ChapterRow = { doc_id: string; label: string | null; title: string | null; key: string; atitle: string }

async function loadChapters(where: string): Promise<{ docId: string | null; chapters: Chapter[] }> {
  const doc = await query<{ id: string }>(
    `SELECT id::text AS id FROM law_documents WHERE ${where} ORDER BY effective_on DESC, id DESC LIMIT 1`,
  )
  if (doc.rows.length === 0) return { docId: null, chapters: [] }
  const docId = doc.rows[0].id
  const chapters = await query<{ id: string; label: string; title: string }>(
    'SELECT id::text AS id, label, title FROM law_chapters WHERE document_id = $1 ORDER BY sort_order',
    [docId],
  )
  const arts = await query<{ chapter_id: string | null; key: string; title: string }>(
    `SELECT chapter_id::text AS chapter_id, article_key AS key, title
       FROM articles WHERE document_id = $1 ORDER BY sort_order`,
    [docId],
  )
  const byChapter = new Map<string, Chapter>()
  const out: Chapter[] = chapters.rows.map((c) => {
    const ch: Chapter = { label: c.label, title: c.title, articles: [] }
    byChapter.set(c.id, ch)
    return ch
  })
  for (const a of arts.rows) {
    if (a.chapter_id === null) continue
    byChapter.get(a.chapter_id)?.articles.push({ key: a.key, title: a.title, isUpcoming: false })
  }
  return { docId, chapters: out }
}

async function loadUpcomingOnly(currentDocId: string | null): Promise<ChapterRow[]> {
  const r = await query<ChapterRow>(
    `SELECT d.id::text AS doc_id, c.label, c.title, a.article_key AS key, a.title AS atitle
       FROM law_documents d
       JOIN articles a ON a.document_id = d.id
       LEFT JOIN law_chapters c ON c.id = a.chapter_id
      WHERE d.kind = 'law' AND d.is_upcoming = true
        AND d.id = (SELECT id FROM law_documents WHERE kind = 'law' AND is_upcoming = true
                     ORDER BY effective_on DESC, id DESC LIMIT 1)
        AND ($1::bigint IS NULL OR NOT EXISTS (
              SELECT 1 FROM articles x WHERE x.document_id = $1::bigint AND x.article_key = a.article_key))
      ORDER BY a.sort_order`,
    [currentDocId],
  )
  return r.rows
}

export async function getStudyData(): Promise<StudyData> {
  const [areaRows, unitRows, leafRows, itemRows, anchorRows, mnemoRows, cardRows, histRows] = await Promise.all([
    query<{ id: string; roman: string; name: string; weight: number }>(
      'SELECT id, roman, name, weight FROM areas ORDER BY sort_order',
    ),
    query<{ id: string; area_id: string; name: string; law_summary: string; decree_summary: string }>(
      'SELECT id, area_id, name, law_summary, decree_summary FROM units ORDER BY sort_order',
    ),
    query<{ unit_id: string; label: string; ref: string }>(
      'SELECT unit_id, label, ref FROM unit_leaves ORDER BY sort_order',
    ),
    query<{ unit_id: string; label: string; law_ref: string; decree_ref: string; is_key: boolean }>(
      'SELECT unit_id, label, law_ref, decree_ref, is_key FROM unit_items ORDER BY sort_order',
    ),
    query<{ article_key: string; label: string; area_id: string; is_new: boolean }>(
      'SELECT article_key, label, area_id, is_new FROM anchors ORDER BY article_key',
    ),
    query<{ area_id: string; title: string; body: string }>(
      'SELECT area_id, title, body FROM mnemonics ORDER BY sort_order',
    ),
    query<{ id: string; area_id: string | null; deck: Card['deck']; front: string; answer: string; extra: string | null }>(
      `SELECT id::text AS id, area_id, deck, front, answer, extra FROM cards ORDER BY deck, sort_order`,
    ),
    query<{ doc_kind: 'law' | 'decree'; date_label: string; title: string; summary: string; article_keys: string[]; is_key: boolean }>(
      'SELECT doc_kind, date_label, title, summary, article_keys, is_key FROM history_events ORDER BY doc_kind, sort_order',
    ),
  ])

  const units = new Map<string, Unit>()
  const areas: Area[] = areaRows.rows.map((a) => ({ id: a.id, roman: a.roman, name: a.name, weight: a.weight, units: [] }))
  const areaById = new Map(areas.map((a) => [a.id, a]))
  for (const u of unitRows.rows) {
    const unit: Unit = {
      id: u.id, name: u.name, lawSummary: u.law_summary, decreeSummary: u.decree_summary, leaves: [], items: [],
    }
    units.set(u.id, unit)
    areaById.get(u.area_id)?.units.push(unit)
  }
  for (const l of leafRows.rows) units.get(l.unit_id)?.leaves.push({ label: l.label, ref: l.ref })
  for (const i of itemRows.rows) {
    units.get(i.unit_id)?.items.push({ label: i.label, lawRef: i.law_ref, decreeRef: i.decree_ref, isKey: i.is_key })
  }

  const law = await loadChapters("kind = 'law' AND is_upcoming = false")
  const decree = await loadChapters("kind = 'decree' AND is_upcoming = false")

  // 시행예정 문서에만 있는 조문을 같은 장 라벨에 끼워 넣는다.
  for (const row of await loadUpcomingOnly(law.docId)) {
    let ch = law.chapters.find((c) => c.label === row.label)
    if (!ch) {
      if (row.label === null) continue
      ch = { label: row.label, title: row.title ?? '', articles: [] }
      law.chapters.push(ch)
    }
    ch.articles.push({ key: row.key, title: row.atitle, isUpcoming: true })
    ch.articles.sort((x, y) => compareArticleKeys(x.key, y.key))
  }

  return {
    areas,
    anchors: anchorRows.rows.map((a) => ({ articleKey: a.article_key, label: a.label, areaId: a.area_id, isNew: a.is_new })),
    mnemonics: mnemoRows.rows.map((m) => ({ areaId: m.area_id, title: m.title, body: m.body })),
    cards: cardRows.rows.map((c) => ({ id: c.id, areaId: c.area_id, deck: c.deck, front: c.front, answer: c.answer, extra: c.extra })),
    history: histRows.rows.map((h) => ({
      docKind: h.doc_kind, dateLabel: h.date_label, title: h.title, summary: h.summary,
      articleKeys: h.article_keys, isKey: h.is_key,
    })),
    lawChapters: law.chapters,
    decreeChapters: decree.chapters,
  }
}

export async function getUserProgress(userId: string): Promise<UserProgress> {
  const [reads, levels, settings] = await Promise.all([
    query<{ unit_id: string; reads: number }>('SELECT unit_id, reads FROM user_unit_reads WHERE user_id = $1', [userId]),
    query<{ card_id: string; level: number }>('SELECT card_id::text AS card_id, level FROM user_card_levels WHERE user_id = $1', [userId]),
    query<{ exam_date: string | null }>(
      "SELECT to_char(exam_date, 'YYYY-MM-DD') AS exam_date FROM user_settings WHERE user_id = $1",
      [userId],
    ),
  ])
  return {
    reads: Object.fromEntries(reads.rows.map((r) => [r.unit_id, r.reads])),
    levels: Object.fromEntries(levels.rows.map((r) => [r.card_id, r.level])),
    examDate: settings.rows[0]?.exam_date ?? null,
  }
}
