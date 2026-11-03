'use client'

import Link from 'next/link'
import { useState } from 'react'
import { formatArticleKey } from '@/lib/law/article-key.ts'
import type { Anchor, Chapter } from '@/lib/study/types.ts'

type Upcoming = { effectiveOn: string; promulgationNo: string } | null | undefined

/** 'YYYY-MM-DD' → 'YYYY. M. D. 시행 예정 (법률 제N호)'. 정보가 없으면 '시행 예정'. */
function upcomingLabel(u: Upcoming): string {
  if (!u) return '시행 예정'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(u.effectiveOn)
  if (!m) return '시행 예정'
  return `${m[1]}. ${Number(m[2])}. ${Number(m[3])}. 시행 예정 (${u.promulgationNo})`
}

export default function ChapterAnchors({
  chapters, anchors, upcoming,
}: { chapters: Chapter[]; anchors: Anchor[]; upcoming?: Upcoming }) {
  // 장 label별로 열린 조문 키 하나
  const [open, setOpen] = useState<Record<string, string | null>>({})

  function toggle(chapter: string, key: string) {
    setOpen((o) => ({ ...o, [chapter]: o[chapter] === key ? null : key }))
  }

  return (
    <div>
      {chapters.map((ch) => {
        if (ch.articles.length === 0) return null
        const keys = new Set(ch.articles.map((a) => a.key))
        const mine = anchors.filter((a) => keys.has(a.articleKey))
        const mineKeys = new Set(mine.map((a) => a.articleKey))
        const first = ch.articles[0].key
        const last = ch.articles[ch.articles.length - 1].key
        const selKey = open[ch.label] ?? null
        const sel = selKey ? ch.articles.find((a) => a.key === selKey) : undefined
        return (
          <div key={ch.label} className="chrow">
            <div className="chname">
              {ch.label} {ch.title === '삭제' ? '(삭제, 일부 조문 남음)' : ch.title}
              <small>
                {formatArticleKey(first)} ~ {formatArticleKey(last)} · {ch.articles.length}개
              </small>
            </div>
            <div>
              {mine.length ? (
                <div className="anchors">
                  {mine.map((a) => (
                    <button
                      key={a.articleKey}
                      type="button"
                      className={`anchor ${a.areaId}${a.isNew ? ' new' : ''}${selKey === a.articleKey ? ' sel' : ''}`}
                      aria-label={`${formatArticleKey(a.articleKey)} ${a.label}`}
                      aria-expanded={selKey === a.articleKey}
                      onClick={() => toggle(ch.label, a.articleKey)}
                    >
                      <b>{a.articleKey}</b>
                      <span>{a.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="none">앵커 없음. 장 전체를 한 묶음으로 기억하세요.</div>
              )}
              <div className="allarts" aria-label={`${ch.label} 조문 전체`}>
                {ch.articles.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    className={`${mineKeys.has(a.key) ? 'on' : ''}${a.isUpcoming ? ' soon' : ''}${selKey === a.key ? ' sel' : ''}`}
                    aria-expanded={selKey === a.key}
                    onClick={() => toggle(ch.label, a.key)}
                  >
                    {a.key}
                  </button>
                ))}
              </div>
              <div className="artinfo" aria-live="polite" hidden={!sel}>
                {sel && (
                  <>
                    <b>
                      {formatArticleKey(sel.key)}({sel.title})
                    </b>
                    {sel.isUpcoming && <em>🔜 {upcomingLabel(upcoming)}</em>}
                    <Link href={`/articles/law/${encodeURIComponent(sel.key)}`}>원문 보기</Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
