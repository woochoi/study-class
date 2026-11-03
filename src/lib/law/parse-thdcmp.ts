import { articleKeyFromParts } from './article-key.ts'
import type { ParsedLink } from './types.ts'
import { asList, asRec, shapeError, str } from './shape.ts'

/** 3단비교(`thdCmp`) JSON → 법 조 → 시행령 조 링크 (중복 제거) */
export function parseThdCmpLinks(json: unknown): ParsedLink[] {
  const root = asRec(json, 'root')
  const svc = asRec(root['LspttnThdCmpLawXService'], 'LspttnThdCmpLawXService')
  const cmp = asRec(svc['위임조문삼단비교'], '위임조문삼단비교')
  if (!('법률조문' in cmp)) throw shapeError('위임조문삼단비교.법률조문')

  const seen = new Set<string>()
  const links: ParsedLink[] = []
  for (const it of asList(cmp['법률조문'])) {
    const item = asRec(it, '법률조문[]')
    const dec = item['시행령조문']
    if (dec == null || dec === '') continue
    const d = asRec(dec, '시행령조문')
    const fromKey = articleKeyFromParts(str(item['조번호'], '조번호'), item['조가지번호'] as string | undefined)
    const toKey = articleKeyFromParts(str(d['조번호'], '시행령조문.조번호'), d['조가지번호'] as string | undefined)
    const id = `${fromKey}>${toKey}`
    if (seen.has(id)) continue
    seen.add(id)
    links.push({ fromKind: 'law', fromKey, toKind: 'decree', toKey, note: null })
  }
  return links
}
