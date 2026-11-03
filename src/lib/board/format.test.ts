import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatTag, formatBoardTime } from './format.ts'

test('formatTag', () => {
  assert.equal(formatTag({ kind: 'law', key: '29' }), '법 제29조')
  assert.equal(formatTag({ kind: 'decree', key: '30의2' }), '영 제30조의2')
  assert.equal(formatTag({ kind: 'notice', key: '7' }), '고시 제7조')
})
test('formatBoardTime은 서울 시각', () => {
  assert.equal(formatBoardTime('2026-11-03T05:05:00Z'), '2026. 11. 3. 14:05')
  assert.equal(formatBoardTime('2026-12-31T15:30:00Z'), '2027. 1. 1. 00:30')
})
