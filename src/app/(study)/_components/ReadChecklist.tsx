'use client'

import { useProgress } from './ProgressProvider.tsx'

export default function ReadChecklist() {
  const { areas, reads, message, toggle } = useProgress()
  return (
    <>
      <p className="hint">중단원별로 1·2·3회독을 누르세요. 로그인하면 계정에 저장됩니다.</p>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="check">
        {areas.map((a) =>
          a.units.map((u) => (
            <div key={u.id} className={`crow ${a.id}`}>
              <div className="t">
                <span className="no">{a.roman}</span>
                {u.name}
                <small>{u.leaves.map((l) => l.label).join(' · ')}</small>
              </div>
              <div className="reads" role="group" aria-label={`${u.name} 회독`}>
                {([1, 2, 3] as const).map((n) => {
                  const on = (reads[u.id] ?? 0) >= n
                  return (
                    <button key={n} type="button" className={on ? 'on' : ''} aria-pressed={on} onClick={() => toggle(u.id, n)}>
                      {n}회
                    </button>
                  )
                })}
              </div>
            </div>
          )),
        )}
      </div>
    </>
  )
}
