import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { buildSeedData } from './hub-data.ts'
import { saveSeedData } from './seed.ts'

const read = (f: string) => JSON.parse(readFileSync(new URL(`../../../db/seed/${f}`, import.meta.url), 'utf8'))
const data = buildSeedData(read('hub-law.json'), read('hub-decree.json'))

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
after(() => client.end())

const count = async (t: string) =>
  Number((await client.query(`SELECT count(*) AS n FROM ${t}`)).rows[0].n)

test('saveSeedData stores all rows and is idempotent; card ids and user levels survive reseed', async () => {
  const counts = await saveSeedData(client, data)
  assert.equal(counts.areas, 5)
  assert.equal(counts.units, 14)
  assert.equal(counts.cards, data.cards.length)
  for (const [t, n] of Object.entries({
    areas: data.areas.length,
    units: data.units.length,
    unit_leaves: data.unitLeaves.length,
    unit_items: data.unitItems.length,
    anchors: data.anchors.length,
    mnemonics: data.mnemonics.length,
    cards: data.cards.length,
    history_events: data.history.length,
  })) {
    assert.equal(await count(t), n, t)
  }

  const u = await client.query<{ id: string }>(
    `INSERT INTO users (provider, provider_user_id, email, display_name)
     VALUES ('google', $1, $2, 'seed test') RETURNING id`,
    [`seed-test-${process.pid}-${Date.now()}`, `seed-test-${process.pid}@example.test`],
  )
  const userId = u.rows[0].id
  try {
    const card = await client.query<{ id: string }>(
      `SELECT id FROM cards WHERE deck = 'law' AND sort_order = 0`,
    )
    const cardId = card.rows[0].id
    await client.query(
      'INSERT INTO user_card_levels (user_id, card_id, level) VALUES ($1, $2, 2)',
      [userId, cardId],
    )
    await saveSeedData(client, data)
    const again = await client.query<{ id: string }>(
      `SELECT id FROM cards WHERE deck = 'law' AND sort_order = 0`,
    )
    assert.equal(again.rows[0].id, cardId)
    const lv = await client.query<{ level: number }>(
      'SELECT level FROM user_card_levels WHERE user_id = $1 AND card_id = $2',
      [userId, cardId],
    )
    assert.equal(lv.rows[0].level, 2)
    assert.equal(await count('cards'), data.cards.length)
    assert.equal(await count('unit_items'), data.unitItems.length)
  } finally {
    await client.query('DELETE FROM users WHERE id = $1', [userId])
  }
})
