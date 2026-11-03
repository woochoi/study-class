'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/', label: '개요·진도' },
  { href: '/mindmap', label: '마인드맵' },
  { href: '/cards', label: '암기 카드' },
  { href: '/laws', label: '조문 매핑표' },
  { href: '/history', label: '개정 연혁' },
]

export default function StudyTabs() {
  const pathname = usePathname()
  return (
    <nav className="tabs" aria-label="학습 화면">
      {TABS.map((t) => {
        const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href)
        return (
          <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}>
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
