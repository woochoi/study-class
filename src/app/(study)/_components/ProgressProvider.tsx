'use client'

import { createContext, useContext, useState } from 'react'
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

  async function toggle(unitId: string, n: 1 | 2 | 3) {
    const prev = reads[unitId] ?? 0
    const next = toggleRead(prev, n)
    setReads((r) => ({ ...r, [unitId]: next }))
    setMessage(null)
    const res = await saveUnitReads(unitId, next)
    if (!res.ok) {
      setReads((r) => ({ ...r, [unitId]: prev }))
      setMessage(res.reason === 'auth' ? '로그인하면 진도가 저장돼요' : '저장하지 못했어요. 다시 시도해 주세요.')
    }
  }

  return <ProgressContext value={{ areas, reads, message, toggle }}>{children}</ProgressContext>
}
