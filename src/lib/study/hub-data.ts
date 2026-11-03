// 허브 HTML에서 추출한 JSON을 DB 행 모양으로 바꾸는 순수 함수 (DB/Next 의존 없음).

export type SeedArea = { id: string; roman: string; name: string; weight: number; sortOrder: number }
export type SeedUnit = {
  id: string
  areaId: string
  name: string
  lawSummary: string | null
  decreeSummary: string | null
  sortOrder: number
}
export type SeedUnitLeaf = { unitId: string; label: string; ref: string; sortOrder: number }
export type SeedUnitItem = {
  unitId: string
  label: string
  lawRef: string | null
  decreeRef: string | null
  isKey: boolean
  sortOrder: number
}
export type SeedAnchor = { articleKey: string; label: string; areaId: string; isNew: boolean }
export type SeedMnemonic = { areaId: string; title: string; body: string; sortOrder: number }
export type SeedCard = {
  areaId: string | null
  deck: 'law' | 'decree' | 'concept'
  front: string
  answer: string
  extra: string | null
  sortOrder: number
}
export type SeedHistory = {
  docKind: 'law' | 'decree'
  dateLabel: string
  title: string
  summary: string
  articleKeys: string[]
  isKey: boolean
  sortOrder: number
}
export type SeedData = {
  areas: SeedArea[]
  units: SeedUnit[]
  unitLeaves: SeedUnitLeaf[]
  unitItems: SeedUnitItem[]
  anchors: SeedAnchor[]
  mnemonics: SeedMnemonic[]
  cards: SeedCard[]
  history: SeedHistory[]
}

type LawHub = {
  AREAS: {
    id: string
    no: string
    name: string
    w: number
    subs: { id: string; name: string; leaves: [string, string][]; law?: string; dec?: string }[]
  }[]
  ANCHORS: [string, string, string, number?][]
  MNEMO: [string, string, string][]
  CARDS: { area: string; t: string; n: string; x: string; concept: boolean }[]
  HISTORY: [string, string, string, string, string[], boolean | number][]
}
type DecreeHub = {
  DOMAINS: { units: { items: [string, string | null, string | null, number?][] }[] }[]
  DECREE: { t: string; arts: { a: string; b: string }[] }[]
  TIMELINE: [string, string, number][]
}

export function buildSeedData(lawHub: unknown, decreeHub: unknown): SeedData {
  const law = lawHub as LawHub
  const dec = decreeHub as DecreeHub

  const areas: SeedArea[] = []
  const units: SeedUnit[] = []
  const unitLeaves: SeedUnitLeaf[] = []
  const unitItems: SeedUnitItem[] = []

  law.AREAS.forEach((a, ai) => {
    areas.push({ id: a.id, roman: a.no, name: a.name, weight: a.w, sortOrder: ai })
    a.subs.forEach((s, si) => {
      units.push({
        id: s.id,
        areaId: a.id,
        name: s.name,
        lawSummary: s.law ?? null,
        decreeSummary: s.dec ?? null,
        sortOrder: si,
      })
      s.leaves.forEach(([label, ref], li) =>
        unitLeaves.push({ unitId: s.id, label, ref, sortOrder: li }),
      )
      const du = dec.DOMAINS[ai]?.units[si]
      du?.items.forEach((it, ii) =>
        unitItems.push({
          unitId: s.id,
          label: it[0],
          lawRef: it[1] ?? null,
          decreeRef: it[2] ?? null,
          isKey: !!it[3],
          sortOrder: ii,
        }),
      )
    })
  })

  const anchors: SeedAnchor[] = law.ANCHORS.map(([articleKey, label, areaId, isNew]) => ({
    articleKey,
    label,
    areaId,
    isNew: !!isNew,
  }))

  const mnemonics: SeedMnemonic[] = law.MNEMO.map(([areaId, title, body], i) => ({
    areaId,
    title,
    body,
    sortOrder: i,
  }))

  const cards: SeedCard[] = []
  const counters = { law: 0, concept: 0, decree: 0 }
  const push = (c: Omit<SeedCard, 'sortOrder'>) =>
    cards.push({ ...c, sortOrder: counters[c.deck]++ })

  for (const c of law.CARDS) {
    if (!c.concept) {
      push({ areaId: c.area, deck: 'law', front: c.t, answer: c.n, extra: c.x || null })
    }
  }
  for (const c of law.CARDS) {
    if (c.concept) {
      push({ areaId: c.area, deck: 'concept', front: c.t, answer: c.x, extra: null })
    }
  }
  dec.DOMAINS.forEach((dom, di) =>
    dom.units.forEach((u) =>
      u.items.forEach((it) =>
        push({
          areaId: law.AREAS[di].id,
          deck: 'concept',
          front: it[0],
          answer: it[1] ?? '',
          extra: it[2] ?? null,
        }),
      ),
    ),
  )
  for (const ch of dec.DECREE) {
    for (const art of ch.arts) {
      push({ areaId: null, deck: 'decree', front: art.a, answer: art.b, extra: ch.t })
    }
  }

  const history: SeedHistory[] = [
    ...law.HISTORY.map(([year, date, title, summary, tags, isKey], i): SeedHistory => ({
      docKind: 'law',
      dateLabel: `${year}. ${date}`,
      title,
      summary,
      articleKeys: tags,
      isKey: !!isKey,
      sortOrder: i,
    })),
    ...dec.TIMELINE.map(([dateLabel, text, isKey], i): SeedHistory => ({
      docKind: 'decree',
      dateLabel,
      title: text,
      summary: '',
      articleKeys: [],
      isKey: !!isKey,
      sortOrder: i,
    })),
  ]

  return { areas, units, unitLeaves, unitItems, anchors, mnemonics, cards, history }
}
