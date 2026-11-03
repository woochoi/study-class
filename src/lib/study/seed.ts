import type pg from 'pg'
import type { SeedData } from './hub-data.ts'

// 한 트랜잭션으로 seed를 저장한다. 호출자가 연결한 client를 받는다 (db.ts/server-only 의존 없음).
export async function saveSeedData(
  client: pg.ClientBase,
  data: SeedData,
): Promise<Record<string, number>> {
  await client.query('BEGIN')
  try {
    for (const a of data.areas) {
      await client.query(
        `INSERT INTO areas (id, roman, name, weight, sort_order) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET roman = EXCLUDED.roman, name = EXCLUDED.name,
           weight = EXCLUDED.weight, sort_order = EXCLUDED.sort_order`,
        [a.id, a.roman, a.name, a.weight, a.sortOrder],
      )
    }
    for (const u of data.units) {
      await client.query(
        `INSERT INTO units (id, area_id, name, law_summary, decree_summary, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET area_id = EXCLUDED.area_id, name = EXCLUDED.name,
           law_summary = EXCLUDED.law_summary, decree_summary = EXCLUDED.decree_summary,
           sort_order = EXCLUDED.sort_order`,
        [u.id, u.areaId, u.name, u.lawSummary, u.decreeSummary, u.sortOrder],
      )
    }
    for (const a of data.anchors) {
      await client.query(
        `INSERT INTO anchors (article_key, label, area_id, is_new) VALUES ($1,$2,$3,$4)
         ON CONFLICT (article_key) DO UPDATE SET label = EXCLUDED.label,
           area_id = EXCLUDED.area_id, is_new = EXCLUDED.is_new`,
        [a.articleKey, a.label, a.areaId, a.isNew],
      )
    }

    // 지우고 다시 넣는 테이블
    const unitIds = data.units.map((u) => u.id)
    await client.query('DELETE FROM unit_leaves WHERE unit_id = ANY($1::text[])', [unitIds])
    await client.query('DELETE FROM unit_items WHERE unit_id = ANY($1::text[])', [unitIds])
    await client.query('DELETE FROM mnemonics')
    await client.query('DELETE FROM history_events')
    for (const l of data.unitLeaves) {
      await client.query(
        'INSERT INTO unit_leaves (unit_id, label, ref, sort_order) VALUES ($1,$2,$3,$4)',
        [l.unitId, l.label, l.ref, l.sortOrder],
      )
    }
    for (const i of data.unitItems) {
      await client.query(
        `INSERT INTO unit_items (unit_id, label, law_ref, decree_ref, is_key, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [i.unitId, i.label, i.lawRef, i.decreeRef, i.isKey, i.sortOrder],
      )
    }
    for (const m of data.mnemonics) {
      await client.query(
        'INSERT INTO mnemonics (area_id, title, body, sort_order) VALUES ($1,$2,$3,$4)',
        [m.areaId, m.title, m.body, m.sortOrder],
      )
    }
    for (const h of data.history) {
      await client.query(
        `INSERT INTO history_events
           (doc_kind, date_label, title, summary, article_keys, is_key, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [h.docKind, h.dateLabel, h.title, h.summary, h.articleKeys, h.isKey, h.sortOrder],
      )
    }

    // cards: (deck, sort_order) upsert로 id 유지, seed에 없는 것은 삭제
    for (const c of data.cards) {
      await client.query(
        `INSERT INTO cards (area_id, deck, front, answer, extra, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (deck, sort_order) DO UPDATE SET area_id = EXCLUDED.area_id,
           front = EXCLUDED.front, answer = EXCLUDED.answer, extra = EXCLUDED.extra`,
        [c.areaId, c.deck, c.front, c.answer, c.extra, c.sortOrder],
      )
    }
    await client.query(
      `DELETE FROM cards c WHERE NOT EXISTS (
         SELECT 1 FROM unnest($1::text[], $2::int[]) AS s(deck, sort_order)
         WHERE s.deck = c.deck AND s.sort_order = c.sort_order)`,
      [data.cards.map((c) => c.deck), data.cards.map((c) => c.sortOrder)],
    )

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  }

  return {
    areas: data.areas.length,
    units: data.units.length,
    unit_leaves: data.unitLeaves.length,
    unit_items: data.unitItems.length,
    anchors: data.anchors.length,
    mnemonics: data.mnemonics.length,
    cards: data.cards.length,
    history_events: data.history.length,
  }
}
