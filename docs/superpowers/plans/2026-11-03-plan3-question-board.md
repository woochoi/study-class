# 문의 게시판 (7단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 사용자가 조문 태그가 붙은 질문을 올리고 서로 답하는 문의 게시판을 만든다. 3단 원문 화면에서 바로 질문할 수 있고, 답변이 달린 질문은 목록에 "답변 있음"으로 표시된다.

**Architecture:** 읽기는 서버 컴포넌트, 쓰기는 Server Actions(`useActionState` 폼)로 한다. DB 로직은 `src/lib/board/`에 두고 `node --test`로 실제 TEST DB에 대해 검증한다. 화면은 `(study)` 라우트 그룹 아래 `/questions`에 두어 학습판 헤더·탭을 같이 쓴다. 테이블(`questions`, `answers`)은 `db/init.sql`에 이미 있다.

**Tech Stack:** Next.js 16.4.4 (App Router, Cache Components), React 19, TypeScript, `pg`, Node 24 `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-03-study-cafe-mvp-design.md` (§2.3 실패 조건, §4 흐름 5~6, §5.4 문의 게시판). DB: `docs/DB_DESIGN.md` §3 `questions`·`answers`.

## Global Constraints

- 별도 REST API·Route Handler 금지. 데이터 변경은 Server Actions만 (CLAUDE.md 1.4).
- 모든 SQL은 `$1, $2` 파라미터화. 문자열 이어붙이기 금지 (NFR-4).
- DB를 여는 `src/lib/board/*-db.ts`는 `import 'server-only'` (NFR-3). 순수 모듈(`validate.ts`, `format.ts`)은 server-only를 넣지 않는다(클라이언트 폼도 씀).
- 새 런타임 의존성 금지 (NFR-6). `init.sql` 스키마는 바꾸지 않는다(이미 있음). 바꿔야 하면 멱등 SQL로만.
- src/lib 안 import는 상대경로 `.ts`, src/app에서는 `@/`. `src/lib`는 `next/*`를 import하지 않는다(테스트에서 못 씀) — `connection()`·`redirect()`·`notFound()`는 페이지/액션에서 (Plan 2 R9).
- 페이지에서 DB를 읽기 전에 `await connection()`. 없는 글은 진짜 404가 되도록 상세·수정 페이지는 `export const instant = false` (3단 화면과 같은 방식).
- 본문은 일반 텍스트. HTML로 렌더링하지 않고(`dangerouslySetInnerHTML` 금지) CSS `white-space: pre-wrap`으로 줄바꿈만 유지.
- 길이 제한 (trim 후): 제목 1~200자, 본문 1~5000자, 답변 1~5000자 — `init.sql` CHECK와 같은 값.
- 목록은 페이지당 **20개**, 최신 글이 위 (`created_at DESC, id DESC`).
- 자기 글만 수정·삭제. 권한 검사는 SQL `WHERE ... AND author_id = $N`으로 한다(먼저 읽고 비교하지 않음).
- 화면 문구는 한국어, 시각은 `Asia/Seoul` 기준.
- 매 태스크 끝에 `npm test`와 `npm run build`가 모두 통과해야 한다 (Plan 2 R7).
- Next.js 16 API는 추측하지 말고 `node_modules/next/dist/docs/01-app/02-guides/forms.md`, `01-app/01-getting-started/07-mutating-data.md`를 읽고 따른다.

## 결정 (스펙이 빌더에게 맡긴 것)

- **조문 태그는 (kind, key)로 다룬다.** URL·폼은 `kind=law&key=29` 형식. 저장할 때 `articles.id`로 바꾸되 **현행 문서를 먼저** 고른다(`is_upcoming = false` 우선, 없으면 시행 예정 문서). 목록 필터는 같은 (kind, key)의 모든 문서 버전을 포함한다. 3단 화면의 `?articleId=` 링크는 `?kind=&key=`로 바꾼다.
- **태그 표시:** `법 제29조` / `영 제30조` / `고시 제7조` (`formatArticleKey` 재사용). 누르면 `/articles/{kind}/{key}`.
- **읽기는 로그인 없이 가능, 쓰기는 로그인 필요.** 로그아웃 상태의 작성 화면은 폼 대신 "로그인하면 질문할 수 있어요" 안내(헤더의 구글 로그인 버튼이 돌아올 주소를 지킨다).
- **삭제:** 답변 없는 질문은 행 삭제. 답변 있는 질문은 `deleted_at`만 기록(소프트 삭제) — 제목·본문 자리에 "삭제된 질문입니다", 답변은 그대로, 수정·새 답변 불가. 소프트 삭제된 질문의 답변이 모두 지워지면 그 질문은 목록에서 빠지고 상세는 404 (행은 남겨 둠).
- **답변도 자기 것만 수정·삭제.** 답변 삭제는 행 삭제.
- **수정 표시:** `updated_at > created_at`이면 시각 옆에 "(수정됨)".
- **탭:** `StudyTabs`에 `{ href: '/questions', label: '문의 게시판' }` 추가. 활성 판정은 `pathname === href || pathname.startsWith(href + '/')` (Plan 2 최종 리뷰 메모: `/laws`가 `/lawsX`에도 켜지는 경계 문제).

## Review Focus

1. 다른 사람 글의 id로 수정·삭제 액션을 직접 호출 → 아무것도 바뀌지 않고 `forbidden`(또는 `notfound`). (Task 2·3 테스트)
2. 공백만 있는 제목/본문, 5000자 초과 본문 → 저장 안 되고 입력값이 폼에 남은 채 오류 문구. (Task 1 테스트 + Task 4 화면 확인)
3. `?page=abc`, `?page=0`, `?page=-1`, `?page=99999` → 1페이지로 보거나 빈 목록 안내, 500이 나지 않음. `/questions/abc`, `/questions/99999999999999999999` → 404. (Task 1 `parsePage`/`parseId` 테스트)
4. 본문에 `<script>alert(1)</script>`나 `<b>` → 글자 그대로 보임. (Task 5 화면 확인)
5. 없는 조문 태그(`kind=law&key=999`, `key=29abc`, `kind=foo`) → 작성 시 "없는 조문이에요"(형식이 틀리면 형식 안내) 오류. 목록 필터는 형식이 틀린 태그면 전체 목록 + 안내, 형식은 맞지만 없는 조문이면 빈 목록 안내. 시행 예정 법에만 있는 조문도 태그 가능. (Task 1·2 테스트, Task 4 화면)

---

### Task 1: 순수 검증·형식 함수

**Files:**
- Create: `src/lib/board/validate.ts`, `src/lib/board/format.ts`
- Test: `src/lib/board/validate.test.ts`, `src/lib/board/format.test.ts`

**Interfaces:**
- Consumes: `DocKind` (`src/lib/law/types.ts`), `formatArticleKey` (`src/lib/law/article-key.ts`), `parseArticleParams`의 키 규칙 `/^\d+(의\d+)?$/`.
- Produces:
  - `export const LIMITS = { title: 200, body: 5000, answer: 5000 } as const`
  - `export const PAGE_SIZE = 20`
  - `export type FieldErrors = Partial<Record<'title' | 'body' | 'tag', string>>`
  - `validateQuestion(input: { title: unknown; body: unknown; kind: unknown; key: unknown }): { ok: true; value: { title: string; body: string; tag: { kind: DocKind; key: string } | null } } | { ok: false; errors: FieldErrors }`
  - `validateAnswer(body: unknown): { ok: true; value: string } | { ok: false; error: string }`
  - `parsePage(raw: unknown): number` — 1 이상 정수, 그 외 1. 상한은 두지 않는다(빈 페이지는 화면이 처리).
  - `parseId(raw: unknown): string | null` — `/^[1-9]\d{0,17}$/`만 통과.
  - `parseTag(kind: unknown, key: unknown): { kind: DocKind; key: string } | null`
  - `formatTag(tag: { kind: DocKind; key: string }): string` — `'법 제29조'`, `'영 제30조의2'`, `'고시 제7조'`
  - `formatBoardTime(iso: string | Date): string` — Asia/Seoul, `'2026. 11. 3. 14:05'`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// validate.test.ts
test('제목·본문은 trim 후 검사', () => {
  const r = validateQuestion({ title: '  제29조 질문 ', body: ' 내용\n둘째 줄 ', kind: '', key: '' })
  assert.deepEqual(r, { ok: true, value: { title: '제29조 질문', body: '내용\n둘째 줄', tag: null } })
})
test('빈 값·공백만·길이 초과는 필드별 오류', () => {
  const r = validateQuestion({ title: '   ', body: 'x'.repeat(5001), kind: '', key: '' })
  assert.equal(r.ok, false)
  assert.ok(!r.ok && r.errors.title && r.errors.body)
  assert.equal(validateQuestion({ title: 'x'.repeat(200), body: 'y', kind: '', key: '' }).ok, true)
  assert.equal(validateQuestion({ title: 'x'.repeat(201), body: 'y', kind: '', key: '' }).ok, false)
  assert.equal(validateQuestion({ title: 1, body: null, kind: '', key: '' }).ok, false)
})
test('태그: kind·key 둘 다 비면 없음, 하나만 있거나 형식이 틀리면 tag 오류', () => {
  assert.deepEqual((validateQuestion({ title: 't', body: 'b', kind: 'decree', key: '30의2' }) as any).value.tag, { kind: 'decree', key: '30의2' })
  for (const [kind, key] of [['law', ''], ['foo', '29'], ['law', '29abc'], ['law', '0x1']]) {
    const r = validateQuestion({ title: 't', body: 'b', kind, key })
    assert.ok(!r.ok && r.errors.tag, `${kind}/${key}`)
  }
})
test('답변 검증', () => {
  assert.deepEqual(validateAnswer('  답 '), { ok: true, value: '답' })
  assert.equal(validateAnswer(' \n ').ok, false)
  assert.equal(validateAnswer('x'.repeat(5001)).ok, false)
})
test('parsePage / parseId', () => {
  assert.equal(parsePage('3'), 3)
  for (const v of ['abc', '0', '-1', '1.5', undefined, ['2']]) assert.equal(parsePage(v), 1)
  assert.equal(parseId('12'), '12')
  for (const v of ['0', '012', 'abc', '1'.repeat(19), undefined]) assert.equal(parseId(v), null)
})
```

```ts
// format.test.ts
test('formatTag', () => {
  assert.equal(formatTag({ kind: 'law', key: '29' }), '법 제29조')
  assert.equal(formatTag({ kind: 'decree', key: '30의2' }), '영 제30조의2')
  assert.equal(formatTag({ kind: 'notice', key: '7' }), '고시 제7조')
})
test('formatBoardTime은 서울 시각', () => {
  assert.equal(formatBoardTime('2026-11-03T05:05:00Z'), '2026. 11. 3. 14:05')
  assert.equal(formatBoardTime('2026-12-31T15:30:00Z'), '2027. 1. 1. 00:30')
})
```

- [ ] **Step 2: 실행해 실패 확인** — `node --test --conditions=react-server src/lib/board/*.test.ts` → 모듈 없음으로 FAIL.
- [ ] **Step 3: 구현** — `validate.ts`, `format.ts`. 오류 문구: 제목 `'제목을 1~200자로 적어 주세요.'`, 본문 `'내용을 1~5000자로 적어 주세요.'`, 태그 `'조문은 종류와 번호(예: 29, 24의2)를 함께 적어 주세요.'`, 답변 `'답변을 1~5000자로 적어 주세요.'`. 시각은 `Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', ... })`의 `formatToParts`로 조립(브라우저마다 다른 구두점에 기대지 않게).
- [ ] **Step 4: 통과 확인** — 같은 명령 PASS, `npm test`·`npm run build` 통과.
- [ ] **Step 5: 커밋** — `git commit -m "feat: add board validation and formatting"`

---

### Task 2: 질문 DB 계층

**Files:**
- Create: `src/lib/board/questions-db.ts`
- Test: `src/lib/board/questions-db.test.ts`

**Interfaces:**
- Consumes: `query`, `closePool` (`src/lib/db.ts`), `User`, `upsertGoogleUser` (테스트용 사용자, `src/lib/auth/users.ts`), Task 1의 `PAGE_SIZE`, 태그 타입.
- Produces:
  ```ts
  export type Tag = { kind: DocKind; key: string }
  export type QuestionSummary = { id: string; title: string | null; authorName: string; createdAt: string; tag: Tag | null; answerCount: number; deleted: boolean }
  export type QuestionDetail = QuestionSummary & { body: string | null; authorId: string; updatedAt: string; answers: AnswerView[] }
  export type AnswerView = { id: string; body: string; authorId: string; authorName: string; createdAt: string; updatedAt: string }
  export type WriteResult = { ok: true; id: string } | { ok: false; reason: 'auth' | 'invalid' | 'notag' | 'forbidden' | 'notfound' }
  resolveTag(tag: Tag): Promise<string | null>            // articles.id, 현행 문서 우선
  createQuestion(userId: string, v: { title: string; body: string; tag: Tag | null }): Promise<WriteResult>
  updateQuestion(userId: string, id: string, v: { title: string; body: string; tag: Tag | null }): Promise<WriteResult>
  deleteQuestion(userId: string, id: string): Promise<{ ok: true; mode: 'hard' | 'soft' } | { ok: false; reason: 'forbidden' | 'notfound' }>
  listQuestions(opts: { page: number; tag: Tag | null }): Promise<{ items: QuestionSummary[]; total: number }>
  getQuestion(id: string): Promise<QuestionDetail | null>
  countQuestionsForTag(tag: Tag): Promise<number>
  ```
  `title`/`body`는 소프트 삭제된 질문이면 `null`(화면이 "삭제된 질문입니다"를 그림). `createdAt`/`updatedAt`은 ISO 문자열.

- [ ] **Step 1: 실패하는 테스트 작성** — `progress-db.test.ts`처럼 `before`에서 사용자 둘(`alice`, `bob`, `provider_user_id = 'test-' + randomUUID()`), `after`에서 그 사용자들의 질문·답변·사용자 삭제 후 `closePool()`. TEST DB에는 seed·sync가 된 조문이 있다는 전제(없으면 `assert`로 알려 줌). 테스트:
  - `create → getQuestion 왕복`: 태그 `{law,'29'}` 저장, `getQuestion`의 `tag`가 `{ kind:'law', key:'29' }`, `answerCount` 0, `deleted` false.
  - `resolveTag는 현행 문서를 고른다`: 현행·시행 예정 둘 다 있는 법 조문(예: `law/29`)의 결과가 `is_upcoming = false` 문서의 조문 id와 같다. 시행 예정 문서에만 있는 조문이 있으면 그 id를 돌려준다(그런 키를 SQL로 하나 찾아 쓰고, 없으면 그 단언은 건너뜀). `{law,'999'}` → `null`, `createQuestion`은 `{ ok:false, reason:'notag' }`.
  - `남의 질문 수정·삭제 불가`: bob이 alice 질문을 `updateQuestion`/`deleteQuestion` → `forbidden`, 내용·행 그대로.
  - `없는 id` → `notfound`.
  - `답변 없는 질문 삭제는 행 삭제`: `mode:'hard'`, `getQuestion` → `null`.
  - `답변 있는 질문 삭제는 소프트`: SQL로 답변 1개 넣고 삭제 → `mode:'soft'`, `getQuestion`의 `title`/`body` null·`deleted` true·답변 유지. 다시 `updateQuestion` → `notfound`.
  - `목록`: 최신 글이 먼저, `answerCount` 정확, `PAGE_SIZE` 넘는 페이지 분할(`total` 확인), `tag` 필터는 그 (kind,key)만. 소프트 삭제 + 답변 0개 질문은 목록에서 빠지고 `getQuestion`도 `null`.
  - `countQuestionsForTag`: 위 필터와 같은 수.
  - 테스트끼리 다른 데이터에 영향받지 않게 목록 단언은 이 파일이 만든 질문 id로 거른다(TEST DB를 다른 파일과 같이 쓰므로).
- [ ] **Step 2: 실패 확인** — `npm test` → 모듈 없음 FAIL.
- [ ] **Step 3: 구현**
  - `resolveTag`: `SELECT a.id FROM articles a JOIN law_documents d ON d.id = a.document_id WHERE d.kind = $1 AND a.article_key = $2 ORDER BY d.is_upcoming, d.id DESC LIMIT 1`.
  - 수정·삭제: `UPDATE ... WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL`. 0행이면 `SELECT author_id, deleted_at`으로 `forbidden`/`notfound`를 가른다(남의 글 → forbidden, 없거나 삭제됨 → notfound).
  - `deleteQuestion`: 먼저 `DELETE FROM questions WHERE id=$1 AND author_id=$2 AND deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM answers WHERE question_id = $1)`; 0행이면 같은 조건에서 `NOT EXISTS`만 빼고 `UPDATE ... SET deleted_at = now()`. 둘 다 0행이면 위 방식으로 이유를 가린다.
  - 목록/상세에서 "보이는 질문"은 `deleted_at IS NULL OR EXISTS (SELECT 1 FROM answers WHERE question_id = q.id)`.
  - 수정은 `updated_at = now()`.
- [ ] **Step 4: 통과 확인** — `npm test`, `npm run build`.
- [ ] **Step 5: 커밋** — `git commit -m "feat: add question data layer"`

---

### Task 3: 답변 DB 계층

**Files:**
- Create: `src/lib/board/answers-db.ts`
- Test: `src/lib/board/answers-db.test.ts`

**Interfaces:**
- Consumes: Task 2의 `WriteResult`, `getQuestion`, `createQuestion`, `deleteQuestion`.
- Produces:
  ```ts
  createAnswer(userId: string, questionId: string, body: string): Promise<WriteResult>   // id = 답변 id
  updateAnswer(userId: string, answerId: string, body: string): Promise<WriteResult>
  deleteAnswer(userId: string, answerId: string): Promise<{ ok: true; questionId: string } | { ok: false; reason: 'forbidden' | 'notfound' }>
  getAnswer(answerId: string): Promise<AnswerView & { questionId: string } | null>
  ```

- [ ] **Step 1: 실패하는 테스트 작성** — 사용자 둘, `after` 정리는 Task 2와 같다. 테스트:
  - `답변 작성 → getQuestion.answers에 작성 순으로`: alice 질문에 bob·alice 순서로 답변 → `answers` 순서와 `answerCount` 2.
  - `소프트 삭제된 질문·없는 질문에는 답변 불가` → `notfound`.
  - `남의 답변 수정·삭제 불가` → `forbidden`, 내용 그대로. `없는 답변 id` → `notfound`.
  - `수정하면 updatedAt이 바뀐다`: 수정 후 `updatedAt > createdAt`.
  - `소프트 삭제 질문의 마지막 답변을 지우면 질문이 안 보인다`: 질문에 답변 1개 → 질문 삭제(soft) → 답변 삭제 → `getQuestion` `null`.
- [ ] **Step 2: 실패 확인** — `npm test` FAIL.
- [ ] **Step 3: 구현** — `createAnswer`는 `INSERT INTO answers (question_id, author_id, body) SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM questions WHERE id = $1 AND deleted_at IS NULL) RETURNING id`; 0행 → `notfound`. FK 위반(`23503`)도 `notfound`(동시에 질문이 지워진 경우). 수정·삭제 권한 검사는 Task 2와 같은 방식.
- [ ] **Step 4: 통과 확인** — `npm test`, `npm run build`.
- [ ] **Step 5: 커밋** — `git commit -m "feat: add answer data layer"`

---

### Task 4: 목록·작성 화면과 액션, 탭

**Files:**
- Create: `src/app/(study)/questions/actions.ts`, `src/app/(study)/questions/page.tsx`, `src/app/(study)/questions/new/page.tsx`, `src/app/(study)/questions/_components/QuestionForm.tsx`, `src/app/(study)/questions/board.css`
- Modify: `src/app/(study)/_components/StudyTabs.tsx`

**Interfaces:**
- Consumes: Task 1~3 전부, `getCurrentUser` (`@/lib/auth/current-user.ts`).
- Produces (Task 5가 씀):
  ```ts
  // actions.ts ('use server')
  export type FormState = { errors?: FieldErrors; message?: string; values?: { title: string; body: string; kind: string; key: string } }
  createQuestionAction(prev: FormState, formData: FormData): Promise<FormState>          // 성공 시 redirect(`/questions/${id}`)
  updateQuestionAction(id: string, prev: FormState, formData: FormData): Promise<FormState>  // .bind(null, id)로 씀
  deleteQuestionAction(id: string): Promise<void>                                          // hard → redirect('/questions'), soft → redirect(`/questions/${id}`)
  createAnswerAction(questionId: string, prev: { error?: string }, formData: FormData): Promise<{ error?: string }>
  updateAnswerAction(answerId: string, prev: { error?: string; value?: string }, formData: FormData): Promise<{ error?: string; value?: string }>
  deleteAnswerAction(answerId: string): Promise<void>
  ```
  `QuestionForm` props: `{ action: (prev: FormState, fd: FormData) => Promise<FormState>; initial: { title: string; body: string; kind: string; key: string }; submitLabel: string }`.

- [ ] **Step 1: 액션 작성** — 모든 액션은 `getCurrentUser()` → 없으면 `{ message: '로그인이 필요해요.' }`(또는 답변은 `{ error }`). 검증 실패는 `errors`와 입력값 `values`를 돌려 폼이 지워지지 않게 한다. `notag` → `errors.tag = '없는 조문이에요.'`, `forbidden` → `'내 글만 고칠 수 있어요.'`, `notfound` → `'글을 찾을 수 없어요.'`. `id` 인자는 `parseId`로 다시 검사(바인드된 값도 조작될 수 있다). 성공 시 `redirect()`는 try 블록 밖에서.
- [ ] **Step 2: `QuestionForm`** (`'use client'`, `useActionState`) — 제목 input(`maxLength={200}`), 본문 textarea(`maxLength={5000}`), 조문 태그는 종류 select(없음/법/영/고시) + 번호 input(placeholder `예: 29, 24의2`), 필드별 오류를 `role="alert"`로 아래에 표시, 제출 중 버튼 비활성(`pending`).
- [ ] **Step 3: 목록 페이지 `/questions`** — `export const instant = false`, `await searchParams`, `await connection()`. `page = parsePage(sp.page)`, `tag = parseTag(sp.kind, sp.key)`(형식이 틀린 태그는 무시하고 전체 목록 + `"조문 태그를 알아볼 수 없어 전체 목록을 보여 드려요."` 안내). 한 줄에: 태그 배지(→ 3단 화면), 제목(→ 상세, 삭제된 질문은 "삭제된 질문입니다" 회색), 작성자 · `formatBoardTime` · 답변 수, 답변 1개 이상이면 **"답변 있음"** 배지. 태그 필터 중이면 `"법 제29조 질문만 보는 중 · 전체 보기"`. 페이지 이동 `이전`/`다음`(링크에 kind·key 유지). 목록이 비면 `"아직 질문이 없어요."`. 상단에 `질문하기` 링크(필터 중이면 그 태그를 넘김).
- [ ] **Step 4: 작성 페이지 `/questions/new`** — `?kind=&key=`가 올바르면 폼 초기값으로. 로그아웃이면 폼 대신 `"로그인하면 질문할 수 있어요."`. 태그가 있으면 `"법 제29조에 대한 질문"` 제목줄과 3단 화면으로 돌아가는 링크.
- [ ] **Step 5: 탭** — `StudyTabs`에 `문의 게시판` 추가, 활성 판정 `pathname === t.href || pathname.startsWith(t.href + '/')` (`/`는 기존대로 정확히 일치).
- [ ] **Step 6: 확인** — `npm test`, `npm run build` 통과. dev 서버(`.claude/launch.json`의 `next-dev`)에서: 로그인 상태로 질문 작성 → 상세로 이동(상세는 Task 5라 404여도 됨, 목록에 보이면 OK), 공백 제목 제출 시 오류와 입력 유지, `/questions?page=abc` 200, 375px 가로 넘침 없음.
- [ ] **Step 7: 커밋** — `git commit -m "feat: add question list and compose pages"`

---

### Task 5: 상세·답변·수정·삭제 화면

**Files:**
- Create: `src/app/(study)/questions/[id]/page.tsx`, `src/app/(study)/questions/[id]/edit/page.tsx`, `src/app/(study)/questions/answers/[answerId]/edit/page.tsx`, `src/app/(study)/questions/_components/AnswerForm.tsx`, `src/app/(study)/questions/_components/DeleteButton.tsx`
- Modify: `src/app/(study)/questions/board.css`

**Interfaces:**
- Consumes: Task 4의 액션과 `QuestionForm`, Task 2·3의 `getQuestion`, `getAnswer`.
- Produces: 화면만.

- [ ] **Step 1: 상세 `/questions/[id]`** — `instant = false`, `parseId` 실패·`getQuestion` null → `notFound()`. 질문: 태그 배지, 제목, 작성자·시각·(수정됨), 본문 `white-space: pre-wrap` 텍스트. 삭제된 질문이면 제목·본문 자리에 `"삭제된 질문입니다"`, 수정·삭제 버튼과 답변 폼 없음. 내 질문이면 `수정`(링크)·`삭제`(DeleteButton). 아래에 `답변 N개` 제목과 답변을 작성 순으로(각 `id="answer-<id>"`, 내 답변이면 수정·삭제). 맨 아래 답변 폼(로그인 시) 또는 `"로그인하면 답변할 수 있어요."`. 답변 작성 성공 시 같은 상세로 `redirect`(`#answer-<id>`).
- [ ] **Step 2: `DeleteButton`** (`'use client'`) — `<form action={...}>` + `confirm('삭제할까요?')`가 취소되면 제출을 막는다. 질문 삭제 안내 문구: 답변이 있으면 `"답변이 있어 내용만 지워지고 답변은 남아요."`.
- [ ] **Step 3: 질문 수정 `/questions/[id]/edit`** — 내 글이 아니거나 삭제된 글이면 `notFound()`(남의 글 수정 화면을 보여 주지 않음). 초기값에 현재 태그. `updateQuestionAction.bind(null, id)`.
- [ ] **Step 4: 답변 수정 `/questions/answers/[answerId]/edit`** — 내 답변이 아니면 `notFound()`. 저장하면 질문 상세 `#answer-<id>`로.
- [ ] **Step 5: 확인** — `npm test`, `npm run build`. dev 서버에서: 질문 상세에 답변 달기 → 목록에 "답변 있음"·답변 수 1, 본문의 `<script>alert(1)</script>`가 글자로 보임, 질문 수정 후 "(수정됨)", 답변 있는 질문 삭제 → "삭제된 질문입니다" + 답변 유지, 답변 없는 질문 삭제 → 목록에서 사라짐, `/questions/abc`·`/questions/99999999` 404 상태 코드(`curl -o /dev/null -w '%{http_code}'`). 로그아웃 상태에서 상세가 보이고 수정·삭제·답변 폼이 없음.
- [ ] **Step 6: 커밋** — `git commit -m "feat: add question detail, answers, edit and delete"`

---

### Task 6: 3단 화면 연결과 문서

**Files:**
- Modify: `src/app/articles/[kind]/[key]/page.tsx`, `README.md`, `docs/DB_DESIGN.md`(필요 시 한 줄), `CLAUDE.md` 7단계 완료 기준은 그대로 둠

**Interfaces:**
- Consumes: Task 2의 `countQuestionsForTag`, Task 1의 `formatTag`.

- [ ] **Step 1: 3단 화면 링크** — `이 조문에 대해 질문하기` 링크를 `/questions/new?kind=${t.entry.kind}&key=${encodeURIComponent(t.entry.key)}`로 바꾸고, 그 옆에 `countQuestionsForTag` 결과가 1 이상이면 `"이 조문 질문 N개 보기"` → `/questions?kind=…&key=…`.
- [ ] **Step 2: README** — 라우트 표에 `/questions`, `/questions/new`, `/questions/[id]`, 수정 화면 추가. 게시판 규칙(자기 글만 수정·삭제, 답변 있는 질문은 소프트 삭제) 한 단락.
- [ ] **Step 3: 확인** — `npm test`, `npm run build`. dev 서버에서 7단계 완료 기준 흐름: `/articles/law/29` → "질문하기" → 태그 `법 제29조`가 붙은 채 작성 → 목록 태그 필터 → 3단 화면에 "질문 1개 보기". 다른 계정 답변은 Task 3 테스트(bob 답변)로 대신 검증하고, 실제 두 번째 구글 계정 확인은 사용자 몫으로 README "확인 방법"에 적는다.
- [ ] **Step 4: 커밋** — `git commit -m "feat: link three-tier view to the question board"`
