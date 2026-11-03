import { readFile, writeFile } from 'node:fs/promises'
import vm from 'node:vm'

// 선언 `const NAME=` 의 초기값 구간만 잘라(문자열/주석을 건너뛰며 깊이 0의 `;`까지) 평가한다.
function sliceInitializer(src: string, name: string): string {
  const m = new RegExp(`^[ \\t]*const ${name}\\s*=`, 'm').exec(src)
  if (!m) throw new Error(`const ${name} not found`)
  const start = m.index + m[0].length
  let depth = 0
  let i = start
  while (i < src.length) {
    const ch = src[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      i++
      while (src[i] !== ch) {
        if (src[i] === '\\') i++
        i++
      }
    } else if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
    } else if (ch === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i + 2) + 1
    } else if (ch === '[' || ch === '(' || ch === '{') {
      depth++
    } else if (ch === ']' || ch === ')' || ch === '}') {
      depth--
    } else if (ch === ';' && depth === 0) {
      return src.slice(start, i)
    }
    i++
  }
  throw new Error(`end of ${name} not found`)
}

function evalNames(src: string, names: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const n of names) {
    const value = vm.runInNewContext(`(${sliceInitializer(src, n)})`, Object.create(null))
    // 다른 realm의 배열/객체를 일반 JSON으로 정규화
    out[n] = JSON.parse(JSON.stringify(value))
  }
  return out
}

const root = new URL('../', import.meta.url)
const lawSrc = await readFile(new URL('CPPG 법령 허브.html', root), 'utf8')
const decreeSrc = await readFile(new URL('CPPG 시행령 허브.html', root), 'utf8')

const law = evalNames(lawSrc, ['AREAS', 'ANCHORS', 'MNEMO', 'CARDS', 'HISTORY'])
const decree = evalNames(decreeSrc, ['DOMAINS', 'DECREE', 'TIMELINE'])

await writeFile(new URL('db/seed/hub-law.json', root), JSON.stringify(law, null, 1) + '\n')
await writeFile(new URL('db/seed/hub-decree.json', root), JSON.stringify(decree, null, 1) + '\n')

const len = (o: Record<string, unknown>, k: string) => (o[k] as unknown[]).length
console.log(
  `hub-law.json: AREAS=${len(law, 'AREAS')} ANCHORS=${len(law, 'ANCHORS')} MNEMO=${len(law, 'MNEMO')} CARDS=${len(law, 'CARDS')} HISTORY=${len(law, 'HISTORY')}`,
)
console.log(
  `hub-decree.json: DOMAINS=${len(decree, 'DOMAINS')} DECREE=${len(decree, 'DECREE')} TIMELINE=${len(decree, 'TIMELINE')}`,
)
