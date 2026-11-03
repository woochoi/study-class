import { parseArticleKey } from './article-key.ts'
import type { ParsedArticle, ParsedChapter, ParsedDocument } from './types.ts'
import { asList, asRec, isoDate, optStr, parseChapterHeading, shapeError, str } from './shape.ts'

const MOK = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하']
const ITEM_RE = /(\d{1,2})\.(?!\d)\s*|([가-하])\.(?=\s)\s*/g

/** 한 줄(항) 안에서 호(1.) / 목(가.) 앞에 줄바꿈과 들여쓰기를 넣는다. */
function splitItems(line: string): string {
  const hasEachMok = line.includes('각 목')
  let n = 0 // 현재 호 번호 (0 = 아직 호 없음)
  let m = 0 // 현재 줄의 목 진행 수
  let out = ''
  let pos = 0
  for (const match of line.matchAll(ITEM_RE)) {
    const start = match.index
    const before = line.slice(0, start)
    const prev = start > 0 ? line[start - 1] : ''
    let prefix: string | null = null
    if (match[1] !== undefined) {
      const d = Number(match[1])
      const glued = prev !== '' && !/[\d.\s]/.test(prev)
      const afterSentence = /다[.:]\s*$/.test(before)
      if (n === 0 ? d === 1 && afterSentence : d === n + 1 && (glued || afterSentence)) {
        n = d
        m = 0
        prefix = `\n  ${d}. `
      }
    } else if ((n > 0 || hasEachMok) && prev !== '' && !/\s/.test(prev) && match[2] === MOK[m]) {
      m++
      prefix = `\n    ${match[2]}. `
    }
    if (prefix === null) continue
    out += line.slice(pos, start).trimEnd() + prefix
    pos = start + match[0].length
  }
  return out + line.slice(pos)
}

/** 고시 조문은 한 줄 문자열이라 ①, 1., 가. 앞에서 줄바꿈을 복원한다. */
function formatBody(text: string): string {
  return text
    .trim()
    .replace(/\s*([①-⑳])/g, '\n$1')
    .split('\n')
    .map(splitItems)
    .join('\n')
}

function titleOf(text: string): string {
  const m = /^\s*제\d+조(?:의\d+)?\(([^)]*)\)/.exec(text)
  return m ? m[1].trim() : ''
}

/** 행정규칙(고시) `AdmRulService` JSON → ParsedDocument */
export function parseAdmrulDocument(json: unknown): ParsedDocument {
  const svc = asRec(asRec(json, 'root')['AdmRulService'], 'AdmRulService')
  const info = asRec(svc['행정규칙기본정보'], 'AdmRulService.행정규칙기본정보')
  const items = asList(svc['조문내용'])
  if (items.length === 0) throw shapeError('AdmRulService.조문내용')

  const chapters: ParsedChapter[] = []
  const articles: ParsedArticle[] = []
  let currentChapter: string | null = null

  for (const it of items) {
    const text = str(it, '조문내용[]')
    const ch = parseChapterHeading(text)
    if (ch) {
      chapters.push({ ...ch, sortOrder: chapters.length })
      currentChapter = ch.label
      continue
    }
    const key = parseArticleKey(text)
    if (key === null) throw shapeError('조문내용[] (not chapter or article)')
    articles.push({
      key,
      title: titleOf(text),
      body: formatBody(text),
      chapterLabel: currentChapter,
      sortOrder: articles.length,
    })
  }

  const promulgatedRaw = optStr(info['발령일자'])
  return {
    kind: 'notice',
    title: str(info['행정규칙명'], '행정규칙기본정보.행정규칙명'),
    promulgationNo: `고시 제${str(info['발령번호'], '행정규칙기본정보.발령번호')}호`,
    promulgatedOn: promulgatedRaw ? isoDate(promulgatedRaw, '행정규칙기본정보.발령일자') : null,
    effectiveOn: isoDate(str(info['시행일자'], '행정규칙기본정보.시행일자'), '행정규칙기본정보.시행일자'),
    isUpcoming: false,
    chapters,
    articles,
  }
}
