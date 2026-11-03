import { articleKeyFromParts } from './article-key.ts'
import type { DocKind } from './types.ts'

export type RefSegment = { text: string; key?: string }

const REF = /제(\d+)조(?:의(\d+))?/g

/** 본문에서 `제N조`, `제N조의M` 참조를 찾아 조각으로 나눈다. 조각 text를 이으면 원문과 같다. */
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

/** 조 참조 바로 앞 글자로 어느 법령의 조인지 판단한다. '법 ' → law, '영 '/'시행령 ' → decree, 그 외는 own. */
export function refKindFor(prefixText: string, own: DocKind): DocKind {
  const tail = prefixText.slice(-4)
  if (/(시행령|영)\s*$/.test(tail)) return 'decree'
  if (/법\s*$/.test(tail)) return 'law'
  return own
}
