/** 조 키: 가지번호 없으면 '24', 있으면 '24의2'. */

function stripZeros(s: string): string {
  const n = s.trim().replace(/^0+/, '')
  return n === '' ? '0' : n
}

export function articleKeyFromParts(no: string, branch?: string | null): string {
  const base = stripZeros(String(no))
  const b = branch == null ? '' : stripZeros(String(branch))
  return b === '' || b === '0' ? base : `${base}의${b}`
}

export function formatArticleKey(key: string): string {
  const [no, branch] = key.split('의')
  return branch ? `제${no}조의${branch}` : `제${no}조`
}

/** '제24조의2(주민…)' → '24의2'. 조문이 아니면 null. */
export function parseArticleKey(text: string): string | null {
  const m = /^\s*제(\d+)조(?:의(\d+))?/.exec(text)
  return m ? articleKeyFromParts(m[1], m[2]) : null
}

function split(key: string): [number, number] {
  const [no, branch] = key.split('의')
  return [Number(no), branch ? Number(branch) : 0]
}

export function compareArticleKeys(a: string, b: string): number {
  const [an, ab] = split(a)
  const [bn, bb] = split(b)
  return an - bn || ab - bb
}
