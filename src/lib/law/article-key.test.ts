import { test } from 'node:test'
import assert from 'node:assert/strict'
import { articleKeyFromParts, compareArticleKeys, formatArticleKey, parseArticleKey } from './article-key.ts'

test('articleKeyFromParts', () => {
  assert.equal(articleKeyFromParts('24', '2'), '24의2')
  assert.equal(articleKeyFromParts('0030', '00'), '30')
  assert.equal(articleKeyFromParts('3', null), '3')
})

test('formatArticleKey', () => {
  assert.equal(formatArticleKey('24의2'), '제24조의2')
  assert.equal(formatArticleKey('3'), '제3조')
})

test('parseArticleKey', () => {
  assert.equal(parseArticleKey('제6조의2(인터넷망의 차단 조치 등) …'), '6의2')
  assert.equal(parseArticleKey('제1장 총칙'), null)
})

test('compareArticleKeys', () => {
  assert.deepEqual(['28의10', '3', '28의2', '28'].sort(compareArticleKeys), ['3', '28', '28의2', '28의10'])
})
