import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user.ts'
import { getQuestion } from '@/lib/board/questions-db.ts'
import { formatBoardTime, formatTag } from '@/lib/board/format.ts'
import { parseId } from '@/lib/board/validate.ts'
import { createAnswerAction, deleteAnswerAction, deleteQuestionAction } from '../actions.ts'
import AnswerForm from '../_components/AnswerForm.tsx'
import DeleteButton from '../_components/DeleteButton.tsx'
import '../board.css'

export const instant = false

export default async function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id)
  if (!id) notFound()
  await connection()
  const q = await getQuestion(id)
  if (!q) notFound()
  const user = await getCurrentUser()
  const mine = !!user && user.id === q.authorId
  const edited = new Date(q.updatedAt).getTime() > new Date(q.createdAt).getTime()

  return (
    <section className="panel">
      <div className="board-head">
        <Link href="/questions">← 목록으로</Link>
      </div>
      <article className="q-detail">
        <div className="q-title">
          {!q.deleted && q.tag && (
            <Link className="badge" href={`/articles/${q.tag.kind}/${encodeURIComponent(q.tag.key)}`}>
              {formatTag(q.tag)}
            </Link>
          )}
          <h2 className={q.deleted ? 'deleted' : undefined}>{q.deleted ? '삭제된 질문입니다' : q.title}</h2>
        </div>
        <div className="q-meta">
          {q.authorName} · {formatBoardTime(q.createdAt)}
          {edited && !q.deleted && ' (수정됨)'}
        </div>
        {!q.deleted && <div className="body-text">{q.body}</div>}
        {mine && !q.deleted && (
          <div className="actions">
            <Link href={`/questions/${q.id}/edit`} className="btn-sub">
              수정
            </Link>
            <DeleteButton action={deleteQuestionAction.bind(null, q.id)} />
            {q.answers.length > 0 && <span className="hint">답변이 있어 내용만 지워지고 답변은 남아요.</span>}
          </div>
        )}
      </article>

      <h3 className="answers-head">답변 {q.answers.length}개</h3>
      <ul className="a-list">
        {q.answers.map((a) => (
          <li key={a.id} id={`answer-${a.id}`} className="a-row">
            <div className="q-meta">
              {a.authorName} · {formatBoardTime(a.createdAt)}
              {new Date(a.updatedAt).getTime() > new Date(a.createdAt).getTime() && ' (수정됨)'}
            </div>
            <div className="body-text">{a.body}</div>
            {user && user.id === a.authorId && (
              <div className="actions">
                <Link href={`/questions/answers/${a.id}/edit`} className="btn-sub">
                  수정
                </Link>
                <DeleteButton action={deleteAnswerAction.bind(null, a.id)} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {!q.deleted &&
        (user ? (
          <AnswerForm action={createAnswerAction.bind(null, q.id)} initial="" submitLabel="답변 등록" id="answer-body" />
        ) : (
          <p className="hint">로그인하면 답변할 수 있어요.</p>
        ))}
    </section>
  )
}
