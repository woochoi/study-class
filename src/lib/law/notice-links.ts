import type { ParsedDocument, ParsedLink } from './types.ts'

export type NoticeLinkRule = { decreeKey: string; noticeChapter?: string; noticeKeys?: string[] }

export function expandNoticeLinks(rules: NoticeLinkRule[], notice: ParsedDocument): ParsedLink[] {
  const links: ParsedLink[] = []
  for (const rule of rules) {
    const targets: string[] = []
    if (rule.noticeChapter !== undefined) {
      const chapter = rule.noticeChapter
      const inChapter = notice.articles.filter((a) => a.chapterLabel === chapter)
      if (inChapter.length === 0) {
        throw new Error(`notice link target missing: ${rule.decreeKey} -> ${chapter}`)
      }
      for (const a of [...inChapter].sort((x, y) => x.sortOrder - y.sortOrder)) targets.push(a.key)
    }
    for (const key of rule.noticeKeys ?? []) {
      if (!notice.articles.some((a) => a.key === key)) {
        throw new Error(`notice link target missing: ${rule.decreeKey} -> ${key}`)
      }
      targets.push(key)
    }
    for (const toKey of targets) {
      links.push({ fromKind: 'decree', fromKey: rule.decreeKey, toKind: 'notice', toKey, note: null })
    }
  }
  return links
}
