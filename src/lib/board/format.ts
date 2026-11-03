import type { DocKind } from '../law/types.ts'
import { formatArticleKey } from '../law/article-key.ts'

const KIND_LABEL: Record<DocKind, string> = { law: '법', decree: '영', notice: '고시' }

export function formatTag(tag: { kind: DocKind; key: string }): string {
  return `${KIND_LABEL[tag.kind]} ${formatArticleKey(tag.key)}`
}

const fmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function formatBoardTime(iso: string | Date): string {
  const p: Record<string, string> = {}
  for (const part of fmt.formatToParts(new Date(iso))) p[part.type] = part.value
  return `${p.year}. ${p.month}. ${p.day}. ${p.hour}:${p.minute}`
}
