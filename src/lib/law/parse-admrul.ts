import { parseArticleKey } from './article-key.ts'
import type { ParsedArticle, ParsedChapter, ParsedDocument } from './types.ts'
import { asList, asRec, isoDate, optStr, parseChapterHeading, shapeError, str } from './shape.ts'

/** 고시 조문은 한 줄 문자열이라 ①, 1., 가. 앞에서 줄바꿈을 복원한다. */
function formatBody(text: string): string {
  return text
    .trim()
    .replace(/\s*([①-⑳])/g, '\n$1')
    .replace(/(?<=다[.:])\s*(\d{1,2})\.(?!\d)\s*/g, '\n  $1. ')
    .replace(/(?<=다[.:])\s*([가-하])\.\s/g, '\n    $1. ')
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
