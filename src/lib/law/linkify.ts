import { articleKeyFromParts } from './article-key.ts'

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
