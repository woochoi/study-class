import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseAdmrulDocument } from './parse-admrul.ts'
import { expandNoticeLinks } from './notice-links.ts'
import type { NoticeLinkRule } from './notice-links.ts'

const notice = parseAdmrulDocument(
  JSON.parse(readFileSync(new URL('../../../test/fixtures/law-api/admrul.json', import.meta.url), 'utf8')),
)
const rules: NoticeLinkRule[] = JSON.parse(
  readFileSync(new URL('../../../db/seed/notice-links.json', import.meta.url), 'utf8'),
)
const links = expandNoticeLinks(rules, notice)
const toKeys = (from: string) => links.filter((l) => l.fromKey === from).map((l) => l.toKey)

test('notice links: 영 30 -> 고시 제2장 (12 articles in order)', () => {
  assert.deepEqual(toKeys('30'), ['3', '4', '5', '6', '6의2', '7', '8', '9', '10', '11', '12', '13'])
})

test('notice links: 영 30의2 -> 14..18', () => {
  assert.deepEqual(toKeys('30의2'), ['14', '15', '16', '17', '18'])
})

test('notice links: 영 21의2 -> 7', () => {
  assert.deepEqual(toKeys('21의2'), ['7'])
})

test('notice links: link shape', () => {
  assert.deepEqual(links[0], { fromKind: 'decree', fromKey: '30', toKind: 'notice', toKey: '3', note: null })
})

test('notice links: missing target throws', () => {
  assert.throws(
    () => expandNoticeLinks([{ decreeKey: '1', noticeChapter: '제9장' }], notice),
    /notice link target missing: /,
  )
  assert.throws(
    () => expandNoticeLinks([{ decreeKey: '1', noticeKeys: ['99'] }], notice),
    /notice link target missing: /,
  )
})
