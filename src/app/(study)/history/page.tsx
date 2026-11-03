import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import ArticleRefText from '@/app/_components/ArticleRefText.tsx'
import { formatArticleKey } from '@/lib/law/article-key.ts'
import { getStudyData } from '@/lib/study/queries.ts'
import type { HistoryEvent } from '@/lib/study/types.ts'

function Timeline({ events }: { events: HistoryEvent[] }) {
  return (
    <ol className="tl">
      {events.map((h) => (
        <li key={`${h.docKind}-${h.dateLabel}-${h.title}`} className={h.isKey ? 'key' : undefined}>
          <div className="yr">{h.dateLabel}</div>
          <div className="ev">
            <b>{h.title}</b>
            <span>
              <ArticleRefText text={h.summary} kind={h.docKind} />
            </span>
            {h.articleKeys.length > 0 && (
              <div className="ch">
                {h.articleKeys.map((k) => (
                  <em key={k}>
                    <Link href={`/articles/${h.docKind}/${encodeURIComponent(k)}`}>{formatArticleKey(k)}</Link>
                  </em>
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

async function Loader() {
  // DB 읽기는 요청 시점에 실행 (정적 셸에 굳지 않게)
  await connection()
  const { history } = await getStudyData()
  const law = history.filter((h) => h.docKind === 'law')
  const decree = history.filter((h) => h.docKind === 'decree')
  return (
    <section className="panel">
      <div className="box">
        <h3>부칙으로 보는 개정 흐름</h3>
        <p className="hint" style={{ marginBottom: 14 }}>
          ● 표시는 시험에서 배경으로 자주 묻는 큰 개정입니다. 오른쪽 태그는 부칙이 직접 언급한 본문 조문입니다.
        </p>
        <Timeline events={law} />
      </div>
      {decree.length > 0 && (
        <div className="box">
          <h3>꼭 볼 부칙</h3>
          <p className="hint" style={{ marginBottom: 14 }}>시행령 부칙 가운데 시험에 자주 나오는 것입니다.</p>
          <Timeline events={decree} />
        </div>
      )}
    </section>
  )
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<p className="hint">불러오는 중…</p>}>
      <Loader />
    </Suspense>
  )
}
