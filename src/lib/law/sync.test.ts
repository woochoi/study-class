import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { fetchAllLawSources, EXPECTED_PROMULGATION_NOS, type FetchJson } from '../../../scripts/law-sources.ts'
import { saveLawData } from './sync.ts'

const NOS = EXPECTED_PROMULGATION_NOS

async function fixture(name: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(`../../../test/fixtures/law-api/${name}.json`, import.meta.url), 'utf8'))
}

function pick(url: string): string {
  if (url.includes('target=thdCmp')) return 'thdcmp'
  if (url.includes('target=admrul')) return 'admrul'
  if (url.includes('target=eflaw')) return 'law-upcoming'
  if (url.includes('MST=289537')) return 'decree'
  if (url.includes('MST=283839')) return 'law'
  throw new Error(`unexpected url ${url}`)
}

const fakeFetch: FetchJson = async (url) => fixture(pick(url))

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })

async function cleanup() {
  await client.query('DELETE FROM law_documents WHERE promulgation_no = ANY($1)', [NOS])
}

async function articleId(kind: string, key: string, upcoming = false): Promise<number | undefined> {
  const r = await client.query(
    `SELECT a.id FROM articles a JOIN law_documents d ON d.id = a.document_id
     WHERE d.kind = $1 AND d.is_upcoming = $2 AND d.promulgation_no = ANY($4) AND a.article_key = $3`,
    [kind, upcoming, key, NOS],
  )
  return r.rows[0]?.id
}

async function counts() {
  const docs = await client.query('SELECT count(*)::int n FROM law_documents WHERE promulgation_no = ANY($1)', [NOS])
  const arts = await client.query(
    `SELECT count(*)::int n FROM articles a JOIN law_documents d ON d.id = a.document_id WHERE d.promulgation_no = ANY($1)`,
    [NOS],
  )
  const links = await client.query(
    `SELECT count(*)::int n FROM article_links l JOIN articles a ON a.id = l.from_article_id
     JOIN law_documents d ON d.id = a.document_id WHERE d.promulgation_no = ANY($1)`,
    [NOS],
  )
  return { documents: docs.rows[0].n, articles: arts.rows[0].n, links: links.rows[0].n }
}

async function linked(fromId: number | undefined, toId: number | undefined) {
  assert.ok(fromId && toId)
  const r = await client.query('SELECT 1 FROM article_links WHERE from_article_id=$1 AND to_article_id=$2', [fromId, toId])
  return r.rowCount === 1
}

before(async () => {
  await client.connect()
  await cleanup()
})
after(async () => {
  try {
    await cleanup()
  } finally {
    await client.end()
  }
})

test('saves 4 documents, articles and links', async () => {
  const warnings: string[] = []
  const data = await fetchAllLawSources(fakeFetch, 'test-oc', (m) => warnings.push(m))
  assert.deepEqual(warnings, [])
  const res = await saveLawData(client, data, new Date('2026-11-03T00:00:00Z'))
  const c = await counts()
  assert.equal(c.documents, 4)
  assert.equal(res.documents, 4)
  assert.equal(c.articles, res.articles)
  assert.ok(c.links > 0)
  const up = await client.query('SELECT count(*)::int n FROM law_documents WHERE promulgation_no = ANY($1) AND is_upcoming', [NOS])
  assert.equal(up.rows[0].n, 1)
  assert.ok(await linked(await articleId('law', '29'), await articleId('decree', '30')))
  assert.ok(await linked(await articleId('decree', '30'), await articleId('notice', '7')))
})

test('re-running keeps ids and counts', async () => {
  const data = await fetchAllLawSources(fakeFetch, 'test-oc', () => {})
  await saveLawData(client, data, new Date())
  const before = await counts()
  const id = await articleId('law', '29')
  await saveLawData(client, data, new Date())
  assert.deepEqual(await counts(), before)
  assert.equal(await articleId('law', '29'), id)
})

test('fetch failure leaves previous data intact', async () => {
  const data = await fetchAllLawSources(fakeFetch, 'test-oc', () => {})
  await saveLawData(client, data, new Date())
  const before = await counts()
  const body = (await client.query(`SELECT body FROM articles WHERE id = $1`, [await articleId('notice', '7')])).rows[0].body
  const failing: FetchJson = async (url) => {
    if (url.includes('target=admrul')) throw new Error('boom')
    return fakeFetch(url)
  }
  await assert.rejects(() => fetchAllLawSources(failing, 'test-oc', () => {}), /boom/)
  assert.deepEqual(await counts(), before)
  const after = (await client.query(`SELECT body FROM articles WHERE id = $1`, [await articleId('notice', '7')])).rows[0].body
  assert.equal(after, body)
})

test('upcoming-only article 28의12 is stored on the upcoming document', async () => {
  const data = await fetchAllLawSources(fakeFetch, 'test-oc', () => {})
  await saveLawData(client, data, new Date())
  assert.ok(await articleId('law', '28의12', true))
  assert.equal(await articleId('law', '28의12', false), undefined)
})

test('rejects when api says user verification failed', async () => {
  const rejecting: FetchJson = async () => ({ result: '사용자 정보 검증에 실패하였습니다.' })
  await assert.rejects(() => fetchAllLawSources(rejecting, 'x', () => {}), /law api rejected the call/)
})
