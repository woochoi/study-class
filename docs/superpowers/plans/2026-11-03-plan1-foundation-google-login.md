# 플랜 1 — 기반(1~4단계) + 구글 로그인(5단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PostgreSQL(Docker) + Next.js 앱 뼈대를 세우고, 1~7단계 전체 테이블을 만든 뒤, 구글 로그인(세션 DB 저장)까지 동작시킨다.

**Architecture:** Next.js App Router 서버 컴포넌트가 `pg`로 DB를 직접 읽고, 변경은 Server Actions로 한다. 유일한 Route Handler는 구글 OAuth 콜백이다. 세션은 무작위 토큰(쿠키) ↔ SHA-256 해시(DB) 방식이다.

**Tech Stack:** Next.js 16.4 (App Router, Turbopack, Cache Components), React, TypeScript, Tailwind(create-next-app 기본), `pg` + `@types/pg`, `server-only`, PostgreSQL 17 (Docker Compose), 테스트는 Node 24 내장 `node --test`(타입 스트리핑).

**Spec:** [docs/superpowers/specs/2026-11-03-study-cafe-mvp-design.md](../specs/2026-11-03-study-cafe-mvp-design.md) · 상위 [CLAUDE.md](../../../CLAUDE.md)

**후속 플랜(이 플랜 범위 밖):** 플랜 2 = 6단계(법령 대시보드·3단 원문, 법령 API 승인 후 작성), 플랜 3 = 7단계(문의 게시판).

## Global Constraints

- 런타임 의존성: `next`, `react`, `react-dom`, `pg`, `server-only`만. 인증 라이브러리·ORM·상태관리 라이브러리 금지. 테스트·도구는 devDependency.
- 모든 SQL은 `$1, $2` 파라미터화. 문자열 이어붙이기로 SQL을 만들지 않는다.
- DB를 만지는 모든 모듈 첫 줄: `import 'server-only';`
- Route Handler는 `src/app/auth/google/callback/route.ts` 하나뿐. `src/app/api/` 폴더를 만들지 않는다.
- 표준 PostgreSQL SQL만(확장 금지). `db/init.sql` 하나로 Supabase/Neon에서 재생성 가능해야 한다.
- 비밀값은 `.env`(Git 제외). `.env.example`에는 이름만. 변수: `DATABASE_URL`, `TEST_DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, `LAW_API_OC`.
- 값: `POSTGRES_USER=studycafe`, `POSTGRES_DB=my_study_cafe`, 테스트 DB 이름 `my_study_cafe_test`, `APP_URL=http://localhost:3000`, 콜백 경로 `/auth/google/callback`.
- 세션 쿠키 이름 `sc_session`, 만료 30일, `httpOnly; SameSite=Lax; Path=/`, 운영(`NODE_ENV=production`)에서만 `Secure`. OAuth 임시 쿠키 `sc_oauth`(state·PKCE verifier·returnTo), 만료 10분.
- `src/lib/**` 안의 상대 import는 `.ts` 확장자를 붙인다(`node --test` 타입 스트리핑 호환). `@/` 별칭은 `src/app/**`에서만 쓴다. TS `enum`·parameter properties 금지(타입 스트리핑 미지원).
- Cache Components 활성: 요청마다 다른 값(cookies, DB)을 읽는 서버 컴포넌트는 `<Suspense>` 안에 둔다. 빌드 오류가 나면 오류 메시지 안내를 따른다.
- 화면 문구·문서는 한국어. 코드 식별자는 영어.

## Review Focus

1. **콜백 재실행/위조:** `state` 불일치, `sc_oauth` 쿠키 없음, 이미 쓴 code로 콜백 새로고침 → 500이 아니라 `/?login_error=1`로 돌아가고 세션이 생기지 않는다. (Task 7 테스트)
2. **만료된 세션 쿠키:** 30일 지난 토큰으로 접속 → 비로그인으로 보이고 DB 행이 지워진다. (Task 5 테스트)
3. **같은 구글 계정 재로그인:** 이름·사진이 바뀐 상태로 다시 로그인 → 사용자 행이 새로 생기지 않고 갱신된다. (Task 6 테스트)
4. **열린 리다이렉트:** `returnTo=https://evil.example` 또는 `//evil.example` → 무시하고 `/`로 보낸다. (Task 7 테스트)
5. **DB 컨테이너 재생성:** `docker compose down` 후 `up` → 사용자·세션 행 유지(named volume). (Task 8 검증)

---

### Task 1: PRD·DB 설계 문서 (1단계) — 사용자 검토 체크포인트

**Files:**
- Create: `PRD.md`, `docs/DB_DESIGN.md`
- Modify: `CLAUDE.md` (1.4 비목표에 콜백 예외 한 줄, 7장 표 5~7단계 채움)

**Interfaces:**
- Produces: Task 2의 `db/init.sql`이 그대로 옮길 테이블 정의(아래 표). 플랜 2·3도 이 정의를 쓴다.

- [ ] **Step 1: `PRD.md` 작성** — 스펙 1~5장을 PRD 형식(목표·비목표·사용자·기능·비기능·단계)으로 요약. 새 결정은 넣지 않는다. 스펙 링크 포함.

- [ ] **Step 2: `docs/DB_DESIGN.md` 작성** — 아래 테이블을 그대로 문서화(ERD는 mermaid `erDiagram`), 각 테이블의 용도와 seed 출처(허브 HTML 배열명, `docs/sources/` 파일), 그리고 스펙 3.2의 Supabase/Neon 이전 주의(SSL `sslmode=require`, 풀러 주소, RLS 활성화) 절을 넣는다.

  모든 `id`는 `bigint GENERATED ALWAYS AS IDENTITY`, 시각은 `timestamptz NOT NULL DEFAULT now()`.

  | 테이블 | 컬럼 (제약) |
  |---|---|
  | `users` | id PK · provider text NOT NULL · provider_user_id text NOT NULL · email text · display_name text NOT NULL · avatar_url text · created_at · updated_at · UNIQUE(provider, provider_user_id) |
  | `sessions` | token_hash text PK (sha256 hex) · user_id → users ON DELETE CASCADE · expires_at timestamptz NOT NULL · created_at · INDEX(user_id) |
  | `law_documents` | id PK · kind text CHECK IN ('law','decree','notice') · title text NOT NULL · promulgation_no text NOT NULL (예 '법률 제21445호', '고시 제2026-9호') · promulgated_on date · effective_on date NOT NULL · is_upcoming boolean NOT NULL DEFAULT false · source text CHECK IN ('api','pdf','seed') · fetched_at timestamptz · UNIQUE(kind, promulgation_no) |
  | `law_chapters` | id PK · document_id → law_documents ON DELETE CASCADE · label text NOT NULL (예 '제4장의2') · title text NOT NULL · sort_order int NOT NULL |
  | `articles` | id PK · document_id → law_documents ON DELETE CASCADE · chapter_id → law_chapters ON DELETE SET NULL · article_key text NOT NULL (예 '24의2') · title text NOT NULL · body text (원문, 플랜 2가 채움) · sort_order int NOT NULL · UNIQUE(document_id, article_key) |
  | `article_links` | from_article_id → articles CASCADE · to_article_id → articles CASCADE · note text (예 '①항 4호') · PK(from_article_id, to_article_id) |
  | `areas` | id text PK ('a1'~'a5') · roman text · name text · weight int CHECK 0~100 · sort_order int |
  | `units` | id text PK ('a1-1' …) · area_id → areas · name text · law_summary text · decree_summary text · sort_order int |
  | `unit_leaves` | id PK · unit_id → units CASCADE · label text · ref text · sort_order int |
  | `unit_items` | id PK · unit_id → units CASCADE · label text · law_ref text · decree_ref text · is_key boolean DEFAULT false · sort_order int |
  | `anchors` | article_key text PK · label text · area_id → areas · is_new boolean DEFAULT false |
  | `mnemonics` | id PK · area_id → areas · title text · body text · sort_order int |
  | `cards` | id PK · area_id → areas · deck text CHECK IN ('law','decree','concept') · front text · answer text · extra text · sort_order int |
  | `history_events` | id PK · doc_kind text CHECK IN ('law','decree') · date_label text · title text · summary text · article_keys text[] NOT NULL DEFAULT '{}' · is_key boolean DEFAULT false · sort_order int |
  | `user_unit_reads` | user_id → users CASCADE · unit_id → units CASCADE · reads smallint CHECK 0~3 · PK(user_id, unit_id) |
  | `user_card_levels` | user_id → users CASCADE · card_id → cards CASCADE · level smallint CHECK 1~3 · PK(user_id, card_id) |
  | `user_settings` | user_id PK → users CASCADE · exam_date date |
  | `questions` | id PK · author_id → users · article_id → articles ON DELETE SET NULL · title text CHECK length 1~200 · body text CHECK length 1~5000 · created_at · updated_at · deleted_at timestamptz · INDEX(created_at DESC) · INDEX(article_id) |
  | `answers` | id PK · question_id → questions ON DELETE CASCADE · author_id → users · body text CHECK length 1~5000 · created_at · updated_at · INDEX(question_id, created_at) |

  `unit_leaves`는 법령 허브 `AREAS[].subs[].leaves`(마인드맵), `unit_items`는 시행령 허브 `DOMAINS[].units[].items` — 두 허브의 중단원은 대단원별 개수·순서가 같으므로 순번으로 매칭한다.

- [ ] **Step 3: `CLAUDE.md` 수정** — 1.4 첫 항목 끝에 "(예외: 구글 OAuth 콜백 `src/app/auth/google/callback/route.ts` 하나)" 추가. 7장 표 5~7단계를 스펙 7장 표 내용으로 채운다.

- [ ] **Step 4: 커밋**

```bash
git add PRD.md docs/DB_DESIGN.md CLAUDE.md
git commit -m "docs: add PRD and DB design, fill stages 5-7"
```

- [ ] **Step 5: 🛑 체크포인트 — 사용자에게 `docs/DB_DESIGN.md` 검토를 요청하고 승인 전까지 Task 2로 넘어가지 않는다.** 수정 요청이 오면 문서와 이 플랜의 Step 2 표를 함께 고친다.

---

### Task 2: DB 환경 (2단계)

**Files:**
- Create: `docker-compose.yml`, `db/init.sql`, `db/create-test-db.sql`, `.env.example`, `.gitignore`

**Interfaces:**
- Consumes: Task 1 테이블 정의
- Produces: `localhost:5432`의 `my_study_cafe`(스키마 적용) + 빈 `my_study_cafe_test`

- [ ] **Step 1: `.gitignore`** — create-next-app 기본 항목 + `.env`, `.superpowers/`. (`docs/sources/`는 커밋 대상 — 공개 법령 원문)

- [ ] **Step 2: `.env.example`** — Global Constraints의 변수 이름 전부, 값은 비우되 `POSTGRES_USER=studycafe`, `POSTGRES_DB=my_study_cafe`, `APP_URL=http://localhost:3000`만 채움. `DATABASE_URL`/`TEST_DATABASE_URL` 예시는 주석으로 형식만.

- [ ] **Step 3: `docker-compose.yml`** — 서비스 `db`: `image: postgres:17`, `env_file: .env`, `ports: "5432:5432"`, named volume `pgdata:/var/lib/postgresql/data`, `./db/init.sql:/docker-entrypoint-initdb.d/10-init.sql:ro`, `./db/create-test-db.sql:/docker-entrypoint-initdb.d/20-test-db.sql:ro`, healthcheck `pg_isready -U studycafe`.

- [ ] **Step 4: `db/init.sql`** — Task 1 표의 19개 테이블을 FK 의존 순서대로 `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`로 작성(재실행해도 안전). `db/create-test-db.sql`은 `CREATE DATABASE my_study_cafe_test;` 한 줄.

- [ ] **Step 5: 실행·확인**

Run: `cp .env.example .env` (비밀번호 직접 입력, `DATABASE_URL`·`TEST_DATABASE_URL` 채움) → `docker compose up -d` → `docker compose exec db psql -U studycafe -d my_study_cafe -c '\dt'`
Expected: 19개 테이블 목록. `-d my_study_cafe_test -c '\dt'`는 "Did not find any relations."

- [ ] **Step 6: 커밋**

```bash
git add .gitignore .env.example docker-compose.yml db/
git commit -m "chore: add postgres docker setup and schema"
```

---

### Task 3: Next.js 프로젝트 (3단계)

**Files:**
- Create: `create-next-app` 결과물(`src/app/**`, `package.json`, `tsconfig.json`, …), `test/use-test-db.ts`
- Modify: `package.json` scripts, `tsconfig.json`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `test`, `db:apply`, `db:apply:test`(Task 4가 스크립트 본문 제공)

- [ ] **Step 1: 생성** — 저장소 루트에서 `npx create-next-app@16.4 . --ts --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*" --use-npm` (기존 파일과 충돌하면 임시 폴더에 생성 후 옮긴다. `CLAUDE.md`·허브 HTML·`docs/`는 건드리지 않는다). 이어서 `npm i pg server-only` · `npm i -D @types/pg`.

- [ ] **Step 2: `tsconfig.json`** — `"allowImportingTsExtensions": true` 추가(`noEmit`은 Next 기본값 유지).

- [ ] **Step 3: `test/use-test-db.ts`** — `TEST_DATABASE_URL`이 없으면 `throw new Error('TEST_DATABASE_URL is not set')`, 있으면 `process.env.DATABASE_URL = process.env.TEST_DATABASE_URL`.

- [ ] **Step 4: `package.json` scripts**

```json
"test": "node --env-file=.env --conditions=react-server --import ./test/use-test-db.ts --test \"src/**/*.test.ts\"",
"db:apply": "node --env-file=.env scripts/db-apply.ts",
"db:apply:test": "node --env-file=.env --import ./test/use-test-db.ts scripts/db-apply.ts"
```

- [ ] **Step 5: 확인** — `npm run dev` → http://localhost:3000 에 기본 페이지. `npm run build` 성공.

- [ ] **Step 6: 커밋**

```bash
git add -A ':!.env'
git commit -m "chore: scaffold next.js app with pg"
```

---

### Task 4: DB 연결 모듈 (4단계)

**Files:**
- Create: `src/lib/db.ts`, `src/lib/types.ts`, `scripts/db-apply.ts`, `src/app/health/page.tsx`
- Test: `src/lib/db.test.ts`

**Interfaces:**
- Produces:
  - `query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>`
  - `withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>` — BEGIN/COMMIT, 예외 시 ROLLBACK 후 재던짐
  - `closePool(): Promise<void>` (테스트·스크립트용)
  - `types.ts`: `User = { id: string; provider: 'google'; providerUserId: string; email: string | null; displayName: string; avatarUrl: string | null }` (bigint는 pg가 문자열로 돌려주므로 `id: string`)

- [ ] **Step 1: 실패 테스트 `src/lib/db.test.ts`**

```ts
test('query runs a parameterized select', async () => {
  const r = await query<{ n: number }>('SELECT $1::int AS n', [1]);
  assert.equal(r.rows[0].n, 1);
});
test('withTransaction rolls back on error', async () => {
  await assert.rejects(withTransaction(async c => {
    await c.query("INSERT INTO areas (id, roman, name, weight, sort_order) VALUES ('zz','Z','tmp',0,99)");
    throw new Error('boom');
  }), /boom/);
  const r = await query("SELECT 1 FROM areas WHERE id = 'zz'");
  assert.equal(r.rowCount, 0);
});
after(closePool);
```

- [ ] **Step 2: 실패 확인** — `npm run db:apply:test`가 아직 없으므로 먼저 Step 3의 `db-apply.ts`까지 만든 뒤 `npm test` → `db.ts` 없음으로 FAIL.

- [ ] **Step 3: 구현** — `src/lib/db.ts`: `import 'server-only'`, `pg.Pool`을 첫 호출 시 `process.env.DATABASE_URL`로 지연 생성(없으면 명확한 오류). `scripts/db-apply.ts`: `db/init.sql`을 읽어 `pg.Client`로 한 번에 실행 후 종료(`server-only`를 import하지 않는다). `npm run db:apply:test`로 테스트 DB에 스키마 적용.

- [ ] **Step 4: 통과 확인** — `npm test` → PASS 2.

- [ ] **Step 5: `src/app/health/page.tsx`** — `SELECT 1 AS ok` 결과를 `<Suspense>` 안에서 표시("DB 연결: OK"). `npm run dev` 후 http://localhost:3000/health 확인.

- [ ] **Step 6: 커밋**

```bash
git add src/lib scripts src/app/health
git commit -m "feat: add server-only db module and health page"
```

---

### Task 5: 세션 모듈

**Files:**
- Create: `src/lib/auth/session.ts`
- Test: `src/lib/auth/session.test.ts`

**Interfaces:**
- Consumes: `query` (Task 4), `User` (Task 4)
- Produces:
  - `SESSION_COOKIE = 'sc_session'`, `SESSION_TTL_DAYS = 30`
  - `hashToken(token: string): string` — sha256 hex
  - `createSession(userId: string, now?: Date): Promise<{ token: string; expiresAt: Date }>` — `randomBytes(32).toString('base64url')`
  - `getUserBySessionToken(token: string, now?: Date): Promise<User | null>` — 만료면 행 삭제 후 null
  - `deleteSession(token: string): Promise<void>`
  - (쿠키를 읽는 `getCurrentUser()`는 Task 7에서 `next/headers`와 함께 만든다 — 이 모듈은 쿠키를 모른다)

- [ ] **Step 1: 실패 테스트** — 테스트용 사용자 1명을 `users`에 직접 INSERT(`provider_user_id = 'test-' + randomUUID()`), 종료 시 삭제.

```ts
test('created session resolves to its user', ...)              // getUserBySessionToken(token) 의 id === userId
test('only the hash is stored', ...)                           // sessions 에 token 원문 없음, token_hash === hashToken(token)
test('expired session returns null and is deleted', ...)       // createSession(userId, 31일 전) → null, 행 0개
test('deleteSession removes the row', ...)
test('unknown token returns null', ...)
```

- [ ] **Step 2: 실패 확인** — `npm test` → FAIL (모듈 없음)
- [ ] **Step 3: 구현** — Interfaces 그대로. `expires_at = now + 30일`.
- [ ] **Step 4: 통과 확인** — `npm test` → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat: add db-backed session module"`

---

### Task 6: 구글 OAuth 모듈

**Files:**
- Create: `src/lib/auth/google.ts`, `src/lib/auth/users.ts`
- Test: `src/lib/auth/google.test.ts`, `src/lib/auth/users.test.ts`

**Interfaces:**
- Consumes: `query`, `User`
- Produces:
  - `createPkcePair(): { verifier: string; challenge: string }` — verifier 43자 base64url, challenge = base64url(sha256(verifier))
  - `buildAuthUrl(opts: { clientId: string; redirectUri: string; state: string; codeChallenge: string }): string` — `https://accounts.google.com/o/oauth2/v2/auth`, `response_type=code`, `scope=openid email profile`, `code_challenge_method=S256`, `prompt=select_account`
  - `type GoogleProfile = { sub: string; email: string | null; name: string; picture: string | null }`
  - `exchangeCode(opts: { code: string; verifier: string; clientId: string; clientSecret: string; redirectUri: string; fetchFn?: typeof fetch; now?: Date }): Promise<GoogleProfile>` — `POST https://oauth2.googleapis.com/token`(form-urlencoded) → `id_token` 페이로드를 base64url 디코드해 검증: `iss ∈ {'https://accounts.google.com','accounts.google.com'}`, `aud === clientId`, `exp*1000 > now`. 실패 시 `Error('invalid id_token')`. (토큰 엔드포인트에서 TLS로 직접 받은 ID 토큰이므로 서명 검증은 생략 — OIDC Core 3.1.3.7) `name`이 없으면 email 앞부분, 둘 다 없으면 '스터디원'.
  - `upsertGoogleUser(p: GoogleProfile): Promise<User>` — `INSERT … ON CONFLICT (provider, provider_user_id) DO UPDATE SET email, display_name, avatar_url, updated_at = now() RETURNING …`

- [ ] **Step 1: 실패 테스트 `google.test.ts`** — 가짜 `fetchFn`로 `{ id_token: 'h.' + base64url(JSON payload) + '.s' }` 반환.

```ts
test('buildAuthUrl includes pkce and scopes', ...)    // URL.searchParams: code_challenge_method=S256, scope='openid email profile', state 일치
test('challenge is sha256 of verifier', ...)
test('exchangeCode returns profile for valid token', ...)   // sub/email/name/picture
test('exchangeCode rejects wrong aud', ...)                  // /invalid id_token/
test('exchangeCode rejects expired token', ...)
test('exchangeCode rejects non-200 token response', ...)
test('name falls back to email local part', ...)
```

- [ ] **Step 2: 실패 테스트 `users.test.ts`**

```ts
test('upsert creates a user', ...)
test('second upsert with same sub updates name and keeps id', ...)   // Review Focus 3: 행 수 1, display_name 갱신
```

- [ ] **Step 3: 실패 확인** — `npm test` → FAIL
- [ ] **Step 4: 구현**
- [ ] **Step 5: 통과 확인** — `npm test` → PASS
- [ ] **Step 6: 커밋** — `git commit -m "feat: add google oauth helpers and user upsert"`

---

### Task 7: 로그인 흐름 연결 (콜백·액션·화면)

**Files:**
- Create: `src/lib/auth/current-user.ts`, `src/lib/auth/oauth-cookie.ts`, `src/lib/auth/callback.ts`, `src/app/auth/actions.ts`, `src/app/auth/google/callback/route.ts`, `src/app/_components/AuthStatus.tsx`
- Modify: `src/app/layout.tsx` (헤더에 `AuthStatus`), `src/app/page.tsx` (`login_error=1`이면 "로그인에 실패했어요. 다시 시도해 주세요." 표시)
- Test: `src/lib/auth/callback.test.ts`, `src/lib/auth/oauth-cookie.test.ts`

**Interfaces:**
- Consumes: Task 5·6 전부
- Produces:
  - `getCurrentUser(): Promise<User | null>` — `cookies()`에서 `sc_session` 읽어 `getUserBySessionToken`
  - `encodeOAuthCookie(v: { state: string; verifier: string; returnTo: string }): string` / `decodeOAuthCookie(raw: string | undefined): {…} | null` — JSON → base64url, 깨진 값은 null
  - `safeReturnTo(raw: string | null | undefined): string` — `/`로 시작하고 `//`·`/\`로 시작하지 않는 경로만 허용, 아니면 `'/'`
  - `handleGoogleCallback(input: { code: string | null; state: string | null; oauthCookie: string | undefined; deps?: { exchange?: typeof exchangeCode } }): Promise<{ ok: true; token: string; expiresAt: Date; redirectTo: string } | { ok: false; redirectTo: '/?login_error=1' }>` — state 비교 → exchange → upsert → createSession. 모든 실패는 `{ ok:false }`(예외를 밖으로 던지지 않음, 서버 로그에는 남김)
  - Server Actions: `signInWithGoogle(formData)` (hidden `returnTo`) — state(`randomBytes(16)` base64url)·PKCE 생성, `sc_oauth` 쿠키(10분) 설정 후 `redirect(buildAuthUrl(...))`; `signOut()` — 세션 삭제, 쿠키 삭제, `redirect('/')`
  - `route.ts` `GET` — `handleGoogleCallback` 결과에 따라 `sc_session` 설정(성공)·`sc_oauth` 삭제(항상) 후 303 redirect

- [ ] **Step 1: 실패 테스트 `oauth-cookie.test.ts`**

```ts
test('round-trips', ...)
test('garbage decodes to null', ...)
test('safeReturnTo blocks external urls', () => {   // Review Focus 4
  for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'evil', '', null]) assert.equal(safeReturnTo(bad), '/');
  assert.equal(safeReturnTo('/board?page=2'), '/board?page=2');
});
```

- [ ] **Step 2: 실패 테스트 `callback.test.ts`** — `deps.exchange`에 가짜 함수 주입, 실제 테스트 DB 사용.

```ts
test('valid callback creates session and redirects to returnTo', ...)
test('state mismatch fails without calling exchange', ...)        // Review Focus 1
test('missing oauth cookie fails', ...)
test('exchange throwing (reused code) fails gracefully', ...)    // ok:false, sessions 행 증가 없음
test('missing code fails', ...)
```

- [ ] **Step 3: 실패 확인** — `npm test` → FAIL
- [ ] **Step 4: 구현** — Interfaces 그대로. `AuthStatus`(서버 컴포넌트, `<Suspense>` 안): 비로그인 → "구글로 로그인" 버튼(`signInWithGoogle` 폼, 현재 경로를 `returnTo`로), 로그인 → 아바타·이름·"로그아웃" 버튼(`signOut` 폼).
- [ ] **Step 5: 통과 확인** — `npm test` → PASS 전체
- [ ] **Step 6: 커밋** — `git commit -m "feat: wire google login flow"`

---

### Task 8: 수동 검증 (5단계 완료 기준)

**사전 조건(사용자):** Google Cloud Console에서 OAuth 클라이언트(웹) 생성, 승인된 리디렉션 URI `http://localhost:3000/auth/google/callback`, `.env`에 `GOOGLE_CLIENT_ID`·`GOOGLE_CLIENT_SECRET` 입력.

- [ ] **Step 1:** `npm run dev` → "구글로 로그인" → 구글 계정 선택 → 헤더에 이름·아바타 표시. 브라우저 쿠키에 `sc_session`만 있고 값이 DB `sessions.token_hash`와 다름(해시) 확인.
- [ ] **Step 2:** 새로고침 → 로그인 유지. `npm run dev` 재시작 → 유지.
- [ ] **Step 3:** `docker compose down && docker compose up -d` → 새로고침 → 유지 (Review Focus 5).
- [ ] **Step 4:** 콜백 URL을 주소창에서 다시 열기(code 재사용) → `/?login_error=1` 안내, 500 아님 (Review Focus 1).
- [ ] **Step 5:** "로그아웃" → 비로그인 표시, `sessions` 행 삭제 확인.
- [ ] **Step 6:** `npm run build` 성공, `npm test` 전체 PASS. 결과를 `README.md`의 "실행 방법" 절(설치·`.env`·`docker compose up -d`·`npm run db:apply`·`npm run dev`·`npm test`)로 정리해 커밋 — `git commit -m "docs: add setup instructions"`
