import 'server-only'
import { cache } from 'react'
import { getCurrentUser } from '../auth/current-user.ts'
import { getUserProgress } from './queries.ts'
import type { UserProgress } from './types.ts'

/** 로그인 사용자의 진도(비로그인이면 null). 한 요청 안에서 한 번만 읽는다. */
export const getCurrentProgress = cache(async (): Promise<{ loggedIn: boolean; progress: UserProgress }> => {
  const user = await getCurrentUser()
  if (!user) return { loggedIn: false, progress: { reads: {}, levels: {}, examDate: null } }
  return { loggedIn: true, progress: await getUserProgress(user.id) }
})
