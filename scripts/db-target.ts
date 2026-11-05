import { assertTarget, normalizeConnectionString, type DbTarget } from '../src/lib/db-config.ts'

// 스크립트가 접속할 DB를 DB_TARGET(local 기본, neon)과 DATABASE_URL 호스트로 검증한다.
export function resolveScriptDb(env: Record<string, string | undefined>): { url: string; host: string; target: DbTarget } {
  const raw = env.DATABASE_URL
  if (!raw) throw new Error('DATABASE_URL is not set')
  const t = env.DB_TARGET ?? 'local'
  if (t !== 'local' && t !== 'neon') {
    throw new Error(`DB_TARGET은 local 또는 neon이어야 합니다(받은 값: ${t}).`)
  }
  const host = assertTarget(raw, t)
  return { url: normalizeConnectionString(raw), host, target: t }
}
