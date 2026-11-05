import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { resolveScriptDb } from './db-target.ts'

const { url, host, target } = resolveScriptDb(process.env)
console.log(`대상 DB: ${host} (${target})`)

const sql = await readFile(new URL('../db/init.sql', import.meta.url), 'utf8')
const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await client.query(sql)
  console.log('db/init.sql applied')
} finally {
  await client.end()
}
