'use server'

import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { buildAuthUrl, createPkcePair } from '@/lib/auth/google.ts'
import { appUrl, requiredEnv } from '@/lib/env.ts'
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_MAX_AGE_SECONDS,
  encodeOAuthCookie,
  safeReturnTo,
} from '@/lib/auth/oauth-cookie.ts'
import { SESSION_COOKIE, deleteSession } from '@/lib/auth/session.ts'

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const raw = formData.get('returnTo')
  const returnTo = safeReturnTo(typeof raw === 'string' ? raw : null)
  const state = randomBytes(16).toString('base64url')
  const { verifier, challenge } = createPkcePair()

  ;(await cookies()).set(OAUTH_COOKIE, encodeOAuthCookie({ state, verifier, returnTo }), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  })

  redirect(
    buildAuthUrl({
      clientId: requiredEnv('GOOGLE_CLIENT_ID'),
      redirectUri: `${appUrl()}/auth/google/callback`,
      state,
      codeChallenge: challenge,
    }),
  )
}

export async function signOut(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await deleteSession(token)
  jar.delete(SESSION_COOKIE)
  redirect('/')
}
