import assert from 'node:assert/strict'
import { test } from 'node:test'
import { refKindFor, splitArticleRefs } from './linkify.ts'

const keys = (s: string) => splitArticleRefs(s).flatMap((p) => (p.key ? [p.key] : []))
const join = (s: string) => splitArticleRefs(s).map((p) => p.text).join('')

test('제N조, 제N조의M 인식', () => {
  assert.deepEqual(keys('제2조 정의, 제24조의2 주민등록번호'), ['2', '24의2'])
})

test('제N조의A~B 는 첫 키만 링크', () => {
  assert.deepEqual(keys('제28조의8~11 국외 이전'), ['28의8'])
})

test('제A조~제B조 는 각각 링크', () => {
  assert.deepEqual(keys('제39조~제40조 유출'), ['39', '40'])
})

test('고시 제7조 도 키 7 (종류 판단은 호출자)', () => {
  assert.deepEqual(keys('고시 제7조'), ['7'])
})

test('제N항/제N호/조 없는 숫자는 링크 아님', () => {
  assert.deepEqual(keys('제3항 제2호 17 제5조의 규정'), ['5'])
})

test('숫자 없는 텍스트는 조각 1개', () => {
  assert.deepEqual(splitArticleRefs('개인정보 처리방침'), [{ text: '개인정보 처리방침' }])
  assert.deepEqual(splitArticleRefs(''), [])
})

test('모든 조각의 text를 이으면 원문과 같다', () => {
  for (const s of ['제2조 정의, 제24조의2 주민등록번호', '제28조의8~11 국외 이전', '제39조~제40조 유출', '고시 제7조', '제3항']) {
    assert.equal(join(s), s)
  }
})

test('refKindFor: 앞 글자로 법/영 구분', () => {
  assert.equal(refKindFor('같은 법 ', 'notice'), 'law')
  assert.equal(refKindFor('영 ', 'notice'), 'decree')
  assert.equal(refKindFor('법 시행령 ', 'notice'), 'decree')
  assert.equal(refKindFor('시행령 ', 'law'), 'decree')
  assert.equal(refKindFor('고시 ', 'notice'), 'notice')
  assert.equal(refKindFor('', 'decree'), 'decree')
  assert.equal(refKindFor('법', 'notice'), 'law')
})
