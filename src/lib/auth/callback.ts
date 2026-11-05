import 'server-only'
import { exchangeCode } from './google.ts'
import { upsertGoogleUser } from './users.ts'
import { createSession } from './session.ts'
import { appUrl, requiredEnv } from '../env.ts'
import { decodeOAuthCookie, safeReturnTo } from './oauth-cookie.ts'

export type CallbackResult =
  | { ok: true; token: string; expiresAt: Date; redirectTo: string }
  | { ok: false; redirectTo: '/?login_error=1' }

const FAILED: CallbackResult = { ok: false, redirectTo: '/?login_error=1' }

export async function handleGoogleCallback(input: {
  code: string | null
  state: string | null
  oauthCookie: string | undefined
  deps?: { exchange?: typeof exchangeCode; log?: (msg: string) => void }
}): Promise<CallbackResult> {
  const exchange = input.deps?.exchange ?? exchangeCode
  const log = input.deps?.log ?? console.error
  try {
    const saved = decodeOAuthCookie(input.oauthCookie)
    if (!saved) {
      log('google callback: missing or invalid oauth cookie')
      return FAILED
    }
    if (!input.code || !input.state || input.state !== saved.state) {
      log('google callback: missing code or state mismatch')
      return FAILED
    }
    const profile = await exchange({
      code: input.code,
      verifier: saved.verifier,
      clientId: requiredEnv('GOOGLE_CLIENT_ID'),
      clientSecret: requiredEnv('GOOGLE_CLIENT_SECRET'),
      redirectUri: `${appUrl()}/auth/google/callback`,
    })
    const user = await upsertGoogleUser(profile)
    const { token, expiresAt } = await createSession(user.id)
    return { ok: true, token, expiresAt, redirectTo: safeReturnTo(saved.returnTo) }
  } catch (e) {
    log('google callback failed: ' + (e instanceof Error ? e.message : 'unknown error'))
    return FAILED
  }
}
