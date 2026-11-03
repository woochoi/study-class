import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { query, withTransaction, closePool } from './db.ts'

test('query runs a parameterized select', async () => {
  const r = await query<{ n: number }>('SELECT $1::int AS n', [1])
  assert.equal(r.rows[0].n, 1)
})

test('withTransaction rolls back on error', async () => {
  await assert.rejects(
    withTransaction(async (c) => {
      await c.query(
        "INSERT INTO areas (id, roman, name, weight, sort_order) VALUES ('zz','Z','tmp',0,99)",
      )
      throw new Error('boom')
    }),
    /boom/,
  )
  const r = await query("SELECT 1 FROM areas WHERE id = 'zz'")
  assert.equal(r.rowCount, 0)
})

after(closePool)
