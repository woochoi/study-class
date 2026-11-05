import { Suspense } from 'react'
import { connection } from 'next/server'
import { query } from '../../lib/db.ts'

async function DbStatus() {
  await connection() // 요청 시점에만 DB 조회 (빌드 중 prerender 제외)
  const r = await query<{ ok: number }>('SELECT 1 AS ok')
  return <p>DB 연결: {r.rows[0].ok === 1 ? 'OK' : 'FAIL'}</p>
}

export default function HealthPage() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-bold">Health</h1>
      <Suspense fallback={<p>DB 확인 중...</p>}>
        <DbStatus />
      </Suspense>
    </main>
  )
}
