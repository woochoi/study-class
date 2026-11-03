/* eslint-disable @typescript-eslint/no-explicit-any */
// 국가법령정보센터 OPEN API 를 호출해 파서 테스트용 픽스처를 만든다.
// 실행: node --env-file=.env scripts/make-law-fixtures.ts
// OC 값은 출력하지 않는다.
import { mkdirSync, writeFileSync } from 'node:fs'

const OC = process.env.LAW_API_OC
if (!OC) {
  console.error('LAW_API_OC is not set (.env)')
  process.exit(1)
}

const OUT = new URL('../test/fixtures/law-api/', import.meta.url)
mkdirSync(OUT, { recursive: true })

async function call(params: Record<string, string>): Promise<Record<string, any>> {
  const qs = new URLSearchParams({ OC: OC as string, type: 'JSON', ...params })
  const res = await fetch(`https://www.law.go.kr/DRF/lawService.do?${qs}`)
  if (!res.ok) throw new Error(`law api failed: ${params.target} HTTP ${res.status}`)
  return res.json()
}

function save(name: string, data: unknown) {
  writeFileSync(new URL(name, OUT), JSON.stringify(data, null, 2) + '\n')
  console.log('wrote', name)
}

// API 응답 JSON 은 형태가 자유로워 스크립트 안에서만 any 를 허용한다.
type Unit = Record<string, any>
const keyOf = (u: Unit) => `${u.조문번호}${u.조문가지번호 ? '의' + u.조문가지번호 : ''}`

// 조문 중 keep 에 있는 것만 남기고, 전문(장/절 제목)은 [first-before, last] 범위에서 남긴다.
function trimUnits(units: Unit[], keep: string[], leadingFrom: 'start' | 'firstKept') {
  const idx = units.map((u, i) => (u.조문여부 === '조문' && keep.includes(keyOf(u)) ? i : -1)).filter((i) => i >= 0)
  if (idx.length !== keep.length) throw new Error(`missing articles: expected ${keep.length}, got ${idx.length}`)
  const first = leadingFrom === 'start' ? 0 : idx[0] - 1
  const last = idx[idx.length - 1]
  return units.filter((u, i) => i >= first && i <= last && (u.조문여부 === '전문' || idx.includes(i)))
}

function trimLaw(json: Record<string, any>, keep: string[], leadingFrom: 'start' | 'firstKept') {
  const units = json.법령.조문.조문단위 as Unit[]
  return {
    법령: {
      기본정보: json.법령.기본정보,
      조문: { 조문단위: trimUnits(units, keep, leadingFrom) },
    },
  }
}

const law = await call({ target: 'law', MST: '283839' })
save('law.json', trimLaw(law, ['1', '2', '3', '24', '24의2', '28의2', '29'], 'start'))

const up = await call({ target: 'eflaw', MST: '289415', efYd: '20270309' })
save('law-upcoming.json', trimLaw(up, ['28의12', '28의13', '28의14', '28의15'], 'firstKept'))

const decree = await call({ target: 'law', MST: '289537' })
save('decree.json', trimLaw(decree, ['1', '2', '21의2', '30', '30의2'], 'start'))

const adm = await call({ target: 'admrul', ID: '2100000281400' })
save('admrul.json', {
  AdmRulService: {
    행정규칙기본정보: adm.AdmRulService.행정규칙기본정보,
    조문내용: adm.AdmRulService.조문내용,
  },
})

const thd = await call({ target: 'thdCmp', MST: '283839', knd: '2' })
const keepThd = new Set(['0001/00', '0002/00', '0029/00', '0024/02'])
const items = (thd.LspttnThdCmpLawXService.위임조문삼단비교.법률조문 as Unit[]).filter((x) =>
  keepThd.has(`${x.조번호}/${x.조가지번호}`),
)
save('thdcmp.json', { LspttnThdCmpLawXService: { 위임조문삼단비교: { 법률조문: items } } })
