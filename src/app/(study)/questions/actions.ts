'use server'

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user.ts'
import { createAnswer, deleteAnswer, getAnswer, updateAnswer } from '@/lib/board/answers-db.ts'
import { createQuestion, deleteQuestion, getQuestion, updateQuestion, type WriteResult } from '@/lib/board/questions-db.ts'
import { parseId, validateAnswer, validateQuestion, type FieldErrors } from '@/lib/board/validate.ts'

export type FormState = {
  errors?: FieldErrors
  message?: string
  values?: { title: string; body: string; kind: string; key: string }
}

function text(fd: FormData, name: string): string {
  const v = fd.get(name)
  return typeof v === 'string' ? v : ''
}

function readValues(fd: FormData): NonNullable<FormState['values']> {
  return { title: text(fd, 'title'), body: text(fd, 'body'), kind: text(fd, 'kind'), key: text(fd, 'key') }
}

function failState(reason: Exclude<WriteResult, { ok: true }>['reason'], values: FormState['values']): FormState {
  switch (reason) {
    case 'auth':
      return { message: '로그인이 필요해요.', values }
    case 'notag':
      return { errors: { tag: '없는 조문이에요.' }, values }
    case 'forbidden':
      return { message: '내 글만 고칠 수 있어요.', values }
    case 'notfound':
      return { message: '글을 찾을 수 없어요.', values }
    default:
      return { message: '입력을 확인해 주세요.', values }
  }
}

export async function createQuestionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = readValues(formData)
  const user = await getCurrentUser()
  if (!user) return { message: '로그인이 필요해요.', values }
  const v = validateQuestion(values)
  if (!v.ok) return { errors: v.errors, values }
  const r = await createQuestion(user.id, v.value)
  if (!r.ok) return failState(r.reason, values)
  redirect(`/questions/${r.id}`)
}

export async function updateQuestionAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = readValues(formData)
  const user = await getCurrentUser()
  if (!user) return { message: '로그인이 필요해요.', values }
  const qid = parseId(id)
  if (!qid) return failState('notfound', values)
  const v = validateQuestion(values)
  if (!v.ok) return { errors: v.errors, values }
  const r = await updateQuestion(user.id, qid, v.value)
  if (!r.ok) return failState(r.reason, values)
  redirect(`/questions/${qid}`)
}

export async function deleteQuestionAction(id: string): Promise<void> {
  const user = await getCurrentUser()
  const qid = parseId(id)
  if (!user || !qid) redirect('/questions')
  const r = await deleteQuestion(user.id, qid)
  if (!r.ok) redirect(`/questions/${qid}`)
  redirect(r.mode === 'hard' ? '/questions' : `/questions/${qid}`)
}

export async function createAnswerAction(
  questionId: string,
  _prev: { error?: string; value?: string },
  formData: FormData,
): Promise<{ error?: string; value?: string }> {
  const value = text(formData, 'body')
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요해요.', value }
  const qid = parseId(questionId)
  if (!qid) return { error: '글을 찾을 수 없어요.', value }
  const v = validateAnswer(value)
  if (!v.ok) return { error: v.error, value }
  const r = await createAnswer(user.id, qid, v.value)
  if (!r.ok) return { error: failState(r.reason, undefined).message, value }
  redirect(`/questions/${qid}`)
}

export async function updateAnswerAction(
  answerId: string,
  _prev: { error?: string; value?: string },
  formData: FormData,
): Promise<{ error?: string; value?: string }> {
  const value = text(formData, 'body')
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요해요.', value }
  const aid = parseId(answerId)
  if (!aid) return { error: '글을 찾을 수 없어요.', value }
  const v = validateAnswer(value)
  if (!v.ok) return { error: v.error, value }
  const r = await updateAnswer(user.id, aid, v.value)
  if (!r.ok) return { error: failState(r.reason, undefined).message, value }
  // Ruling R2: 질문 id는 답변에서 다시 읽는다.
  const a = await getAnswer(aid)
  redirect(a ? `/questions/${a.questionId}` : '/questions')
}

export async function deleteAnswerAction(answerId: string): Promise<void> {
  const user = await getCurrentUser()
  const aid = parseId(answerId)
  if (!user || !aid) redirect('/questions')
  const r = await deleteAnswer(user.id, aid)
  if (!r.ok) redirect('/questions')
  // 소프트 삭제된 질문의 마지막 답변을 지우면 질문 상세가 404가 되므로 목록으로 보낸다.
  redirect((await getQuestion(r.questionId)) ? `/questions/${r.questionId}` : '/questions')
}
