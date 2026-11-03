'use client'

import { weightedProgress } from '@/lib/study/progress.ts'
import { useProgress } from './ProgressProvider.tsx'

const MAX_WEIGHT = 30

export default function ProgressSummary({ knownCards, totalCards }: { knownCards: number; totalCards: number }) {
  const { areas, reads } = useProgress()
  const unitCount = areas.reduce((t, a) => t + a.units.length, 0)
  const readSum = Object.values(reads).reduce((t, v) => t + v, 0)
  const areaProg = (units: { id: string }[]) =>
    units.length ? units.reduce((t, u) => t + (reads[u.id] ?? 0) / 3, 0) / units.length : 0
  return (
    <>
      <div className="summary">
        <div>
          <div className="big">
            {weightedProgress(areas, reads)}
            <small>%</small>
          </div>
          <div className="statl">배점 가중 진도</div>
        </div>
        <div>
          <div className="big">
            {knownCards}
            <small>/{totalCards}</small>
          </div>
          <div className="statl">외운 카드 (3단계)</div>
        </div>
        <div>
          <div className="big">
            {readSum}
            <small>/{unitCount * 3}</small>
          </div>
          <div className="statl">회독 체크</div>
        </div>
      </div>
      <h3>배점과 진도</h3>
      <div>
        {areas
          .slice()
          .sort((x, y) => y.weight - x.weight)
          .map((a) => {
            const p = areaProg(a.units)
            const ww = (a.weight / MAX_WEIGHT) * 100
            return (
              <div key={a.id} className={`wrow ${a.id}`}>
                <div className="wname">
                  <span className="no">{a.roman}</span>
                  {a.name}
                </div>
                <div className="track" title={`배점 ${a.weight}%, 진도 ${Math.round(p * 100)}%`}>
                  <div className="w" style={{ width: `${ww}%` }} />
                  <div className="p" style={{ width: `${ww * p}%` }} />
                </div>
                <div className="wnum">
                  <b>{a.weight}%</b> · {Math.round(p * 100)}%
                </div>
              </div>
            )
          })}
      </div>
      <div className="legend">
        <span>
          <i style={{ background: 'color-mix(in srgb,var(--c4) 22%,transparent)', borderRight: '2px solid var(--c4)' }} />
          배점 (최대 30%)
        </span>
        <span>
          <i style={{ background: 'var(--c4)' }} />
          회독 진도 (배점 대비)
        </span>
      </div>
    </>
  )
}
