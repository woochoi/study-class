import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseThdCmpLinks } from './parse-thdcmp.ts'

const links = parseThdCmpLinks(
  JSON.parse(readFileSync(new URL('../../../test/fixtures/law-api/thdcmp.json', import.meta.url), 'utf8')),
)

test('thdcmp: law→decree links', () => {
  assert.deepEqual(
    links.find((l) => l.fromKey === '29' && l.toKey === '30'),
    { fromKind: 'law', fromKey: '29', toKind: 'decree', toKey: '30', note: null },
  )
  assert.ok(links.some((l) => l.fromKey === '24의2' && l.toKey === '21의2'))
  assert.equal(links.filter((l) => l.fromKey === '1').length, 0)
})

test('thdcmp: same pair only once', () => {
  const ids = links.map((l) => `${l.fromKey}>${l.toKey}`)
  assert.equal(new Set(ids).size, ids.length)
})
