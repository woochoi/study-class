import pg from 'pg'
import { fetchAllLawSources } from './law-sources.ts'
import { saveLawData } from '../src/lib/law/sync.ts'

const oc = process.env.LAW_API_OC
if (!oc) {
  console.error('LAW_API_OC가 설정되지 않았습니다. open.law.go.kr에서 OC를 발급받아 .env에 LAW_API_OC=... 로 추가하세요.')
  process.exit(1)
}
const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const fetchJson = async (u: string): Promise<unknown> => {
  const res = await fetch(u)
  if (!res.ok) throw new Error(`law api http ${res.status}`)
  return res.json()
}

const data = await fetchAllLawSources(fetchJson, oc)
const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  const r = await saveLawData(client, data, new Date())
  console.log(`documents ${r.documents}, articles ${r.articles}, links ${r.links}`)
  console.log(`skipped links ${r.skippedLinks}`)
} finally {
  await client.end()
}
