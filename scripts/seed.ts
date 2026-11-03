import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { buildSeedData } from '../src/lib/study/hub-data.ts'
import { saveSeedData } from '../src/lib/study/seed.ts'

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL is not set')
}

const read = async (f: string) =>
  JSON.parse(await readFile(new URL(`../db/seed/${f}`, import.meta.url), 'utf8'))
const data = buildSeedData(await read('hub-law.json'), await read('hub-decree.json'))

const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await saveSeedData(client, data)
  for (const t of [
    'areas', 'units', 'unit_leaves', 'unit_items', 'anchors', 'mnemonics', 'cards', 'history_events',
  ]) {
    const r = await client.query(`SELECT count(*) AS n FROM ${t}`)
    console.log(`${t}: ${r.rows[0].n}`)
  }
} finally {
  await client.end()
}
