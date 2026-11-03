import { readFile } from 'node:fs/promises'
import { parseAdmrulDocument } from '../src/lib/law/parse-admrul.ts'
import { parseLawDocument } from '../src/lib/law/parse-law.ts'
import { parseThdCmpLinks } from '../src/lib/law/parse-thdcmp.ts'
import { expandNoticeLinks, type NoticeLinkRule } from '../src/lib/law/notice-links.ts'
import type { ParsedDocument, ParsedLink } from '../src/lib/law/types.ts'

export type FetchJson = (url: string) => Promise<unknown>

const BASE = 'https://www.law.go.kr/DRF/lawService.do'

type Source = { name: string; query: string; expected: string }

/** 문서별 API 쿼리와 기대 공포번호 (허브가 가리키는 버전). */
export const SOURCES = {
  law: { name: '개인정보 보호법', query: 'target=law&MST=283839', expected: '법률 제21445호' },
  upcoming: { name: '개인정보 보호법(시행예정)', query: 'target=eflaw&MST=289415&efYd=20270309', expected: '법률 제21910호' },
  decree: { name: '개인정보 보호법 시행령', query: 'target=law&MST=289537', expected: '대통령령 제36671호' },
  notice: { name: '개인정보의 안전성 확보조치 기준', query: 'target=admrul&ID=2100000281400', expected: '고시 제2026-9호' },
} satisfies Record<string, Source>

export const THDCMP_QUERY = 'target=thdCmp&MST=283839&knd=2'

export const EXPECTED_PROMULGATION_NOS: string[] = Object.values(SOURCES).map((s) => s.expected)

function url(query: string, oc: string): string {
  return `${BASE}?OC=${encodeURIComponent(oc)}&type=JSON&${query}`
}

export async function fetchAllLawSources(
  fetchJson: FetchJson,
  oc: string,
  warn: (message: string) => void = (m) => console.error(m),
): Promise<{ docs: ParsedDocument[]; links: ParsedLink[] }> {
  const get = async (query: string): Promise<unknown> => {
    const json = await fetchJson(url(query, oc))
    const result = (json as { result?: unknown } | null)?.result
    if (typeof result === 'string' && result.includes('사용자 정보 검증에 실패')) {
      throw new Error('law api rejected the call: register this machine IP at open.law.go.kr')
    }
    return json
  }

  const law = parseLawDocument(await get(SOURCES.law.query), { kind: 'law', isUpcoming: false })
  const upcoming = parseLawDocument(await get(SOURCES.upcoming.query), { kind: 'law', isUpcoming: true })
  const decree = parseLawDocument(await get(SOURCES.decree.query), { kind: 'decree', isUpcoming: false })
  const notice = parseAdmrulDocument(await get(SOURCES.notice.query))
  const thdLinks = parseThdCmpLinks(await get(THDCMP_QUERY))

  const docs = [law, upcoming, decree, notice]
  const expected = [SOURCES.law, SOURCES.upcoming, SOURCES.decree, SOURCES.notice]
  docs.forEach((d, i) => {
    const e = expected[i]
    if (d.promulgationNo !== e.expected) {
      warn(`경고: ${e.name} 공포번호가 기대값과 다릅니다 (${e.expected} → ${d.promulgationNo}) — 허브 매핑을 확인하세요`)
    }
  })

  const rules = JSON.parse(
    await readFile(new URL('../db/seed/notice-links.json', import.meta.url), 'utf8'),
  ) as NoticeLinkRule[]
  const links = [...thdLinks, ...expandNoticeLinks(rules, notice)]
  return { docs, links }
}
