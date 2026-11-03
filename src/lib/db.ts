import 'server-only'
import pg from 'pg'
import type { PoolClient, QueryResult, QueryResultRow } from 'pg'

let pool: pg.Pool | undefined

function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
    }
    pool = new pg.Pool({ connectionString })
  }
  return pool
}

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params)
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // ignore rollback failure; surface the original error
    }
    throw err
  } finally {
    client.release()
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    const p = pool
    pool = undefined
    await p.end()
  }
}
