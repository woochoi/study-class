'use server'

import { getCurrentUser } from '@/lib/auth/current-user.ts'
import { applyProgressChange, type ProgressResult } from '@/lib/study/progress-db.ts'

export async function saveUnitReads(unitId: string, reads: number): Promise<ProgressResult> {
  return applyProgressChange(await getCurrentUser(), { type: 'reads', unitId, reads })
}

export async function saveCardLevel(cardId: string, level: number): Promise<ProgressResult> {
  return applyProgressChange(await getCurrentUser(), { type: 'level', cardId, level })
}

export async function clearCardLevels(cardIds: string[]): Promise<ProgressResult> {
  return applyProgressChange(await getCurrentUser(), { type: 'reset', cardIds })
}

export async function saveExamDate(date: string | null): Promise<ProgressResult> {
  return applyProgressChange(await getCurrentUser(), { type: 'exam', date })
}
