import 'server-only'
import { query } from '../db.ts'
import type { User } from '../types.ts'

export type ProgressChange =
  | { type: 'reads'; unitId: string; reads: number }
  | { type: 'level'; cardId: string; level: number }
  | { type: 'reset'; cardIds: string[] }
  | { type: 'exam'; date: string | null }

export type ProgressResult = { ok: true } | { ok: false; reason: 'auth' | 'invalid' }

function invalid(): never {
  throw new Error('invalid progress value')
}

function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export async function setUnitReads(userId: string, unitId: string, reads: 0 | 1 | 2 | 3): Promise<void> {
  if (!Number.isInteger(reads) || reads < 0 || reads > 3) invalid()
  await query(
    `INSERT INTO user_unit_reads (user_id, unit_id, reads) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, unit_id) DO UPDATE SET reads = EXCLUDED.reads`,
    [userId, unitId, reads],
  )
}

export async function setCardLevel(userId: string, cardId: string, level: 1 | 2 | 3): Promise<void> {
  if (!Number.isInteger(level) || level < 1 || level > 3) invalid()
  await query(
    `INSERT INTO user_card_levels (user_id, card_id, level) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, card_id) DO UPDATE SET level = EXCLUDED.level`,
    [userId, cardId, level],
  )
}

export async function resetCardLevels(userId: string, cardIds: string[]): Promise<void> {
  if (cardIds.length === 0) return
  await query('DELETE FROM user_card_levels WHERE user_id = $1 AND card_id = ANY($2::bigint[])', [userId, cardIds])
}

export async function setExamDate(userId: string, date: string | null): Promise<void> {
  if (date !== null && !isRealDate(date)) invalid()
  await query(
    `INSERT INTO user_settings (user_id, exam_date) VALUES ($1, $2::date)
     ON CONFLICT (user_id) DO UPDATE SET exam_date = EXCLUDED.exam_date`,
    [userId, date],
  )
}

const MAX_RESET_IDS = 1000
const UNIT_ID = /^a\d-\d+$/
const CARD_ID = /^\d{1,18}$/

function isValidChange(c: unknown): c is ProgressChange {
  if (typeof c !== 'object' || c === null) return false
  const x = c as Record<string, unknown>
  switch (x.type) {
    case 'reads':
      return typeof x.unitId === 'string' && UNIT_ID.test(x.unitId) && Number.isInteger(x.reads)
    case 'level':
      return typeof x.cardId === 'string' && CARD_ID.test(x.cardId) && Number.isInteger(x.level)
    case 'reset':
      return (
        Array.isArray(x.cardIds) &&
        x.cardIds.length <= MAX_RESET_IDS &&
        x.cardIds.every((id) => typeof id === 'string' && CARD_ID.test(id))
      )
    case 'exam':
      return x.date === null || typeof x.date === 'string'
    default:
      return false
  }
}

// FK violation, invalid text representation, numeric out of range
const INVALID_PG_CODES = new Set(['23503', '22P02', '22003'])

export async function applyProgressChange(user: User | null, change: ProgressChange): Promise<ProgressResult> {
  if (!user) return { ok: false, reason: 'auth' }
  if (!isValidChange(change)) return { ok: false, reason: 'invalid' }
  try {
    switch (change.type) {
      case 'reads':
        await setUnitReads(user.id, change.unitId, change.reads as 0 | 1 | 2 | 3)
        break
      case 'level':
        await setCardLevel(user.id, change.cardId, change.level as 1 | 2 | 3)
        break
      case 'reset':
        await resetCardLevels(user.id, change.cardIds)
        break
      case 'exam':
        await setExamDate(user.id, change.date)
        break
      default:
        return { ok: false, reason: 'invalid' }
    }
    return { ok: true }
  } catch (e) {
    if (e instanceof Error && e.message === 'invalid progress value') return { ok: false, reason: 'invalid' }
    const code = (e as { code?: string }).code
    if (code && INVALID_PG_CODES.has(code)) return { ok: false, reason: 'invalid' }
    throw e
  }
}
