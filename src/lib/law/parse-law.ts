import { articleKeyFromParts } from './article-key.ts'
import type { ParsedArticle, ParsedChapter, ParsedDocument } from './types.ts'
import { asList, asRec, isoDate, optStr, parseChapterHeading, shapeError, str } from './shape.ts'

function textOf(v: unknown, where: string): string {
  if (Array.isArray(v)) return v.map((x) => textOf(x, where)).join('\n')
  return str(v, where)
}

function buildBody(unit: Record<string, unknown>): string {
  const lines: string[] = [textOf(unit['조문내용'], '조문내용').trim()]
  for (const h of asList(unit['항'])) {
    const hang = asRec(h, '항')
    // 항 본문 없이 호만 있는 조문(예: 제2조)이 있다.
    if (hang['항내용'] != null && hang['항내용'] !== '') lines.push(textOf(hang['항내용'], '항내용').trim())
    for (const ho of asList(hang['호'])) {
      const hoRec = asRec(ho, '호')
      lines.push('  ' + textOf(hoRec['호내용'], '호내용').trim())
      for (const mok of asList(hoRec['목'])) {
        lines.push('    ' + textOf(asRec(mok, '목')['목내용'], '목내용').trim())
      }
    }
  }
  return lines.join('\n')
}

/** 법률/시행령 `lawService.do` JSON(`법령`) → ParsedDocument */
export function parseLawDocument(
  json: unknown,
  opts: { kind: 'law' | 'decree'; isUpcoming: boolean },
): ParsedDocument {
  const law = asRec(asRec(json, 'root')['법령'], '법령')
  const info = asRec(law['기본정보'], '법령.기본정보')
  const units = asList(asRec(law['조문'], '법령.조문')['조문단위'])
  if (units.length === 0) throw shapeError('법령.조문.조문단위')

  const prefix = opts.kind === 'law' ? '법률' : '대통령령'
  const promulgatedRaw = optStr(info['공포일자'])
  const chapters: ParsedChapter[] = []
  const articles: ParsedArticle[] = []
  let currentChapter: string | null = null

  for (const u of units) {
    const unit = asRec(u, '조문단위')
    const kind = unit['조문여부']
    if (kind === '전문') {
      const ch = parseChapterHeading(str(unit['조문내용'], '전문.조문내용'))
      if (ch) {
        chapters.push({ ...ch, sortOrder: chapters.length })
        currentChapter = ch.label
      }
      continue
    }
    if (kind !== '조문') throw shapeError('조문단위.조문여부')
    articles.push({
      key: articleKeyFromParts(str(unit['조문번호'], '조문번호'), optStr(unit['조문가지번호'])),
      title: optStr(unit['조문제목']).trim(),
      body: buildBody(unit),
      chapterLabel: currentChapter,
      sortOrder: articles.length,
    })
  }

  return {
    kind: opts.kind,
    title: str(info['법령명_한글'], '기본정보.법령명_한글'),
    promulgationNo: `${prefix} 제${str(info['공포번호'], '기본정보.공포번호')}호`,
    promulgatedOn: promulgatedRaw ? isoDate(promulgatedRaw, '기본정보.공포일자') : null,
    effectiveOn: isoDate(str(info['시행일자'], '기본정보.시행일자'), '기본정보.시행일자'),
    isUpcoming: opts.isUpcoming,
    chapters,
    articles,
  }
}
