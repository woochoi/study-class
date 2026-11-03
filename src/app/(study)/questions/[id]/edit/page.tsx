import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user.ts'
import { getQuestion } from '@/lib/board/questions-db.ts'
import { parseId } from '@/lib/board/validate.ts'
import { updateQuestionAction } from '../../actions.ts'
import QuestionForm from '../../_components/QuestionForm.tsx'
import '../../board.css'

export const instant = false

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id)
  if (!id) notFound()
  await connection()
  const user = await getCurrentUser()
  const q = await getQuestion(id)
  if (!user || !q || q.deleted || q.authorId !== user.id) notFound()
  return (
    <section className="panel">
      <div className="board-head">
        <h2>질문 수정</h2>
        <Link href={`/questions/${q.id}`}>← 돌아가기</Link>
      </div>
      <QuestionForm
        action={updateQuestionAction.bind(null, q.id)}
        initial={{ title: q.title ?? '', body: q.body ?? '', kind: q.tag?.kind ?? '', key: q.tag?.key ?? '' }}
        submitLabel="저장"
      />
    </section>
  )
}
