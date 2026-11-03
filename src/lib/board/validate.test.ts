import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateQuestion, validateAnswer, parsePage, parseId } from './validate.ts'

test('제목·본문은 trim 후 검사', () => {
  const r = validateQuestion({ title: '  제29조 질문 ', body: ' 내용\n둘째 줄 ', kind: '', key: '' })
  assert.deepEqual(r, { ok: true, value: { title: '제29조 질문', body: '내용\n둘째 줄', tag: null } })
})
test('빈 값·공백만·길이 초과는 필드별 오류', () => {
  const r = validateQuestion({ title: '   ', body: 'x'.repeat(5001), kind: '', key: '' })
  assert.equal(r.ok, false)
  assert.ok(!r.ok && r.errors.title && r.errors.body)
  assert.equal(validateQuestion({ title: 'x'.repeat(200), body: 'y', kind: '', key: '' }).ok, true)
  assert.equal(validateQuestion({ title: 'x'.repeat(201), body: 'y', kind: '', key: '' }).ok, false)
  assert.equal(validateQuestion({ title: 1, body: null, kind: '', key: '' }).ok, false)
})
test('태그: kind·key 둘 다 비면 없음, 하나만 있거나 형식이 틀리면 tag 오류', () => {
  const ok = validateQuestion({ title: 't', body: 'b', kind: 'decree', key: '30의2' })
  assert.ok(ok.ok)
  assert.deepEqual(ok.ok && ok.value.tag, { kind: 'decree', key: '30의2' })
  for (const [kind, key] of [['law', ''], ['foo', '29'], ['law', '29abc'], ['law', '0x1']]) {
    const r = validateQuestion({ title: 't', body: 'b', kind, key })
    assert.ok(!r.ok && r.errors.tag, `${kind}/${key}`)
  }
})
test('답변 검증', () => {
  assert.deepEqual(validateAnswer('  답 '), { ok: true, value: '답' })
  assert.equal(validateAnswer(' \n ').ok, false)
  assert.equal(validateAnswer('x'.repeat(5001)).ok, false)
})
test('parsePage / parseId', () => {
  assert.equal(parsePage('3'), 3)
  for (const v of ['abc', '0', '-1', '1.5', undefined, ['2']]) assert.equal(parsePage(v), 1)
  assert.equal(parseId('12'), '12')
  for (const v of ['0', '012', 'abc', '1'.repeat(19), undefined]) assert.equal(parseId(v), null)
})
