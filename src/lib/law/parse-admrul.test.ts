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

const synth = (text: string) =>
  parseAdmrulDocument({
    AdmRulService: {
      행정규칙기본정보: { 행정규칙명: '테스트', 발령번호: '1', 발령일자: '20260701', 시행일자: '20260701' },
      조문내용: [text],
    },
  }).articles[0].body

test('admrul: 제4조 호 1~18 each on its own indented line', () => {
  const lines = byKey('4').body.split('\n')
  const start = lines.findIndex((l) => l.startsWith('①'))
  const end = lines.findIndex((l) => l.startsWith('②'))
  const items = lines.slice(start + 1, end)
  assert.equal(items.length, 18)
  items.forEach((l, i) => assert.ok(l.startsWith(`  ${i + 1}. `), l))
})

test('admrul: 제7조 ③ 2호 has 목 가.~나.', () => {
  const body = byKey('7').body
  assert.ok(body.includes('\n    가. 법 제33조'))
  assert.ok(body.includes('\n    나. 암호화 미적용시'))
})

test('admrul: 제14조 1호 has 목 가.~다.', () => {
  const lines = byKey('14').body.split('\n')
  const i = lines.findIndex((l) => l.startsWith('  1. 2개 이상'))
  assert.ok(i >= 0)
  const mok = lines.slice(i + 1, i + 4)
  assert.ok(mok[0].startsWith('    가. 100만명'))
  assert.ok(mok[1].startsWith('    나. 개인정보처리시스템'))
  assert.ok(mok[2].startsWith('    다. 정보주체의'))
})

test('admrul: false-positive guards', () => {
  assert.equal(synth('제1조(a) 시행한다. 2026.7.1부터 적용한다.').includes('\n'), false)
  assert.equal(synth('제1조(a) 2026.7.1.자 개정분을 따른다.').includes('\n'), false)
  assert.equal(synth('제1조(a) 제30조제1항제1호 및 제2호에 따른다.').includes('\n'), false)
})
