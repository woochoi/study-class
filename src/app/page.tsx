import { Suspense } from 'react'

async function LoginError({ searchParams }: { searchParams: PageProps<'/'>['searchParams'] }) {
  const { login_error } = await searchParams
  if (!login_error) return null
  return (
    <p role="alert" className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
      로그인에 실패했어요. 다시 시도해 주세요.
    </p>
  )
}

export default function Home(props: PageProps<'/'>) {
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">ISMS-P 스터디 까페</h1>
      <Suspense>
        <LoginError searchParams={props.searchParams} />
      </Suspense>
    </main>
  )
}
