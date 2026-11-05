export type DbTarget = 'local' | 'neon'

export const POOL_OPTIONS = {
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
}

const WEAK_SSLMODES = new Set(['prefer', 'require', 'verify-ca'])

// pg는 sslmode=require 등을 verify-full로 바꿀 예정이라며 경고를 낸다.
// 의미가 같은 verify-full로 미리 바꿔 경고를 없애고 인증서 검증을 명시한다.
export function normalizeConnectionString(url: string): string {
  let mode: string | null
  try {
    mode = new URL(url).searchParams.get('sslmode')
  } catch {
    return url
  }
  if (mode === null || !WEAK_SSLMODES.has(mode)) return url
  return url.replace(/([?&]sslmode=)[^&#]*/, '$1verify-full')
}

// 잘못된 문자열이면 Node의 ERR_INVALID_URL이 입력 원문(비밀번호 포함)을 달고 던져지므로,
// 입력도 cause도 없는 오류로 바꿔 던진다.
function parseUrl(url: string): URL {
  try {
    return new URL(url)
  } catch {
    throw new Error('DATABASE_URL을 해석할 수 없습니다.')
  }
}

export function dbHost(url: string): string {
  return parseUrl(url).hostname
}

function isNeonHost(host: string): boolean {
  return host.endsWith('.neon.tech')
}

export function assertTarget(url: string, target: DbTarget): string {
  const host = dbHost(url)
  if (target === 'local' && isNeonHost(host)) {
    throw new Error(
      `로컬 명령이 Neon DB(${host})에 접속하려 합니다. .env의 DATABASE_URL을 확인하세요.`,
    )
  }
  if (target === 'neon' && !isNeonHost(host)) {
    throw new Error(
      `운영 명령의 대상이 Neon이 아닙니다(${host}). .env.neon의 DATABASE_URL을 확인하세요.`,
    )
  }
  return host
}
