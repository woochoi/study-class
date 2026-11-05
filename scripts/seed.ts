import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { resolveScriptDb } from './db-target.ts'
import { buildSeedData } from '../src/lib/study/hub-data.ts'
import { saveSeedData } from '../src/lib/study/seed.ts'

const { url, host, target } = resolveScriptDb(process.env)
console.log(`대상 DB: ${host} (${target})`)

const read = async (f: string) =>
  JSON.parse(await readFile(new URL(`../db/seed/${f}`, import.meta.url), 'utf8'))
const data = buildSeedData(await read('hub-law.json'), await read('hub-decree.json'))

const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await saveSeedData(client, data)
  const COUNT_TABLES = [
    'areas', 'units', 'unit_leaves', 'unit_items', 'anchors', 'mnemonics', 'cards', 'history_events',
  ] as const
  for (const t of COUNT_TABLES) {
    // ${t}는 위 COUNT_TABLES 고정 화이트리스트 값이며 입력에서 오지 않는다.
    const r = await client.query(`SELECT count(*) AS n FROM ${t}`)
    console.log(`${t}: ${r.rows[0].n}`)
  }
} finally {
  await client.end()
}
