import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseLawDocument } from './parse-law.ts'

const load = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../test/fixtures/law-api/${name}`, import.meta.url), 'utf8'))
const byKey = (doc: ReturnType<typeof parseLawDocument>, key: string) => doc.articles.find((a) => a.key === key)

test('law: metadata, articles, chapters', () => {
  const doc = parseLawDocument(load('law.json'), { kind: 'law', isUpcoming: false })
  assert.equal(doc.promulgationNo, '법률 제21445호')
  assert.equal(doc.effectiveOn, '2026-09-11')
  assert.equal(doc.promulgatedOn, '2026-03-10')
  assert.equal(doc.isUpcoming, false)
  const keys = doc.articles.map((a) => a.key)
  assert.ok(keys.includes('24의2') && keys.includes('28의2'))
  assert.deepEqual(doc.chapters.find((c) => c.label === '제1장'), { label: '제1장', title: '총칙', sortOrder: 0 })
  assert.equal(doc.chapters.every((c) => /^제\d+장/.test(c.label)), true)
  assert.equal(byKey(doc, '29')?.chapterLabel, '제4장')
  const a3 = byKey(doc, '3')!
  assert.equal(a3.body.split('\n').length, 1 + 8)
  assert.ok(a3.body.startsWith('제3조(개인정보 보호 원칙)'))
  assert.equal(a3.title, '개인정보 보호 원칙')
})

test('decree: 호/목 indentation', () => {
  const doc = parseLawDocument(load('decree.json'), { kind: 'decree', isUpcoming: false })
  const body = byKey(doc, '30')!.body
  assert.ok(body.includes('\n  1. '))
  assert.ok(body.includes('\n    가. '))
  assert.equal(doc.promulgationNo, '대통령령 제36671호')
  assert.equal(doc.kind, 'decree')
})

test('upcoming law: 전문 with same number is not an article', () => {
  const doc = parseLawDocument(load('law-upcoming.json'), { kind: 'law', isUpcoming: true })
  assert.equal(doc.promulgationNo, '법률 제21910호')
  assert.equal(doc.isUpcoming, true)
  assert.equal(byKey(doc, '28의12')?.title, '인공지능기술 개발을 위한 개인정보의 이용')
  assert.equal(doc.articles.filter((a) => a.key === '28의12').length, 1)
})

test('wrong shape throws', () => {
  assert.throws(() => parseLawDocument({}, { kind: 'law', isUpcoming: false }), /unexpected law api shape/)
})

test('nested array 목내용 (live API shape) is flattened', () => {
  const json = {
    법령: {
      기본정보: { 법령명_한글: '테스트', 공포번호: '1', 공포일자: '20260101', 시행일자: '20260102' },
      조문: {
        조문단위: [
          {
            조문여부: '조문', 조문번호: '1', 조문제목: '제목', 조문내용: '제1조(제목)',
            항: [{ 호: [{ 호내용: '1. 가', 목: [{ 목내용: [['가. 나', '      1) 다']] }] }] }],
          },
        ],
      },
    },
  }
  const doc = parseLawDocument(json, { kind: 'decree', isUpcoming: false })
  assert.equal(doc.articles[0].body, '제1조(제목)\n  1. 가\n    가. 나\n      1) 다')
})
