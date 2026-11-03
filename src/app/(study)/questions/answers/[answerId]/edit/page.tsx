import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user.ts'
import { getAnswer } from '@/lib/board/answers-db.ts'
import { parseId } from '@/lib/board/validate.ts'
import { updateAnswerAction } from '../../../actions.ts'
import AnswerForm from '../../../_components/AnswerForm.tsx'
import '../../../board.css'

export const instant = false

export default async function EditAnswerPage({ params }: { params: Promise<{ answerId: string }> }) {
  const aid = parseId((await params).answerId)
  if (!aid) notFound()
  await connection()
  const user = await getCurrentUser()
  const a = await getAnswer(aid)
  if (!user || !a || a.authorId !== user.id) notFound()
  return (
    <section className="panel">
      <div className="board-head">
        <h2>답변 수정</h2>
        <Link href={`/questions/${a.questionId}`}>← 돌아가기</Link>
      </div>
      <AnswerForm action={updateAnswerAction.bind(null, a.id)} initial={a.body} submitLabel="저장" id="answer-edit-body" />
    </section>
  )
}
