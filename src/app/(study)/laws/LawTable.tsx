'use client'

import { Fragment, useState } from 'react'
import ArticleRefText from '@/app/_components/ArticleRefText.tsx'

export type LawRow = {
  areaClass: string
  roman: string
  areaName: string
  weight: number
  name: string
  lawSummary: string
  decreeSummary: string
  hay: string
}

function highlight(q: string) {
  return (s: string) => {
    if (!q) return s
    const parts = s.split(q)
    if (parts.length === 1) return s
    return parts.map((p, i) => (
      <Fragment key={i}>
        {i > 0 && <mark>{q}</mark>}
        {p}
      </Fragment>
    ))
  }
}

export default function LawTable({ rows }: { rows: LawRow[] }) {
  const [input, setInput] = useState('')
  const q = input.trim()
  const shown = q ? rows.filter((r) => r.hay.includes(q)) : rows
  const hl = highlight(q)
  return (
    <section className="panel">
      <div className="toolbar">
        <input
          className="filter"
          type="search"
          placeholder="검색: 예) 위탁, 제17조, 영향평가"
          aria-label="조문 검색"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <span className="hint" aria-live="polite">
          {q ? `${shown.length}개 중단원` : `${rows.length}개 중단원 전체`}
        </span>
      </div>
      <div className="tscroll">
        <table>
          <thead>
            <tr>
              <th>출제영역 · 중단원</th>
              <th>개인정보 보호법</th>
              <th>시행령</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  일치하는 항목이 없습니다. 조문은 ‘제17조’처럼 입력해 보세요.
                </td>
              </tr>
            ) : (
              shown.map((r) => (
                <tr key={`${r.roman}-${r.name}`} className={r.areaClass}>
                  <td className="sub">
                    {r.roman} {hl(r.name)}
                    <small>
                      {r.areaName} · {r.weight}%
                    </small>
                  </td>
                  <td className="law">
                    <ArticleRefText text={r.lawSummary} kind="law" render={hl} />
                  </td>
                  <td className="law">
                    <ArticleRefText text={r.decreeSummary} kind="decree" render={hl} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
