import { assertTarget } from '../src/lib/db-config.ts'

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is not set')
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
// 테스트는 로컬 DB에만 접속한다(Neon이면 시작 전에 멈춘다).
assertTarget(process.env.DATABASE_URL, 'local')
