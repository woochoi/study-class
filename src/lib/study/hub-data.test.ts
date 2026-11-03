import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSeedData } from './hub-data.ts'

const read = (f: string) => JSON.parse(readFileSync(new URL(`../../../db/seed/${f}`, import.meta.url), 'utf8'))
const law = read('hub-law.json')
const decree = read('hub-decree.json')
const d = buildSeedData(law, decree)

test('areas: 5, weights sum to 100', () => {
  assert.equal(d.areas.length, 5)
  assert.deepEqual(d.areas.map((a) => a.id), ['a1', 'a2', 'a3', 'a4', 'a5'])
  assert.equal(d.areas.reduce((s, a) => s + a.weight, 0), 100)
  assert.deepEqual(d.areas.map((a) => a.sortOrder), [0, 1, 2, 3, 4])
})

test('units mirror hub subs', () => {
  assert.equal(d.units.length, 14)
  const sub = law.AREAS[0].subs[0]
  const u = d.units.find((x) => x.id === 'a1-1')!
  assert.equal(u.areaId, 'a1')
  assert.equal(u.lawSummary, sub.law)
  assert.equal(u.decreeSummary, sub.dec)
})

test('unitLeaves keep hub order', () => {
  const leaves = d.unitLeaves.filter((l) => l.unitId === 'a1-1')
  const src = law.AREAS[0].subs[0].leaves
  assert.deepEqual(leaves.map((l) => [l.label, l.ref]), src)
  assert.deepEqual(leaves.map((l) => l.sortOrder), src.map((_: unknown, i: number) => i))
})

test('unitItems map DOMAINS[di].units[ui] to AREAS[di].subs[ui]', () => {
  for (let di = 0; di < 5; di++) {
    for (let ui = 0; ui < decree.DOMAINS[di].units.length; ui++) {
      const unitId = law.AREAS[di].subs[ui].id
      const items = d.unitItems.filter((x) => x.unitId === unitId)
      const src = decree.DOMAINS[di].units[ui].items
      assert.deepEqual(items.map((x) => x.label), src.map((s: unknown[]) => s[0]))
      assert.deepEqual(items.map((x) => x.isKey), src.map((s: unknown[]) => !!s[3]))
      assert.equal(items[0].lawRef, src[0][1])
      assert.equal(items[0].decreeRef, src[0][2])
    }
  }
  assert.equal(d.unitItems.length, 59)
})

test('cards: three decks with contiguous sort_order', () => {
  const by = (k: string) => d.cards.filter((c) => c.deck === k)
  const lawCards = law.CARDS.filter((c: { concept: boolean }) => !c.concept)
  const conceptCards = law.CARDS.filter((c: { concept: boolean }) => c.concept)
  assert.equal(by('law').length, lawCards.length)
  assert.equal(by('concept').length, conceptCards.length + 59)
  assert.equal(by('decree').length, 126)
  for (const k of ['law', 'concept', 'decree']) {
    assert.deepEqual(by(k).map((c) => c.sortOrder), by(k).map((_, i) => i))
  }
  const l0 = by('law')[0]
  assert.equal(l0.front, lawCards[0].t)
  assert.equal(l0.answer, lawCards[0].n)
  assert.equal(l0.extra, lawCards[0].x || null)
  assert.equal(l0.areaId, lawCards[0].area)
  const c0 = by('concept')[0]
  assert.equal(c0.front, conceptCards[0].t)
  assert.equal(c0.answer, conceptCards[0].x)
  assert.equal(c0.extra, null)
  const ci = by('concept')[conceptCards.length]
  const it = decree.DOMAINS[0].units[0].items[0]
  assert.deepEqual([ci.front, ci.answer, ci.extra, ci.areaId], [it[0], it[1], it[2], 'a1'])
  const dc = by('decree')[0]
  assert.deepEqual([dc.front, dc.answer, dc.extra, dc.areaId], ['제1조', '목적', '제1장 총칙', null])
  assert.ok(by('decree').some((c) => c.front === '제30조'))
  assert.ok(by('decree').some((c) => c.front === '제4조의2'))
})

test('anchors', () => {
  assert.equal(d.anchors.length, 34)
  const a = d.anchors.find((x) => x.articleKey === '24의2')
  assert.ok(a)
  const src = law.ANCHORS.find((x: unknown[]) => x[0] === '24의2')
  assert.equal(a.isNew, !!src[3])
  assert.equal(d.anchors.find((x) => x.articleKey === '2')!.isNew, true)
})

test('mnemonics', () => {
  assert.equal(d.mnemonics.length, law.MNEMO.length)
  assert.deepEqual(
    [d.mnemonics[0].areaId, d.mnemonics[0].title, d.mnemonics[0].body],
    law.MNEMO[0],
  )
})

test('history: law + decree', () => {
  const lawH = d.history.filter((h) => h.docKind === 'law')
  const decH = d.history.filter((h) => h.docKind === 'decree')
  assert.equal(lawH.length, law.HISTORY.length)
  assert.equal(decH.length, decree.TIMELINE.length)
  assert.equal(lawH[0].dateLabel, '2011. 3. 29.')
  assert.deepEqual(lawH[0].articleKeys, ['24', '75'])
  assert.equal(lawH[0].isKey, true)
  assert.equal(decH[0].dateLabel, '2011. 9. 29.')
  assert.equal(decH[0].summary, '')
  assert.deepEqual(decH[0].articleKeys, [])
  assert.deepEqual(decH.map((h) => h.sortOrder), decH.map((_, i) => i))
})
