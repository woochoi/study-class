import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeUpcomingArticles } from './chapters.ts'
import type { Chapter } from './types.ts'

const cur = (): Chapter[] => [
  {
    label: '제1장', title: '총칙',
    articles: [
      { key: '14', title: 'a', isUpcoming: false },
      { key: '15', title: 'b', isUpcoming: false },
    ],
  },
]

test('extra key lands between 14 and 15 flagged upcoming', () => {
  const r = mergeUpcomingArticles(cur(), [{ chapterLabel: '제1장', chapterTitle: '총칙', key: '14의2', title: 'x' }])
  assert.deepEqual(r[0].articles.map((a) => a.key), ['14', '14의2', '15'])
  assert.equal(r[0].articles[1].isUpcoming, true)
})

test('key present in both appears once, not upcoming', () => {
  const r = mergeUpcomingArticles(cur(), [{ chapterLabel: '제1장', chapterTitle: '총칙', key: '15', title: 'b2' }])
  assert.deepEqual(r[0].articles.map((a) => [a.key, a.isUpcoming]), [['14', false], ['15', false]])
})

test('row without chapter label is skipped', () => {
  const r = mergeUpcomingArticles(cur(), [{ chapterLabel: null, chapterTitle: null, key: '99', title: 'x' }])
  assert.equal(r.length, 1)
  assert.equal(r[0].articles.length, 2)
})

test('missing chapter is created at the end', () => {
  const r = mergeUpcomingArticles(cur(), [{ chapterLabel: '제9장', chapterTitle: '신설', key: '90', title: 'x' }])
  assert.equal(r.length, 2)
  assert.deepEqual(r[1], { label: '제9장', title: '신설', articles: [{ key: '90', title: 'x', isUpcoming: true }] })
})

test('inputs are not mutated', () => {
  const c = cur()
  const snapshot = structuredClone(c)
  const rows = [{ chapterLabel: '제1장', chapterTitle: '총칙', key: '14의2', title: 'x' }]
  const r = mergeUpcomingArticles(c, rows)
  assert.deepEqual(c, snapshot)
  assert.notEqual(r[0], c[0])
  assert.notEqual(r[0].articles, c[0].articles)
})
