import type { DocKind } from '../law/types.ts'

export const LIMITS = { title: 200, body: 5000, answer: 5000 } as const
export const PAGE_SIZE = 20

export type FieldErrors = Partial<Record<'title' | 'body' | 'tag', string>>

const KINDS: readonly string[] = ['law', 'decree', 'notice']
const KEY_RE = /^\d+(의\d+)?$/

function trimmed(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s.length >= 1 && s.length <= max ? s : null
}

export function parseTag(kind: unknown, key: unknown): { kind: DocKind; key: string } | null {
  if (typeof kind !== 'string' || typeof key !== 'string') return null
  const k = key.trim()
  if (!KINDS.includes(kind) || !KEY_RE.test(k)) return null
  return { kind: kind as DocKind, key: k }
}

export function validateQuestion(input: {
  title: unknown
  body: unknown
  kind: unknown
  key: unknown
}):
  | { ok: true; value: { title: string; body: string; tag: { kind: DocKind; key: string } | null } }
  | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const title = trimmed(input.title, LIMITS.title)
  const body = trimmed(input.body, LIMITS.body)
  if (title === null) errors.title = '제목을 1~200자로 적어 주세요.'
  if (body === null) errors.body = '내용을 1~5000자로 적어 주세요.'

  const blank = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '')
  let tag: { kind: DocKind; key: string } | null = null
  if (!(blank(input.kind) && blank(input.key))) {
    tag = parseTag(input.kind, input.key)
    if (!tag) errors.tag = '조문은 종류와 번호(예: 29, 24의2)를 함께 적어 주세요.'
  }

  if (Object.keys(errors).length > 0 || title === null || body === null) return { ok: false, errors }
  return { ok: true, value: { title, body, tag } }
}

export function validateAnswer(body: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const v = trimmed(body, LIMITS.answer)
  return v === null ? { ok: false, error: '답변을 1~5000자로 적어 주세요.' } : { ok: true, value: v }
}

export function parsePage(raw: unknown): number {
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) return 1
  const n = Number(raw)
  return Number.isSafeInteger(n) ? n : 1
}

export function parseId(raw: unknown): string | null {
  return typeof raw === 'string' && /^[1-9]\d{0,17}$/.test(raw) ? raw : null
}
