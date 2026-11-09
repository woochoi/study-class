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

test('조 뒤의 항·호·목까지 한 링크 조각으로 묶는다(키는 조)', () => {
  const linked = (s: string) => splitArticleRefs(s).flatMap((p) => (p.key ? [[p.text, p.key]] : []))
  assert.deepEqual(linked('법 제2조제6호나목에서'), [['제2조제6호나목', '2']])
  assert.deepEqual(linked('제3조제1항에 따른'), [['제3조제1항', '3']])
  assert.deepEqual(linked('제2조제1호의2에 따라'), [['제2조제1호의2', '2']])
  assert.deepEqual(linked('제28조의8제1항제3호가목'), [['제28조의8제1항제3호가목', '28의8']])
  assert.deepEqual(linked('제5조에 따라'), [['제5조', '5']])
})

test('숫자 없는 텍스트는 조각 1개', () => {
  assert.deepEqual(splitArticleRefs('개인정보 처리방침'), [{ text: '개인정보 처리방침' }])
  assert.deepEqual(splitArticleRefs(''), [])
})

test('모든 조각의 text를 이으면 원문과 같다', () => {
  for (const s of ['제2조 정의, 제24조의2 주민등록번호', '제28조의8~11 국외 이전', '제39조~제40조 유출', '고시 제7조', '제3항', '법 제2조제6호나목에서']) {
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

test('refKindFor: 다른 법령·정의 약칭·단독 법/영', () => {
  assert.equal(refKindFor('「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 ', 'notice'), null)
  assert.equal(refKindFor('「개인정보 보호법」(이하 "법"이라 한다) ', 'notice'), 'law')
  assert.equal(refKindFor('「개인정보 보호법」 ', 'notice'), 'law')
  assert.equal(refKindFor('「개인정보 보호법 시행령」(이하 “영”이라 한다) ', 'notice'), 'decree')
  assert.equal(refKindFor('법 ', 'notice'), 'law')
  assert.equal(refKindFor('같은 법 시행령(이하 "영"이라 한다) ', 'notice'), 'decree')
  assert.equal(refKindFor('제29조와 같은 법 ', 'notice'), 'law')
  assert.equal(refKindFor('영 ', 'notice'), 'decree')
  assert.equal(refKindFor('정보통신망법 ', 'law'), null)
  assert.equal(refKindFor('전자정부법 ', 'decree'), null)
  assert.equal(refKindFor('', 'decree'), 'decree')
  assert.equal(refKindFor('제1항 및 ', 'decree'), 'decree')
})

test('refKindFor: 쉼표·및으로 이어진 참조는 앞의 법/영을 이어받는다', () => {
  assert.equal(refKindFor('같은 법 시행령(이하 "영"이라 한다) 제16조제2항, ', 'notice'), 'decree')
  assert.equal(refKindFor('영 제16조제2항, 제30조 및 ', 'notice'), 'decree')
  assert.equal(refKindFor('법 제15조ㆍ', 'notice'), 'law')
  assert.equal(refKindFor('「전자정부법」 제5조 및 ', 'notice'), null)
  // 앞에 법/영이 없으면 자기 문서, 문장이 끊기면 이어받지 않는다.
  assert.equal(refKindFor('5. 제16조부터 ', 'notice'), 'notice')
  assert.equal(refKindFor('다만, 법 제23조에 따른 민감정보 또는 ', 'notice'), 'notice')
})
