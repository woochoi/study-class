'use client'

import { createContext, useContext, useRef, useState } from 'react'
import { toggleRead } from '@/lib/study/progress.ts'
import type { Area } from '@/lib/study/types.ts'
import { saveUnitReads } from '../actions.ts'

type Ctx = {
  areas: Area[]
  reads: Record<string, number>
  message: string | null
  toggle: (unitId: string, n: 1 | 2 | 3) => void
}

const ProgressContext = createContext<Ctx | null>(null)

export function useProgress(): Ctx {
  const c = useContext(ProgressContext)
  if (!c) throw new Error('ProgressProvider missing')
  return c
}

export default function ProgressProvider({
  areas,
  initialReads,
  children,
}: {
  areas: Area[]
  initialReads: Record<string, number>
  children: React.ReactNode
}) {
  const [reads, setReads] = useState(initialReads)
  const [message, setMessage] = useState<string | null>(null)

  // 단원별: 마지막으로 발행한 변경 번호와 서버에 저장 확인된 값
  const seqRef = useRef(new Map<string, number>())
  const confirmedRef = useRef(new Map<string, number>())
  const latestRef = useRef(initialReads)

  async function toggle(unitId: string, n: 1 | 2 | 3) {
    const next = toggleRead(latestRef.current[unitId] ?? 0, n)
    latestRef.current = { ...latestRef.current, [unitId]: next }
    const mySeq = (seqRef.current.get(unitId) ?? 0) + 1
    seqRef.current.set(unitId, mySeq)
    setReads(latestRef.current)
    setMessage(null)
    const res = await saveUnitReads(unitId, next)
    if (res.ok) {
      confirmedRef.current.set(unitId, next)
      return
    }
    // 더 새로운 변경이 있으면 그쪽이 결과를 책임진다
    if (seqRef.current.get(unitId) !== mySeq) return
    const back = confirmedRef.current.get(unitId) ?? initialReads[unitId] ?? 0
    latestRef.current = { ...latestRef.current, [unitId]: back }
    setReads(latestRef.current)
    setMessage(res.reason === 'auth' ? '로그인하면 진도가 저장돼요' : '저장하지 못했어요. 다시 시도해 주세요.')
  }

  return <ProgressContext value={{ areas, reads, message, toggle }}>{children}</ProgressContext>
}
