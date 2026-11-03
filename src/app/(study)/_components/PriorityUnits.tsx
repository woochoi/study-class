'use client'

import { priorityUnits } from '@/lib/study/progress.ts'
import { useProgress } from './ProgressProvider.tsx'

export default function PriorityUnits() {
  const { areas, reads } = useProgress()
  const top = priorityUnits(areas, reads, 4)
  return (
    <ol className="prio">
      {top.length === 0 ? (
        <li>
          <span className="rank">✓</span>
          <div className="t">모든 중단원 3회독 완료. 암기 카드로 마무리하세요.</div>
        </li>
      ) : (
        top.map((x, i) => (
          <li key={x.unit.id} className={x.area.id}>
            <span className="rank">{i + 1}</span>
            <div>
              <div className="t">
                {x.area.roman} {x.unit.name}
              </div>
              <div className="r">
                {x.area.name} · 단원 배점 {x.area.weight}% · {reads[x.unit.id] ?? 0}회독 · 핵심{' '}
                {x.unit.leaves
                  .slice(0, 3)
                  .map((l) => l.ref.split(' · ')[0])
                  .join(', ')}
              </div>
            </div>
          </li>
        ))
      )}
    </ol>
  )
}
