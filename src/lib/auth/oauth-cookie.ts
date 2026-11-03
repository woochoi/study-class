import 'server-only'

export const OAUTH_COOKIE = 'sc_oauth'
export const OAUTH_COOKIE_MAX_AGE_SECONDS = 600

export type OAuthCookieValue = { state: string; verifier: string; returnTo: string }

export function encodeOAuthCookie(v: OAuthCookieValue): string {
  return Buffer.from(JSON.stringify(v), 'utf8').toString('base64url')
}

export function decodeOAuthCookie(raw: string | undefined): OAuthCookieValue | null {
  if (!raw) return null
  try {
    const v: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (typeof v !== 'object' || v === null) return null
    const o = v as Record<string, unknown>
    if (typeof o.state !== 'string' || typeof o.verifier !== 'string' || typeof o.returnTo !== 'string') {
      return null
    }
    return { state: o.state, verifier: o.verifier, returnTo: o.returnTo }
  } catch {
    return null
  }
}

export function safeReturnTo(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/'
  return raw
}
