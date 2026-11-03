import { readFile } from 'node:fs/promises'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL is not set')
}

const sql = await readFile(new URL('../db/init.sql', import.meta.url), 'utf8')
const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await client.query(sql)
  console.log('db/init.sql applied')
} finally {
  await client.end()
}
