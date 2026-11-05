export type RequiredEnvName = 'APP_URL' | 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET'

// 호출 시점에 읽는다(모듈 최상위에서 읽으면 환경 변수 없는 빌드가 깨진다).
export function requiredEnv(name: RequiredEnvName): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} 환경 변수가 비어 있습니다.`)
  return value
}

export function appUrl(): string {
  return requiredEnv('APP_URL').replace(/\/+$/, '')
}
