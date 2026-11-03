import Link from 'next/link'
import { connection } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user.ts'
import { formatTag } from '@/lib/board/format.ts'
import { parseTag } from '@/lib/board/validate.ts'
import { createQuestionAction } from '../actions.ts'
import QuestionForm from '../_components/QuestionForm.tsx'
import '../board.css'

export const instant = false

type SP = { [k: string]: string | string[] | undefined }

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function NewQuestionPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const tag = parseTag(first(sp.kind), first(sp.key))
  await connection()
  const user = await getCurrentUser()
  return (
    <section className="panel">
      <div className="board-head">
        <h2>{tag ? `${formatTag(tag)}에 대한 질문` : '질문하기'}</h2>
        {tag ? (
          <Link href={`/articles/${tag.kind}/${encodeURIComponent(tag.key)}`}>← 3단 화면으로</Link>
        ) : (
          <Link href="/questions">← 목록으로</Link>
        )}
      </div>
      {user ? (
        <QuestionForm
          action={createQuestionAction}
          initial={{ title: '', body: '', kind: tag?.kind ?? '', key: tag?.key ?? '' }}
          submitLabel="질문 올리기"
        />
      ) : (
        <p className="hint">로그인하면 질문할 수 있어요.</p>
      )}
    </section>
  )
}
