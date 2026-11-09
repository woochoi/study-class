// 화면 테마(라이트/다크). 고른 값은 브라우저 localStorage에만 저장하고,
// 고른 적이 없으면 컴퓨터 설정(prefers-color-scheme)을 따른다.
// 적용은 <html data-theme="light|dark"> 속성으로 하며, CSS가 이 속성을 기준으로 색을 고른다.

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'sc-theme'

export function parseTheme(value: unknown): Theme | null {
  return value === 'light' || value === 'dark' ? value : null
}

export function effectiveTheme(stored: Theme | null, systemDark: boolean): Theme {
  return stored ?? (systemDark ? 'dark' : 'light')
}

export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark'
}

// 페이지가 그려지기 전에 <head>에서 실행되는 스크립트. 저장된 테마가 있을 때만 data-theme을 붙여
// 다크→라이트 깜빡임을 막는다. 저장소가 막힌 브라우저에서도 오류 없이 컴퓨터 설정으로 남는다.
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`
