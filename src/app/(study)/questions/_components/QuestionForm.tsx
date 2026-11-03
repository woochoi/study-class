'use client'

import { useActionState } from 'react'
import type { FormState } from '../actions.ts'

type Values = { title: string; body: string; kind: string; key: string }

export default function QuestionForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>
  initial: Values
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState)
  const v = state.values ?? initial
  const err = state.errors ?? {}
  return (
    // React가 액션 후 폼을 defaultValue로 되돌리므로, 서버가 돌려준 값을 defaultValue로 써서 입력을 유지한다.
    <form action={formAction} className="board-form">
      {state.message && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}
      <label htmlFor="q-title">
        제목
        <input id="q-title" name="title" defaultValue={v.title} maxLength={200} required aria-invalid={!!err.title} />
      </label>
      {err.title && (
        <p className="form-error" role="alert">
          {err.title}
        </p>
      )}
      <label htmlFor="q-body">
        내용
        <textarea id="q-body" name="body" defaultValue={v.body} maxLength={5000} rows={10} required aria-invalid={!!err.body} />
      </label>
      {err.body && (
        <p className="form-error" role="alert">
          {err.body}
        </p>
      )}
      <fieldset className="tag-field">
        <legend>조문 태그 (선택)</legend>
        <select name="kind" defaultValue={v.kind} aria-label="조문 종류">
          <option value="">없음</option>
          <option value="law">법</option>
          <option value="decree">영</option>
          <option value="notice">고시</option>
        </select>
        <input name="key" defaultValue={v.key} placeholder="예: 29, 24의2" aria-label="조문 번호" maxLength={20} />
      </fieldset>
      {err.tag && (
        <p className="form-error" role="alert">
          {err.tag}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? '저장 중…' : submitLabel}
      </button>
    </form>
  )
}
