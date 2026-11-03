import { getCurrentUser } from '@/lib/auth/current-user.ts'
import ReturnToInput from './ReturnToInput'
import { signInWithGoogle, signOut } from '@/app/auth/actions.ts'

export default async function AuthStatus() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <form action={signInWithGoogle}>
        <ReturnToInput />
        <button type="submit" className="rounded border px-3 py-1 text-sm">
          구글로 로그인
        </button>
      </form>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" width={24} height={24} className="rounded-full" referrerPolicy="no-referrer" />
      ) : null}
      <span>{user.displayName}</span>
      <form action={signOut}>
        <button type="submit" className="rounded border px-3 py-1">
          로그아웃
        </button>
      </form>
    </div>
  )
}
