import { NextResponse } from 'next/server'
import { handleGoogleCallback } from '@/lib/auth/callback.ts'
import { OAUTH_COOKIE } from '@/lib/auth/oauth-cookie.ts'
import { SESSION_COOKIE } from '@/lib/auth/session.ts'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const oauthCookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(OAUTH_COOKIE + '='))
    ?.slice(OAUTH_COOKIE.length + 1)

  const result = await handleGoogleCallback({
    code: url.searchParams.get('code'),
    state: url.searchParams.get('state'),
    oauthCookie,
  })

  const res = NextResponse.redirect(new URL(result.redirectTo, process.env.APP_URL), 303)
  if (result.ok) {
    res.cookies.set(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: result.expiresAt,
      secure: process.env.NODE_ENV === 'production',
    })
  }
  res.cookies.delete(OAUTH_COOKIE)
  return res
}
