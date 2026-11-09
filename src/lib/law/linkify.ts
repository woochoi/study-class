import { articleKeyFromParts } from './article-key.ts'
import type { DocKind } from './types.ts'

export type RefSegment = { text: string; key?: string }

// 조 뒤에 이어지는 항·호(의M)·목도 한 조각에 묶는다(예: 제2조제6호나목). 링크 키는 조까지만.
const REF = /제(\d+)조(?:의(\d+))?(?:제\d+항)?(?:제\d+호(?:의\d+)?)?(?:[가-하]목)?/g

/** 본문에서 `제N조`, `제N조의M`(+항·호·목) 참조를 찾아 조각으로 나눈다. 조각 text를 이으면 원문과 같다. */
export function splitArticleRefs(text: string): RefSegment[] {
  const out: RefSegment[] = []
  let last = 0
  for (const m of text.matchAll(REF)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) })
    out.push({ text: m[0], key: articleKeyFromParts(m[1], m[2]) })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

const Q = `["'“”‘’「」]`
const LAW_NAME = /「\s*개인정보\s*보호법\s*」/
const DECREE_NAME = /「\s*개인정보\s*보호법\s*시행령\s*」/
const DEFINED = `(?:\\s*\\(\\s*이하\\s*${Q}?[^)]{0,12}${Q}?\\s*(?:이?라\\s*)?(?:한다|함)\\s*\\))?`
const NAMED_TAIL = new RegExp(`(「[^」]*」)${DEFINED}[\\s,]*$`)

/**
 * 조 참조 바로 앞(최대 40자)으로 어느 법령의 조인지 판단한다.
 * 「개인정보 보호법」·단독 '법' → law, 「…시행령」·단독 '영'/'시행령' → decree,
 * 다른 법령(「…」, '정보통신망법' 등)이면 null(링크 안 함), 그 외는 own.
 */
export function refKindFor(prefixText: string, own: DocKind): DocKind | null {
  const direct = kindFromTail(prefixText, own)
  if (direct !== own) return direct
  // '영 제16조제2항, 제30조 및 제30조의2'처럼 이어진 참조는 묶음 맨 앞의 법령을 따른다.
  let rest = prefixText
  let walked = false
  for (;;) {
    const m = RUN_TAIL.exec(rest)
    if (!m) break
    rest = rest.slice(0, m.index)
    walked = true
  }
  return walked ? kindFromTail(rest, own) : own
}

const RUN_TAIL =
  /제\d+조(?:의\d+)?(?:제\d+항)?(?:제\d+호)?(?:[가-힣]목)?(?:[,ㆍ·]\s*|\s*(?:및|또는|부터|과|와)\s*)$/

function kindFromTail(prefixText: string, own: DocKind): DocKind | null {
  const tail = prefixText.slice(-40)
  const named = NAMED_TAIL.exec(tail)
  if (named) {
    if (DECREE_NAME.test(named[1])) return 'decree'
    if (LAW_NAME.test(named[1])) return 'law'
    return null
  }
  // 40자 창에서 「가 잘려 나간 긴 법령명: 「…」로 끝나는 다른 법령으로 본다.
  if (new RegExp(`」${DEFINED}[\\s,]*$`).test(tail)) return null
  const bare = tail.replace(new RegExp(`${DEFINED}[\\s,]*$`), '')
  const token = /([가-힣A-Za-z0-9]+)[\s,]*$/.exec(bare)?.[1]
  if (token === '법') return 'law'
  if (token === '영' || token === '시행령') return 'decree'
  if (token?.endsWith('시행령')) return 'decree'
  if (token?.endsWith('법')) return null
  return own
}
