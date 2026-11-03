import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { formatArticleKey } from '@/lib/law/article-key.ts'
import { getStudyData } from '@/lib/study/queries.ts'
import LawTable, { type LawRow } from './LawTable.tsx'

async function Loader() {
  // DB 읽기는 요청 시점에 실행 (정적 셸에 굳지 않게)
  await connection()
  const data = await getStudyData()
  const rows: LawRow[] = data.areas.flatMap((a) =>
    a.units.map((u) => ({
      areaClass: a.id,
      roman: a.roman,
      areaName: a.name,
      weight: a.weight,
      name: u.name,
      lawSummary: u.lawSummary,
      decreeSummary: u.decreeSummary,
      hay: [a.name, u.name, u.lawSummary, u.decreeSummary, ...u.leaves.map((l) => `${l.label} ${l.ref}`)].join(' '),
    })),
  )
  return (
    <div className="panel">
      <LawTable rows={rows} />
      <section className="box">
        <h2>시행령 조문 색인</h2>
        <p className="hint" style={{ marginBottom: 12 }}>
          현행 시행령 본문 장별 조 제목. 삭제 조문은 뺐습니다. 조를 누르면 조문 상세로 이동합니다.
        </p>
        <div className="chapters">
          {data.decreeChapters.map((ch) => (
            <details key={ch.label}>
              <summary>
                {ch.label} {ch.title}
                <span>{ch.articles.length}개 조</span>
              </summary>
              <ul>
                {ch.articles.map((a) => (
                  <li key={a.key}>
                    <em>
                      <Link href={`/articles/decree/${encodeURIComponent(a.key)}`}>
                        {formatArticleKey(a.key)}
                      </Link>
                    </em>
                    {a.title}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}

export default function LawsPage() {
  return (
    <Suspense fallback={<p className="hint">불러오는 중…</p>}>
      <Loader />
    </Suspense>
  )
}
