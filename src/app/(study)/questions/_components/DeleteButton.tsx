'use client'

export default function DeleteButton({
  action,
  label = '삭제',
  confirmMessage = '삭제할까요?',
}: {
  action: () => Promise<void>
  label?: string
  confirmMessage?: string
}) {
  return (
    <form
      action={action}
      className="inline-form"
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault()
      }}
    >
      <button type="submit" className="btn-danger">
        {label}
      </button>
    </form>
  )
}
