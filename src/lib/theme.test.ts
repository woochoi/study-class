import test from 'node:test'
import assert from 'node:assert/strict'
import { effectiveTheme, nextTheme, parseTheme, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from './theme.ts'

test('parseTheme: light·dark만 인정하고 나머지는 null', () => {
  assert.equal(parseTheme('light'), 'light')
  assert.equal(parseTheme('dark'), 'dark')
  for (const v of [null, undefined, '', 'system', 'DARK', 1]) assert.equal(parseTheme(v), null)
})

test('effectiveTheme: 고른 값이 없으면 컴퓨터 설정을 따른다', () => {
  assert.equal(effectiveTheme(null, true), 'dark')
  assert.equal(effectiveTheme(null, false), 'light')
})

test('effectiveTheme: 고른 값이 있으면 컴퓨터 설정보다 우선한다', () => {
  assert.equal(effectiveTheme('light', true), 'light')
  assert.equal(effectiveTheme('dark', false), 'dark')
})

test('nextTheme: 라이트↔다크를 오간다', () => {
  assert.equal(nextTheme('light'), 'dark')
  assert.equal(nextTheme('dark'), 'light')
})

function runInitScript(stored: string | null, opts: { throwOnRead?: boolean } = {}) {
  const attrs: Record<string, string> = {}
  const document = { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v } } }
  const localStorage = {
    getItem: (k: string) => {
      if (opts.throwOnRead) throw new Error('blocked')
      return k === THEME_STORAGE_KEY ? stored : null
    },
  }
  new Function('document', 'localStorage', THEME_INIT_SCRIPT)(document, localStorage)
  return attrs
}

test('THEME_INIT_SCRIPT: 저장된 테마를 data-theme으로 적용한다', () => {
  assert.deepEqual(runInitScript('dark'), { 'data-theme': 'dark' })
  assert.deepEqual(runInitScript('light'), { 'data-theme': 'light' })
})

test('THEME_INIT_SCRIPT: 저장값이 없거나 이상하면 아무것도 바꾸지 않는다(컴퓨터 설정 유지)', () => {
  assert.deepEqual(runInitScript(null), {})
  assert.deepEqual(runInitScript('purple'), {})
})

test('THEME_INIT_SCRIPT: 저장소 접근이 막혀도 오류를 던지지 않는다', () => {
  assert.deepEqual(runInitScript('dark', { throwOnRead: true }), {})
})
