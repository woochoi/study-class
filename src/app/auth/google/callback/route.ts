import { NextResponse, type NextRequest } from 'next/server'
import { handleGoogleCallback } from '@/lib/auth/callback.ts'
import { OAUTH_COOKIE } from '@/lib/auth/oauth-cookie.ts'
import { appUrl } from '@/lib/env.ts'
import { SESSION_COOKIE } from '@/lib/auth/session.ts'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const oauthCookie = request.cookies.get(OAUTH_COOKIE)?.value

  const result = await handleGoogleCallback({
    code: url.searchParams.get('code'),
    state: url.searchParams.get('state'),
    oauthCookie,
  })

  const res = NextResponse.redirect(new URL(result.redirectTo, appUrl()), 303)
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
