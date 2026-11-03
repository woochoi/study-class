export type Unit = {
  id: string
  name: string
  lawSummary: string
  decreeSummary: string
  leaves: { label: string; ref: string }[]
  items: { label: string; lawRef: string; decreeRef: string; isKey: boolean }[]
}

export type Area = {
  id: string
  roman: string
  name: string
  weight: number
  units: Unit[]
}

export type Card = {
  id: string
  areaId: string | null
  deck: 'law' | 'concept' | 'decree'
  front: string
  answer: string
  extra: string | null
}

export type Chapter = {
  label: string
  title: string
  articles: { key: string; title: string; isUpcoming: boolean }[]
}

export type HistoryEvent = {
  docKind: 'law' | 'decree'
  dateLabel: string
  title: string
  summary: string
  articleKeys: string[]
  isKey: boolean
}

export type Anchor = { articleKey: string; label: string; areaId: string; isNew: boolean }

export type Mnemonic = { areaId: string; title: string; body: string }

export type UserProgress = {
  reads: Record<string, number>
  levels: Record<string, number>
  examDate: string | null
}
