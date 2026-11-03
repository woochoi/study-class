import Link from 'next/link'
import type { ReactNode } from 'react'
import { splitArticleRefs } from '@/lib/law/linkify.ts'

type Props = {
  text: string
  kind: 'law' | 'decree'
  /** 각 조각의 글자를 가공(검색어 강조 등). 링크는 유지된다. */
  render?: (s: string) => ReactNode
}

export default function ArticleRefText({ text, kind, render }: Props) {
  return (
    <>
      {splitArticleRefs(text).map((seg, i) => {
        const inner = render ? render(seg.text) : seg.text
        return seg.key ? (
          <Link key={i} href={`/articles/${kind}/${encodeURIComponent(seg.key)}`}>
            {inner}
          </Link>
        ) : (
          <span key={i}>{inner}</span>
        )
      })}
    </>
  )
}
