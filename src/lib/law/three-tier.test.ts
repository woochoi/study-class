import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { fetchAllLawSources, EXPECTED_PROMULGATION_NOS, type FetchJson } from '../../../scripts/law-sources.ts'
import { closePool } from '../db.ts'
import { saveLawData } from './sync.ts'
import { getThreeTier, parseArticleParams } from './three-tier.ts'

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
const keys = (xs: { key: string }[]) => xs.map((x) => x.key)

before(async () => {
  await client.connect()
  await client.query('DELETE FROM law_documents WHERE promulgation_no = ANY($1)', [NOS])
  const data = await fetchAllLawSources(fakeFetch, 'test-oc', () => {})
  await saveLawData(client, data, new Date('2026-11-03T00:00:00Z'))
})
after(async () => {
  try {
    await client.query('DELETE FROM law_documents WHERE promulgation_no = ANY($1)', [NOS])
  } finally {
    await client.end()
    await closePool()
  }
})

test('parseArticleParams', () => {
  assert.deepEqual(parseArticleParams('law', '24%EC%9D%982'), { kind: 'law', key: '24의2' })
  assert.deepEqual(parseArticleParams('law', '24의2'), { kind: 'law', key: '24의2' })
  assert.equal(parseArticleParams('foo', '1'), null)
  assert.equal(parseArticleParams('law', 'abc'), null)
  assert.equal(parseArticleParams('law', '%E0%A4%A'), null)
})

test('law 29 → decree 30(+30의2) → notice 3..13 (+14..18)', async () => {
  const t = await getThreeTier('law', '29')
  assert.ok(t)
  assert.deepEqual(keys(t.law), ['29'])
  assert.deepEqual(keys(t.decree), ['30', '30의2'])
  assert.deepEqual(keys(t.notice), ['3', '4', '5', '6', '6의2', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18'])
})

test('notice 7 → decree 30, 21의2 and law 29', async () => {
  const t = await getThreeTier('notice', '7')
  assert.ok(t)
  assert.ok(keys(t.decree).includes('30'))
  assert.ok(keys(t.decree).includes('21의2'))
  assert.ok(keys(t.law).includes('29'))
})

test('law 1 has empty lower tiers', async () => {
  const t = await getThreeTier('law', '1')
  assert.ok(t)
  assert.deepEqual(t.decree, [])
  assert.deepEqual(t.notice, [])
})

test('upcoming-only law article', async () => {
  const t = await getThreeTier('law', '28의12')
  assert.ok(t)
  assert.equal(t.law[0].doc.isUpcoming, true)
})

test('missing article → null', async () => {
  assert.equal(await getThreeTier('law', '999'), null)
})
