'use client'

import { useActionState } from 'react'

type State = { error?: string; value?: string }

export default function AnswerForm({
  action,
  initial,
  submitLabel,
  id,
}: {
  action: (prev: State, fd: FormData) => Promise<State>
  initial: string
  submitLabel: string
  id: string
}) {
  const [state, formAction, pending] = useActionState(action, {} as State)
  return (
    <form action={formAction} className="board-form">
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <label htmlFor={id}>답변 내용</label>
      <textarea
        id={id}
        name="body"
        defaultValue={state.value ?? initial}
        maxLength={5000}
        rows={6}
        required
        aria-invalid={!!state.error}
      />
      <button type="submit" disabled={pending}>
        {pending ? '저장 중…' : submitLabel}
      </button>
    </form>
  )
}
