// 조문 본문 한 줄을 화면용 조각으로 나눈다 (국가법령정보센터 3단 비교 화면의 표기를 따름).
// - title: 본문 첫 줄 맨 앞의 조문 제목 "제2조(정의)" → 굵게
// - revision: "<개정 2014.3.24, 2020.2.4>", "<신설 …>", "<2020.2.4>" → 파란 글씨
// - lawName: "「국가인권위원회법」" → 파란 밑줄(다른 법령은 국가법령정보센터로 링크)
// - text: 나머지. 조 참조 링크(제N조…)는 ArticleRefText가 이어서 처리한다.

export type MarkupType = 'title' | 'revision' | 'lawName' | 'text'
export type MarkupSegment = { type: MarkupType; text: string }

const MAX_DEPTH = 3

/** 앞 공백 2칸 = 한 단계(호), 4칸 = 두 단계(목). 들여쓰기는 CSS 내어쓰기로 표현하므로 공백은 떼어 낸다. */
export function parseBodyLine(line: string): { depth: number; text: string } {
  const spaces = line.length - line.trimStart().length
  return { depth: Math.min(Math.floor(spaces / 2), MAX_DEPTH), text: line.trimStart() }
}

// 제목 괄호 안에 괄호가 한 번 더 들어가는 경우까지 허용한다.
const TITLE = /^제\d+조(?:의\d+)?(?:\((?:[^()]|\([^()]*\))*\))?/
const INLINE = /<[^<>]*\d{4}\.\d{1,2}\.\d{1,2}[^<>]*>|「[^「」]+」/g

export function splitLawMarkup(text: string, firstLine: boolean): MarkupSegment[] {
  const out: MarkupSegment[] = []
  let rest = text
  if (firstLine) {
    const m = TITLE.exec(rest)
    if (m) {
      out.push({ type: 'title', text: m[0] })
      rest = rest.slice(m[0].length)
    }
  }
  let last = 0
  for (const m of rest.matchAll(INLINE)) {
    if (m.index > last) out.push({ type: 'text', text: rest.slice(last, m.index) })
    out.push({ type: m[0].startsWith('<') ? 'revision' : 'lawName', text: m[0] })
    last = m.index + m[0].length
  }
  if (last < rest.length) out.push({ type: 'text', text: rest.slice(last) })
  return out
}

// 이 사이트에 원문이 있는 법령: 링크 대신 색만 입힌다.
const OWN = new Set(['개인정보보호법', '개인정보보호법시행령', '개인정보의안전성확보조치기준'])

/** 「법령명」의 외부 링크 주소. 이 사이트에 있는 법령이면 null. */
export function lawNameHref(bracketed: string): string | null {
  const name = bracketed.replace(/[「」\s]/g, '')
  if (!name || OWN.has(name)) return null
  return `https://www.law.go.kr/법령/${name}`
}
