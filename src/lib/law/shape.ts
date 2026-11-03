// API JSON 을 안전하게 읽기 위한 작은 헬퍼 (parse-* 모듈 공용)

export type Rec = Record<string, unknown>

export function shapeError(where: string): Error {
  return new Error(`unexpected law api shape: ${where}`)
}

export function asRec(v: unknown, where: string): Rec {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw shapeError(where)
  return v as Rec
}

/** 배열이 와야 하는 자리. 단일 객체로 오면 배열로 감싼다. 없으면 []. */
export function asList(v: unknown): unknown[] {
  if (v == null || v === '') return []
  return Array.isArray(v) ? v : [v]
}

export function str(v: unknown, where: string): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  throw shapeError(where)
}

export function optStr(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
}

/** 'YYYYMMDD' → 'YYYY-MM-DD' */
export function isoDate(v: string, where: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v)
  if (!m) throw shapeError(where)
  return `${m[1]}-${m[2]}-${m[3]}`
}

const CHAPTER_RE = /^\s*제(\d+)장(의\d+)?\s+([\s\S]*)$/

/** '제4장의2 가명정보… <신설 2020.8.4>' → { label, title }. 장이 아니면 null. */
export function parseChapterHeading(text: string): { label: string; title: string } | null {
  const m = CHAPTER_RE.exec(text)
  if (!m) return null
  return {
    label: `제${m[1]}장${m[2] ?? ''}`,
    title: m[3].replace(/<[^>]*>/g, '').trim(),
  }
}
