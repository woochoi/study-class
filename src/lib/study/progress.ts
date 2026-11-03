import type { Area, Unit } from './types.ts'

function unitProgress(reads: Record<string, number>, unit: Unit): number {
  return (reads[unit.id] ?? 0) / 3
}

/** 법령 허브 renderOverview와 같은 식: Σ 배점 × (중단원 회독/3 평균). 0~100 반올림. */
export function weightedProgress(areas: Area[], reads: Record<string, number>): number {
  let total = 0
  for (const a of areas) {
    if (a.units.length === 0) continue
    const avg = a.units.reduce((t, u) => t + unitProgress(reads, u), 0) / a.units.length
    total += a.weight * avg
  }
  return Math.round(total)
}

export function priorityUnits(
  areas: Area[],
  reads: Record<string, number>,
  limit = 4,
): { area: Area; unit: Unit; score: number }[] {
  const all: { area: Area; unit: Unit; score: number }[] = []
  for (const area of areas) {
    for (const unit of area.units) {
      all.push({ area, unit, score: (area.weight / area.units.length) * (1 - unitProgress(reads, unit)) })
    }
  }
  return all
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
}

export function nextCardLevel(level: number, ok: boolean): 1 | 2 | 3 {
  if (!ok) return 1
  return Math.min(3, level + 1) as 1 | 2 | 3
}

export function ddayLabel(examDate: string | null, today: Date): string {
  if (!examDate) return 'D-?'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(examDate)
  if (!m) return 'D-?'
  const exam = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const diff = Math.round((exam - now) / 86400000)
  if (diff === 0) return 'D-Day'
  return diff > 0 ? `D-${diff}` : `D+${-diff}`
}

export function toggleRead(current: number, n: 1 | 2 | 3): number {
  return current === n ? n - 1 : n
}
