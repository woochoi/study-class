'use client'

import { useState, useSyncExternalStore } from 'react'
import { ddayLabel } from '@/lib/study/progress.ts'
import { saveExamDate } from '../actions.ts'

const noop = () => () => {}
function localDay(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export default function ExamDate({ initial }: { initial: string | null }) {
  const [date, setDate] = useState<string | null>(initial)
  // 서버 렌더에서는 null(D-?), 클라이언트에서만 오늘 날짜 사용
  const day = useSyncExternalStore(noop, localDay, () => null)
  const [msg, setMsg] = useState<string | null>(null)

  async function onChange(value: string) {
    const prev = date
    const next = value === '' ? null : value
    setDate(next)
    setMsg(null)
    const r = await saveExamDate(next)
    if (!r.ok) {
      setDate(prev)
      setMsg(r.reason === 'auth' ? '로그인하면 진도가 저장돼요' : '저장하지 못했어요. 다시 시도해 주세요.')
    }
  }

  return (
    <div>
      <div className="exam">
        <label htmlFor="examDate">시험일</label>
        <input type="date" id="examDate" value={date ?? ''} onChange={(e) => onChange(e.target.value)} />
        <span className="dday">{day ? ddayLabel(date, parseDay(day)) : 'D-?'}</span>
      </div>
      {msg && (
        <p role="status" className="hint" style={{ marginTop: 6 }}>
          {msg}
        </p>
      )}
    </div>
  )
}
