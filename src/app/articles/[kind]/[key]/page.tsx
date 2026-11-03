import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import ArticleRefText from '@/app/_components/ArticleRefText.tsx'
import { formatArticleKey } from '@/lib/law/article-key.ts'
import { getThreeTier, parseArticleParams, type ArticleView } from '@/lib/law/three-tier.ts'
import { countQuestionsForTag } from '@/lib/board/questions-db.ts'
import type { DocKind } from '@/lib/law/types.ts'
import '@/app/(study)/study.css'
import './article.css'

// 존재하지 않는 조문은 스트리밍 전에 판단해 진짜 404 상태 코드를 돌려주기 위해 블로킹 렌더를 허용한다.
export const instant = false

const HEAD: Record<DocKind, string> = {
  law: '법률',
  decree: '시행령',
  notice: '고시 · 개인정보의 안전성 확보조치 기준',
}
const EMPTY: Record<DocKind, string> = { law: '법률 조문 없음', decree: '시행령 조문 없음', notice: '고시 조문 없음' }

function dotDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}. ${m}. ${d}.`
}

function Card({ a, column, current }: { a: ArticleView; column: DocKind; current: boolean }) {
  return (
    <article className={current ? 'tier-card current' : 'tier-card'}>
      <h3>
        {formatArticleKey(a.key)}({a.title})
      </h3>
      {a.doc.isUpcoming && <p className="upcoming">🔜 {dotDate(a.doc.effectiveOn)} 시행</p>}
      <div className="tier-body">
        {(a.body ?? '').split('\n').map((line, i) => (
          <div key={i}>
            <ArticleRefText text={line} kind={column} />
          </div>
        ))}
      </div>
    </article>
  )
}

export default async function ArticlePage({ params }: { params: Promise<{ kind: string; key: string }> }) {
  const raw = await params
  const parsed = parseArticleParams(raw.kind, raw.key)
  if (!parsed) notFound()
  // DB 읽기는 요청 시점에 실행
  await connection()
  const t = await getThreeTier(parsed.kind, parsed.key)
  if (!t) notFound()
  const questionCount = await countQuestionsForTag({ kind: t.entry.kind, key: t.entry.key })
  const tagQuery = `kind=${t.entry.kind}&key=${encodeURIComponent(t.entry.key)}`
  const cols: { kind: DocKind; items: ArticleView[] }[] = [
    { kind: 'law', items: t.law },
    { kind: 'decree', items: t.decree },
    { kind: 'notice', items: t.notice },
  ]
  const docs = new Map<string, ArticleView['doc'] & { kind: DocKind }>()
  for (const c of cols)
    for (const a of c.items) docs.set(`${a.kind}:${a.doc.promulgationNo}`, { ...a.doc, kind: a.kind })
  const fetched = [...docs.values()]
    .map((d) => d.fetchedAt)
    .filter((x): x is string => !!x)
    .sort()
    .at(-1)
  return (
    <div className="study">
      <div className="wrap">
        <p>
          <Link href="/">← 처음으로</Link>
        </p>
        <h1>
          {formatArticleKey(t.entry.key)}({t.entry.title})
        </h1>
        <div className="tiers">
          {cols.map((c) => (
            <section key={c.kind} className="tier-col">
              <h2>{HEAD[c.kind]}</h2>
              {c.items.length === 0 ? (
                <p className="hint">{EMPTY[c.kind]}</p>
              ) : (
                c.items.map((a) => <Card key={a.id} a={a} column={c.kind} current={a.id === t.entry.id} />)
              )}
            </section>
          ))}
        </div>
        <section className="box meta">
          <h2>기준 법령</h2>
          <ul>
            {[...docs.values()].map((d) => (
              <li key={`${d.kind}:${d.promulgationNo}`}>
                {d.title} · {d.promulgationNo} · {dotDate(d.effectiveOn)} 시행{d.isUpcoming ? ' (시행 예정)' : ''}
              </li>
            ))}
          </ul>
          <p>
            <Link href={`/questions/new?${tagQuery}`}>이 조문에 대해 질문하기</Link>
            {questionCount > 0 && (
              <>
                {' · '}
                <Link href={`/questions?${tagQuery}`}>이 조문 질문 {questionCount}개 보기</Link>
              </>
            )}
          </p>
          <h3>관련 결정문</h3>
          <p className="hint">준비 중이에요</p>
          <p className="hint">출처: 법제처 국가법령정보센터{fetched ? ` · 받아 온 날짜 ${fetched}` : ''}</p>
        </section>
      </div>
    </div>
  )
}
