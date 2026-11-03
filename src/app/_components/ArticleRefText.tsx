import Link from 'next/link'
import type { ReactNode } from 'react'
import { refKindFor, splitArticleRefs } from '@/lib/law/linkify.ts'
import type { DocKind } from '@/lib/law/types.ts'

type Props = {
  text: string
  kind: DocKind
  /** 각 조각의 글자를 가공(검색어 강조 등). 링크는 유지된다. */
  render?: (s: string) => ReactNode
}

export default function ArticleRefText({ text, kind, render }: Props) {
  return (
    <>
      {splitArticleRefs(text).map((seg, i, segs) => {
        const inner = render ? render(seg.text) : seg.text
        if (!seg.key) return <span key={i}>{inner}</span>
        const refKind = refKindFor(segs.slice(0, i).map((x) => x.text).join(''), kind)
        // 다른 법령의 조 참조는 이 사이트에 없으므로 링크하지 않는다.
        if (refKind === null) return <span key={i}>{inner}</span>
        return (
          <Link key={i} href={`/articles/${refKind}/${encodeURIComponent(seg.key)}`}>
            {inner}
          </Link>
        )
      })}
    </>
  )
}
