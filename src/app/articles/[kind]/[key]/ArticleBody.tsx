import ArticleRefText from '@/app/_components/ArticleRefText.tsx'
import { lawNameHref, parseBodyLine, splitLawMarkup } from '@/lib/law/format.ts'
import type { DocKind } from '@/lib/law/types.ts'

/** 조문 본문: 줄마다 들여쓰기 단계(호·목)를 내어쓰기로, 제목·개정 표시·법령명·조 참조를 꾸며서 보여 준다. */
export default function ArticleBody({ body, kind }: { body: string; kind: DocKind }) {
  return (
    <div className="tier-body">
      {body.split('\n').map((raw, i) => {
        const { depth, text } = parseBodyLine(raw)
        const segs = splitLawMarkup(text, i === 0)
        return (
          <p key={i} className={`ln d${depth}`}>
            {segs.map((seg, j) => {
              switch (seg.type) {
                case 'title':
                  return (
                    <strong key={j} className="art-title">
                      {seg.text}
                    </strong>
                  )
                case 'revision':
                  return (
                    <span key={j} className="art-rev">
                      {seg.text}
                    </span>
                  )
                case 'lawName': {
                  const href = lawNameHref(seg.text)
                  return href ? (
                    <a key={j} className="art-law" href={href} target="_blank" rel="noopener noreferrer">
                      {seg.text}
                    </a>
                  ) : (
                    <span key={j} className="art-law">
                      {seg.text}
                    </span>
                  )
                }
                default:
                  return (
                    <ArticleRefText
                      key={j}
                      text={seg.text}
                      kind={kind}
                      context={segs.slice(0, j).map((s) => s.text).join('')}
                    />
                  )
              }
            })}
          </p>
        )
      })}
    </div>
  )
}
