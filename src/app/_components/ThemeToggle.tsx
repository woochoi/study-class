'use client'

import { effectiveTheme, nextTheme, parseTheme, THEME_STORAGE_KEY } from '@/lib/theme.ts'

// 어떤 아이콘을 보일지는 CSS(globals.css의 .theme-icon-*)가 <html data-theme>와 컴퓨터 설정으로 정한다.
// 그래서 서버 렌더링과 첫 화면이 항상 같고, 하이드레이션 불일치나 아이콘 깜빡임이 없다.
export default function ThemeToggle() {
  function toggle() {
    const root = document.documentElement
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const next = nextTheme(effectiveTheme(parseTheme(root.getAttribute('data-theme')), systemDark))
    root.setAttribute('data-theme', next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // 저장소가 막힌 브라우저: 이번 페이지에만 적용된다.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="라이트/다크 화면 전환"
      title="라이트/다크 화면 전환"
      className="theme-toggle"
    >
      {/* 라이트일 때 보이는 달(→다크), 다크일 때 보이는 해(→라이트) */}
      <svg className="theme-icon-moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path fill="currentColor" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
      <svg className="theme-icon-sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </g>
      </svg>
    </button>
  )
}
