import 'server-only'
import { createHash, randomBytes } from 'node:crypto'

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

export type GoogleProfile = {
  sub: string
  email: string | null
  name: string
  picture: string | null
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export function buildAuthUrl(opts: {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
}): string {
  const u = new URL(AUTH_ENDPOINT)
  u.searchParams.set('client_id', opts.clientId)
  u.searchParams.set('redirect_uri', opts.redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', 'openid email profile')
  u.searchParams.set('state', opts.state)
  u.searchParams.set('code_challenge', opts.codeChallenge)
  u.searchParams.set('code_challenge_method', 'S256')
  u.searchParams.set('prompt', 'select_account')
  return u.toString()
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}

export async function exchangeCode(opts: {
  code: string
  verifier: string
  clientId: string
  clientSecret: string
  redirectUri: string
  fetchFn?: typeof fetch
  now?: Date
}): Promise<GoogleProfile> {
  const fetchFn = opts.fetchFn ?? fetch
  const now = opts.now ?? new Date()
  const res = await fetchFn(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: opts.code,
      code_verifier: opts.verifier,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
    }).toString(),
  })
  if (!res.ok) throw new Error(`token endpoint responded ${res.status}`)

  let claims: Record<string, unknown>
  try {
    const body = (await res.json()) as { id_token?: unknown }
    const parts = typeof body.id_token === 'string' ? body.id_token.split('.') : []
    if (parts.length !== 3) throw new Error('malformed')
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (claims === null || typeof claims !== 'object') throw new Error('malformed')
  } catch {
    throw new Error('invalid id_token')
  }

  const sub = str(claims.sub)
  if (
    !sub ||
    typeof claims.iss !== 'string' ||
    !ISSUERS.includes(claims.iss) ||
    claims.aud !== opts.clientId ||
    typeof claims.exp !== 'number' ||
    !(claims.exp * 1000 > now.getTime())
  ) {
    throw new Error('invalid id_token')
  }

  const email = str(claims.email)
  const name = str(claims.name) ?? str(email?.split('@')[0]) ?? '스터디원'
  return { sub, email, name, picture: str(claims.picture) }
}
