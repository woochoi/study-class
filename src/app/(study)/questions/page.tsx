import Link from 'next/link'
import { connection } from 'next/server'
import { listQuestions } from '@/lib/board/questions-db.ts'
import { formatBoardTime, formatTag } from '@/lib/board/format.ts'
import { PAGE_SIZE, parsePage, parseTag } from '@/lib/board/validate.ts'
import './board.css'

export const instant = false

type SP = { [k: string]: string | string[] | undefined }

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const page = parsePage(first(sp.page))
  const kindRaw = first(sp.kind)
  const keyRaw = first(sp.key)
  const tag = parseTag(kindRaw, keyRaw)
  const badTag = !tag && (kindRaw !== undefined || keyRaw !== undefined)
  await connection()
  const { items, total } = await listQuestions({ page, tag })
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const q = (p: number) => {
    const u = new URLSearchParams()
    if (tag) {
      u.set('kind', tag.kind)
      u.set('key', tag.key)
    }
    if (p > 1) u.set('page', String(p))
    const s = u.toString()
    return s ? `/questions?${s}` : '/questions'
  }
  const newHref = tag ? `/questions/new?kind=${tag.kind}&key=${encodeURIComponent(tag.key)}` : '/questions/new'

  return (
    <section className="panel">
      <div className="board-head">
        <h2>문의 게시판</h2>
        <Link href={newHref} className="btn-link">
          질문하기
        </Link>
      </div>
      {badTag && <p className="notice">조문 태그를 알아볼 수 없어 전체 목록을 보여 드려요.</p>}
      {tag && (
        <p className="hint">
          {formatTag(tag)} 질문만 보는 중 · <Link href="/questions">전체 보기</Link>
        </p>
      )}
      {items.length === 0 ? (
        <p className="hint">아직 질문이 없어요.</p>
      ) : (
        <ul className="q-list">
          {items.map((it) => (
            <li key={it.id} className="q-row">
              <div className="q-title">
                {it.tag && (
                  <Link className="badge" href={`/articles/${it.tag.kind}/${encodeURIComponent(it.tag.key)}`}>
                    {formatTag(it.tag)}
                  </Link>
                )}
                <Link href={`/questions/${it.id}`} className={it.deleted ? 'deleted' : undefined}>
                  {it.deleted ? '삭제된 질문입니다' : it.title}
                </Link>
                {it.answerCount > 0 && <span className="badge answered">답변 있음</span>}
              </div>
              <div className="q-meta">
                {it.authorName} · {formatBoardTime(it.createdAt)} · 답변 {it.answerCount}
              </div>
            </li>
          ))}
        </ul>
      )}
      {lastPage > 1 && (
        <nav className="pager" aria-label="페이지 이동">
          {page > 1 ? <Link href={q(page - 1)}>이전</Link> : <span className="hint">이전</span>}
          <span className="hint">
            {page} / {lastPage}
          </span>
          {page < lastPage ? <Link href={q(page + 1)}>다음</Link> : <span className="hint">다음</span>}
        </nav>
      )}
    </section>
  )
}
