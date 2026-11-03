import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseAdmrulDocument } from './parse-admrul.ts'

const json: unknown = JSON.parse(
  readFileSync(new URL('../../../test/fixtures/law-api/admrul.json', import.meta.url), 'utf8'),
)
const doc = parseAdmrulDocument(json)
const byKey = (key: string) => doc.articles.find((a) => a.key === key)!

test('admrul: metadata and structure', () => {
  assert.equal(doc.promulgationNo, '고시 제2026-9호')
  assert.equal(doc.effectiveOn, '2026-07-01')
  assert.equal(doc.kind, 'notice')
  const keys = doc.articles.map((a) => a.key)
  assert.equal(doc.articles.length, 20)
  for (let i = 1; i <= 19; i++) assert.ok(keys.includes(String(i)), `key ${i}`)
  assert.ok(keys.includes('6의2'))
  assert.equal(doc.chapters.length, 3)
  assert.equal(byKey('6의2').title, '인터넷망의 차단 조치 등')
  assert.equal(byKey('4').chapterLabel, '제2장')
})

test('admrul: line breaks restored in body', () => {
  assert.ok(byKey('2').body.includes('같다.\n  1. "개인정보처리시스템"'))
  assert.ok(byKey('7').body.includes('\n②'))
})

test('admrul: dates like 2026.7.1 are not split', () => {
  const raw = {
    AdmRulService: {
      행정규칙기본정보: { 행정규칙명: '테스트', 발령번호: '1', 발령일자: '20260701', 시행일자: '20260701' },
      조문내용: ['제1조(시행일) 이 고시는 2026.7.1부터 시행한다. 2026.7.1.자 개정분은 제2조에 따른다.'],
    },
  }
  const body = parseAdmrulDocument(raw).articles[0].body
  assert.ok(body.includes('2026.7.1부터'))
  assert.ok(body.includes('2026.7.1.자'))
  assert.equal(body.includes('\n'), false)
})
