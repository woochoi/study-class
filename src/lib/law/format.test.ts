import test from 'node:test'
import assert from 'node:assert/strict'
import { lawNameHref, parseBodyLine, splitLawMarkup } from './format.ts'

const types = (text: string, first = false) => splitLawMarkup(text, first).map((s) => [s.type, s.text])

test('parseBodyLine: 앞 공백 2칸마다 한 단계 들여쓰기, 공백은 떼어 낸다', () => {
  assert.deepEqual(parseBodyLine('제2조(정의) 이 법에서'), { depth: 0, text: '제2조(정의) 이 법에서' })
  assert.deepEqual(parseBodyLine('① 법 제2조제7호에서'), { depth: 0, text: '① 법 제2조제7호에서' })
  assert.deepEqual(parseBodyLine('  1. "개인정보"란'), { depth: 1, text: '1. "개인정보"란' })
  assert.deepEqual(parseBodyLine('    가. 성명'), { depth: 2, text: '가. 성명' })
  assert.deepEqual(parseBodyLine('      1) 세부'), { depth: 3, text: '1) 세부' })
  assert.deepEqual(parseBodyLine('          깊음'), { depth: 3, text: '깊음' })
})

test('splitLawMarkup: 첫 줄 맨 앞 조문 제목을 title로', () => {
  assert.deepEqual(types('제2조(정의) 이 법에서', true), [['title', '제2조(정의)'], ['text', ' 이 법에서']])
  assert.deepEqual(types('제28조의8(개인정보의 국외 이전) ①', true), [['title', '제28조의8(개인정보의 국외 이전)'], ['text', ' ①']])
  assert.deepEqual(types('제8조 삭제 <2020.2.4>', true), [['title', '제8조'], ['text', ' 삭제 '], ['revision', '<2020.2.4>']])
})

test('splitLawMarkup: 첫 줄이 아니면 조문 제목으로 보지 않는다', () => {
  assert.deepEqual(types('제2조(정의)에 따른', false), [['text', '제2조(정의)에 따른']])
})

test('splitLawMarkup: <개정·신설 날짜> 를 revision으로', () => {
  assert.deepEqual(types('말한다. <개정 2014.3.24, 2020.2.4>'), [['text', '말한다. '], ['revision', '<개정 2014.3.24, 2020.2.4>']])
  assert.deepEqual(types('장치 <신설 2023.9.12>'), [['text', '장치 '], ['revision', '<신설 2023.9.12>']])
})

test('splitLawMarkup: 날짜 없는 꺾쇠는 그대로 글자', () => {
  assert.deepEqual(types('A <B> C'), [['text', 'A <B> C']])
})

test('splitLawMarkup: 「법령명」을 lawName으로', () => {
  assert.deepEqual(types('「국가인권위원회법」 제3조에 따른'), [['lawName', '「국가인권위원회법」'], ['text', ' 제3조에 따른']])
  assert.deepEqual(types('「초ㆍ중등교육법」, 「고등교육법」, 그 밖의'), [
    ['lawName', '「초ㆍ중등교육법」'],
    ['text', ', '],
    ['lawName', '「고등교육법」'],
    ['text', ', 그 밖의'],
  ])
})

test('splitLawMarkup: 조각을 이으면 원문과 같다', () => {
  const s = '제2조(공공기관의 범위) 「개인정보 보호법」(이하 "법"이라 한다) 제2조제6호나목에서 <개정 2020.7.14, 2025.9.23>'
  assert.equal(splitLawMarkup(s, true).map((x) => x.text).join(''), s)
})

test('lawNameHref: 이 사이트에 있는 법령은 null(색만 입힘)', () => {
  for (const n of ['「개인정보 보호법」', '「개인정보 보호법 시행령」', '「개인정보의 안전성 확보조치 기준」']) {
    assert.equal(lawNameHref(n), null)
  }
})

test('lawNameHref: 다른 법령은 국가법령정보센터 법령 주소', () => {
  assert.equal(lawNameHref('「국가인권위원회법」'), 'https://www.law.go.kr/법령/국가인권위원회법')
  assert.equal(
    lawNameHref('「고위공직자범죄수사처 설치 및 운영에 관한 법률」'),
    'https://www.law.go.kr/법령/고위공직자범죄수사처설치및운영에관한법률',
  )
})
