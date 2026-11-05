# Vercel + Neon 배포 준비 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지금 앱을 Vercel(`*.vercel.app`) + Neon PostgreSQL로 공개 배포할 수 있게 코드·스크립트·문서를 준비한다. 콘솔 작업은 사용자가 체크리스트대로 한다.

**Architecture:** DB 연결 규칙(SSL 정규화, 풀 크기, 대상 호스트 검사)을 순수 모듈 `src/lib/db-config.ts`로 모으고 `db.ts`·스크립트·테스트 준비가 모두 이것을 쓴다. 운영 DB 작업은 `.env.neon`만 읽는 전용 npm 명령으로 집 PC에서 실행한다. 공개에 필요한 `/privacy` 페이지와 삭제 요청 SQL 절차를 추가한다.

**Tech Stack:** Next.js 16.4.4, React 19, TypeScript, `pg` 8.23.1 (`pg-connection-string` 2.14.1), Node 24 `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-05-vercel-neon-deploy-design.md` (앞선 설계 `2026-11-03-study-cafe-mvp-design.md` 위에 얹힌다).

## Global Constraints

- 새 런타임 의존성 금지. `pg`만 쓴다 (`@vercel/functions`, `@neondatabase/serverless` 금지).
- 비밀값(연결 문자열의 비밀번호, client secret, `LAW_API_OC`)을 로그·커밋·문서에 쓰지 않는다. 호스트를 출력할 때는 호스트 이름만.
- `.env`, `.env.neon`은 Git 제외. 견본(`.env.example`, `.env.neon.example`)만 커밋, 값은 비움.
- 모든 SQL은 파라미터화. `db/init.sql` 스키마는 바꾸지 않는다.
- src/lib 안 import는 상대경로 `.ts`, src/app에서는 `@/`. src/lib는 `next/*`를 import하지 않는다. `db-config.ts`, `env.ts`는 `server-only`를 넣지 않는다(스크립트·테스트가 씀).
- 로컬 개발(`npm run dev` + Docker :5433)과 `npm test`(로컬 TEST DB)는 지금처럼 동작해야 한다.
- 매 태스크 끝에 `npm test`, `npm run lint`, `npm run build` 통과.
- 운영 Neon에 접속하는 명령은 구현자가 실행하지 않는다(접속 정보 없음). 사용자 몫.
- 화면·문서 문구는 한국어.

## Review Focus

1. Neon 콘솔이 주는 문자열(`...neon.tech/neondb?sslmode=require&channel_binding=require`)을 그대로 넣었을 때 → SSL·인증서 검증이 켜지고, `pg`의 `SECURITY WARNING` 경고가 출력되지 않는다. (Task 1 테스트)
2. `.env`의 `DATABASE_URL`이 실수로 Neon 주소이거나 `.env.neon`이 localhost일 때 → 로컬 명령·테스트·운영 명령이 접속 전에 거부한다. (Task 1·3 테스트)
3. 운영에서 `APP_URL`이 비었을 때 → 로그인 시작·콜백이 알아볼 수 있는 오류로 실패하고, 빈 주소로 리디렉션하지 않는다. `DATABASE_URL` 없이도 `next build`는 성공한다. (Task 2 테스트 + 빌드 확인)
4. 삭제 SQL을 실행했을 때 → 대상 사용자의 질문·답변·진도·세션·설정이 모두 지워지고 다른 사용자의 데이터는 그대로다(그 사용자 질문에 달린 남의 답변은 함께 지워짐 — 설계 결정). (Task 4 테스트)
5. 로그아웃 상태에서 모든 화면에 `/privacy` 링크가 보이고, `/privacy`는 DB 없이 열린다. (Task 5 확인)

---

### Task 1: DB 연결 규칙 모듈

**Files:**
- Create: `src/lib/db-config.ts`
- Modify: `src/lib/db.ts`
- Test: `src/lib/db-config.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type DbTarget = 'local' | 'neon'
  export const POOL_OPTIONS: { max: number; idleTimeoutMillis: number; connectionTimeoutMillis: number }  // { max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 }
  normalizeConnectionString(url: string): string   // sslmode prefer|require|verify-ca → verify-full, 나머지 그대로
  dbHost(url: string): string                       // 호스트 이름만 (비밀번호·사용자 제외)
  assertTarget(url: string, target: DbTarget): string  // 통과하면 dbHost 반환, 아니면 throw
  ```
  - `assertTarget(url, 'local')`: 호스트가 `.neon.tech`로 끝나면 `Error('로컬 명령이 Neon DB(<host>)에 접속하려 합니다. .env의 DATABASE_URL을 확인하세요.')`.
  - `assertTarget(url, 'neon')`: 호스트가 `.neon.tech`로 끝나지 않으면 `Error('운영 명령의 대상이 Neon이 아닙니다(<host>). .env.neon의 DATABASE_URL을 확인하세요.')`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
const NEON = 'postgresql://u:secretpw@ep-cool-1-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
const LOCAL = 'postgresql://studycafe:pw@localhost:5433/my_study_cafe'

test('normalizeConnectionString: require → verify-full, 다른 파라미터 유지', () => {
  const u = new URL(normalizeConnectionString(NEON))
  assert.equal(u.searchParams.get('sslmode'), 'verify-full')
  assert.equal(u.searchParams.get('channel_binding'), 'require')
  assert.equal(u.password, 'secretpw')
})
test('normalizeConnectionString: sslmode 없음·disable·verify-full은 그대로', () => {
  assert.equal(normalizeConnectionString(LOCAL), LOCAL)
  for (const m of ['disable', 'verify-full']) {
    const s = `${LOCAL}?sslmode=${m}`
    assert.equal(normalizeConnectionString(s), s)
  }
})
test('정규화한 Neon 문자열은 pg 경고 없이 ssl 설정이 켜진다', () => {
  const warnings: string[] = []
  const onWarn = (w: Error) => warnings.push(w.message)
  process.on('warning', onWarn)
  const cfg = parse(normalizeConnectionString(NEON))   // import { parse } from 'pg-connection-string'
  process.off('warning', onWarn)
  assert.ok(cfg.ssl && typeof cfg.ssl === 'object')
  assert.notEqual((cfg.ssl as { rejectUnauthorized?: boolean }).rejectUnauthorized, false)
  assert.deepEqual(warnings.filter((m) => m.includes('SECURITY WARNING')), [])
})
test('dbHost는 비밀번호를 내보내지 않는다', () => {
  assert.equal(dbHost(NEON), 'ep-cool-1-pooler.ap-southeast-1.aws.neon.tech')
  assert.ok(!dbHost(NEON).includes('secretpw'))
})
test('assertTarget', () => {
  assert.equal(assertTarget(LOCAL, 'local'), 'localhost')
  assert.throws(() => assertTarget(NEON, 'local'), /로컬 명령이 Neon/)
  assert.equal(assertTarget(NEON, 'neon'), 'ep-cool-1-pooler.ap-southeast-1.aws.neon.tech')
  assert.throws(() => assertTarget(LOCAL, 'neon'), /Neon이 아닙니다/)
  assert.throws(() => assertTarget('postgresql://u:p@evil-neon.tech.example.com/db', 'neon'), /Neon이 아닙니다/)
})
```
  `process.emitWarning`은 다음 틱에 이벤트를 보내므로, 경고 검사 테스트는 `await new Promise((r) => setImmediate(r))` 뒤에 단언한다. `pg-connection-string`의 경고는 프로세스당 한 번만 나오므로, 이 테스트는 이 파일 안에서 정규화하지 않은 문자열을 먼저 파싱하지 않는다.

- [ ] **Step 2: 실패 확인** — `node --test --conditions=react-server src/lib/db-config.test.ts` → 모듈 없음 FAIL.
- [ ] **Step 3: 구현** — `db-config.ts`는 `URL`로 파싱해 `sslmode`만 바꾸고 나머지 문자열 형태는 유지한다(바꿀 게 없으면 입력 그대로 반환). `db.ts`의 `new pg.Pool({ connectionString })`을 `new pg.Pool({ connectionString: normalizeConnectionString(connectionString), ...POOL_OPTIONS })`로 바꾼다. `db.ts`에서는 `assertTarget`을 부르지 않는다(운영 앱은 Neon, 로컬 앱은 Docker를 쓰므로).
- [ ] **Step 4: 통과 확인** — 같은 명령 PASS, `npm test`·`npm run lint`·`npm run build` 통과.
- [ ] **Step 5: 풀러 호환 확인** — `grep -rniE 'LISTEN |pg_advisory|SET (SESSION|search_path)' src scripts`가 테스트 파일 밖에서 아무것도 찾지 않음을 보고서에 남긴다.
- [ ] **Step 6: 커밋** — `git commit -m "feat: normalize db ssl and pool settings for neon"`

---

### Task 2: 필수 환경 변수 검사

**Files:**
- Create: `src/lib/env.ts`
- Modify: `src/lib/auth/callback.ts`, `src/app/auth/actions.ts`, `src/app/auth/google/callback/route.ts`
- Test: `src/lib/env.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type RequiredEnvName = 'APP_URL' | 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET'
  requiredEnv(name: RequiredEnvName): string   // trim 후 비어 있으면 throw Error(`${name} 환경 변수가 비어 있습니다.`)
  appUrl(): string                             // requiredEnv('APP_URL')에서 끝의 '/'를 뗀 값
  ```

- [ ] **Step 1: 실패하는 테스트 작성** — 각 테스트에서 `process.env`를 바꾸고 끝나면 원래 값으로 되돌린다.

```ts
test('requiredEnv: 값이 있으면 그대로', () => { withEnv({ GOOGLE_CLIENT_ID: 'abc' }, () => assert.equal(requiredEnv('GOOGLE_CLIENT_ID'), 'abc')) })
test('requiredEnv: 없거나 공백이면 이름이 담긴 오류', () => {
  for (const v of [undefined, '', '  ']) withEnv({ APP_URL: v }, () => assert.throws(() => requiredEnv('APP_URL'), /APP_URL 환경 변수가 비어 있습니다/))
})
test('appUrl은 끝의 / 를 뗀다', () => {
  withEnv({ APP_URL: 'https://study-class.vercel.app/' }, () => assert.equal(appUrl(), 'https://study-class.vercel.app'))
})
```
  `withEnv(vars, fn)`은 테스트 파일 안의 작은 도우미로 둔다(값이 `undefined`면 `delete`).
- [ ] **Step 2: 실패 확인** — 모듈 없음 FAIL.
- [ ] **Step 3: 구현 + 적용** — 세 파일의 `process.env.GOOGLE_CLIENT_ID ?? ''`, `process.env.GOOGLE_CLIENT_SECRET ?? ''`, `${process.env.APP_URL ?? ''}`, `new URL(..., process.env.APP_URL)`을 `requiredEnv`/`appUrl()`로 바꾼다. `callback.ts`에서는 기존 try 블록 안에서 읽어, 값이 비면 지금처럼 로그를 남기고 실패 결과를 돌려준다(로그에 값은 쓰지 않음). `route.ts`는 `appUrl()`이 throw하면 Next 기본 오류가 나도 된다(빈 주소로 리디렉션하지 않는 것이 요건). 모듈 최상위에서 읽지 않는다(빌드가 환경 변수 없이 성공해야 함).
  `callback.test.ts`가 환경 변수에 의존하게 되면 그 테스트 안에서 `withEnv`와 같은 방식으로 값을 넣는다.
- [ ] **Step 4: 통과 확인** — `npm test`·`npm run lint`·`npm run build`. 추가로 환경 변수 없이 빌드: `DATABASE_URL= APP_URL= GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= npm run build` 성공(빈 값은 `.env`보다 우선한다). 결과를 보고서에 남긴다.
- [ ] **Step 5: 커밋** — `git commit -m "feat: fail fast on missing auth env vars"`

---

### Task 3: 운영 DB 명령과 혼동 방지

**Files:**
- Create: `.env.neon.example`
- Modify: `package.json`, `.gitignore`, `scripts/db-apply.ts`, `scripts/seed.ts`, `scripts/sync-laws.ts`, `test/use-test-db.ts`
- Test: `scripts/db-target.test.ts` (아래 Step 1) — `npm test`의 glob(`src/**/*.test.ts`)에 걸리지 않으므로 `package.json` test 스크립트의 glob에 `scripts/**/*.test.ts`를 추가한다.

**Interfaces:**
- Consumes: Task 1의 `assertTarget`, `normalizeConnectionString`, `dbHost`, `DbTarget`.
- Produces:
  - 환경 변수 `DB_TARGET`(`local` 기본, `neon`): 스크립트가 어느 대상을 기대하는지.
  - 공용 함수 `scripts/db-target.ts`: `resolveScriptDb(env: NodeJS.ProcessEnv): { url: string; host: string; target: DbTarget }` — `DATABASE_URL` 없으면 throw, `DB_TARGET`이 `local|neon|undefined` 외 값이면 throw, `assertTarget` 통과 후 정규화된 url 반환.
  - npm 명령:
    ```json
    "db:apply:neon": "DB_TARGET=neon node --env-file=.env.neon scripts/db-apply.ts",
    "seed:neon": "DB_TARGET=neon node --env-file=.env.neon scripts/seed.ts",
    "sync:laws:neon": "DB_TARGET=neon node --env-file=.env.neon scripts/sync-laws.ts"
    ```
  - `.env.neon.example`: 주석 + `DATABASE_URL=`(Neon **direct** 주소, `-pooler` 없는 것) + `LAW_API_OC=`.
  - `.gitignore`에 `.env.neon` 추가 (`.env.neon.example`은 제외되지 않게).

- [ ] **Step 1: 실패하는 테스트 작성** (`scripts/db-target.test.ts`, DB 접속 없음)

```ts
const NEON = 'postgresql://u:p@ep-x.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
const LOCAL = 'postgresql://u:p@localhost:5433/my_study_cafe'
test('기본은 local, Neon 주소면 거부', () => {
  assert.equal(resolveScriptDb({ DATABASE_URL: LOCAL }).target, 'local')
  assert.throws(() => resolveScriptDb({ DATABASE_URL: NEON }), /로컬 명령이 Neon/)
})
test('DB_TARGET=neon은 Neon만 허용하고 정규화한다', () => {
  const r = resolveScriptDb({ DATABASE_URL: NEON, DB_TARGET: 'neon' })
  assert.equal(r.host, 'ep-x.ap-southeast-1.aws.neon.tech')
  assert.match(r.url, /sslmode=verify-full/)
  assert.throws(() => resolveScriptDb({ DATABASE_URL: LOCAL, DB_TARGET: 'neon' }), /Neon이 아닙니다/)
})
test('잘못된 DB_TARGET, 빈 DATABASE_URL은 거부', () => {
  assert.throws(() => resolveScriptDb({ DATABASE_URL: LOCAL, DB_TARGET: 'prod' }))
  assert.throws(() => resolveScriptDb({}))
})
```
- [ ] **Step 2: 실패 확인** — `node --test scripts/db-target.test.ts` FAIL.
- [ ] **Step 3: 구현**
  - 세 스크립트는 `resolveScriptDb(process.env)`로 url을 얻고, 접속 전에 `대상 DB: <host> (<target>)`를 출력한 뒤 `new pg.Client({ connectionString: url })`.
  - `test/use-test-db.ts`는 `DATABASE_URL`을 바꾼 **뒤** `assertTarget(process.env.DATABASE_URL, 'local')`을 부른다(Neon이면 테스트 시작 전에 멈춤).
  - `sync-laws.ts`의 `LAW_API_OC` 안내 문구는 `.env` 또는 `.env.neon`을 모두 언급하게 고친다.
- [ ] **Step 4: 통과 확인** — `npm test`(새 테스트 포함), `npm run lint`, `npm run build`. 로컬 명령이 여전히 동작: `npm run db:apply:test` 출력에 `대상 DB: localhost (local)`. 혼동 방지 확인(접속 없이 실패): `DATABASE_URL='postgresql://u:p@localhost:5433/x' DB_TARGET=neon node scripts/db-apply.ts` → `Neon이 아닙니다`로 종료. `git check-ignore .env.neon` 이 경로를 출력하고 `git check-ignore .env.neon.example`은 아무것도 출력하지 않음.
- [ ] **Step 5: 커밋** — `git commit -m "feat: add neon db commands with target guards"`

---

### Task 4: 삭제 요청 SQL 절차

**Files:**
- Create: `docs/ops/delete-user.sql`, `docs/ops/README.md`
- Test: `src/lib/ops/delete-user.test.ts`

**Interfaces:**
- Consumes: `db/init.sql` 외래 키 (설계 5.5에 정리됨), 테스트 도우미 `upsertGoogleUser`, `query`, `closePool`.
- Produces: `docs/ops/delete-user.sql` — 한 파일, 두 부분:
  1. **확인 조회** (주석 `-- 1) 먼저 이것만 실행해 대상과 건수를 확인`): 이메일 하나로 사용자 id·이름과 질문 수·답변 수·진도 행 수를 보여 주는 `SELECT`.
  2. **삭제** (주석 `-- 2) 확인 후 이 블록 실행`): `BEGIN;` → 그 사용자의 `answers` 삭제 → 그 사용자의 `questions` 삭제 → `users` 행 삭제 → `COMMIT;`.
  - 이메일은 파일 맨 위 한 군데만 바꾸면 되게 한다: 각 문장이 `(SELECT id FROM users WHERE email = 'user@example.com')`을 쓰되 **리터럴 `'user@example.com'`이 파일 안에서 정확히 같은 문자열로만** 나온다(테스트가 이 문자열을 바꿔 실행함). psql 변수 같은 Neon SQL Editor에서 안 되는 문법은 쓰지 않는다.
  - 같은 이메일의 사용자가 둘 이상이면 아무것도 지우지 않는다(예: 삭제 문장의 서브쿼리에 `HAVING count(*) = 1` 조건, 또는 확인 조회에서 경고 — 방식은 구현자 재량, 테스트로 고정).

- [ ] **Step 1: 실패하는 테스트 작성** — TEST DB에서: 사용자 `victim`, `other` 생성(이메일은 `randomUUID()` 기반). victim의 질문 1개(other가 답변 1개), other의 질문 1개(victim이 답변 1개), victim의 진도(`user_settings` 한 행)와 세션(`createSession`) 준비. 파일을 읽어 `'user@example.com'`을 victim 이메일 리터럴로 바꾼 뒤 **삭제 블록만** `query`로 실행(확인 조회 부분과 분리하는 기준은 `-- 2)` 주석).
  - 단언: victim의 users·sessions·user_settings·questions·answers 행 0개, victim 질문에 달렸던 other의 답변도 0개, other의 질문과 other 사용자는 남음, other 질문에 달렸던 victim 답변은 사라짐.
  - 확인 조회 블록도 실행해 오류 없이 1행을 돌려주는지 단언.
  - `after`에서 남은 테스트 데이터 정리, `closePool()`.
- [ ] **Step 2: 실패 확인** — 파일 없음 FAIL.
- [ ] **Step 3: 구현** — SQL 파일, `docs/ops/README.md`(Neon 콘솔 SQL Editor 여는 법 → 이메일 바꾸기 → 1) 실행·확인 → 2) 실행 → 결과 확인, 처리 기록을 남기라는 한 줄).
- [ ] **Step 4: 통과 확인** — `npm test`, `npm run lint`, `npm run build`.
- [ ] **Step 5: 커밋** — `git commit -m "docs: add user deletion procedure"`

---

### Task 5: 개인정보처리방침 페이지와 공통 링크

**Files:**
- Create: `src/app/privacy/page.tsx`
- Modify: `src/app/layout.tsx` (공통 푸터 링크)

**Interfaces:**
- Consumes: 없음 (정적 페이지, DB·쿠키 읽지 않음).

- [ ] **Step 1: 페이지 작성** — 제목 "개인정보 처리방침". 설계 5.5의 항목을 절로 둔다: 처리 목적 / 수집 항목(구글 계정 식별자, 이메일, 이름, 프로필 사진 주소, 학습 진도·시험일, 작성한 질문·답변, 로그인 세션 정보) / 보유 기간(삭제 요청 시까지, 요청 시 지체 없이 파기) / 처리 위탁 및 국외 이전(Vercel — 호스팅, `[Vercel 함수 리전]`; Neon — 데이터베이스, `[Neon 리전]`) / 정보주체의 권리와 행사 방법(운영자 연락처로 열람·정정·삭제 요청) / 개인정보 보호책임자(`[이름]`, `[연락처]`) / 시행일(`[시행일]`). 각 절 제목 옆에 근거 조문을 3단 화면 링크로 단다: 처리방침 → `/articles/law/30`, 삭제 요구 → `/articles/law/36`. 자리 표시(`[…]`)는 눈에 띄게(예: 강조 표시) 두고, 페이지 맨 위에 "초안 — 운영자가 검토 후 확정" 안내를 둔다.
- [ ] **Step 2: 공통 링크** — 루트 레이아웃 아래쪽에 `개인정보 처리방침` 링크(`/privacy`) 푸터. 모든 화면(학습판, 3단, 게시판, 404)에서 보여야 한다.
- [ ] **Step 3: 확인** — `npm test`, `npm run lint`, `npm run build`. dev 서버(`.claude/launch.json`의 `next-dev`)에서 로그아웃 상태로 `/privacy` 200, `/`·`/articles/law/29`·`/questions`·`/questions/abc`(404)에 푸터 링크가 있음, 375px 가로 넘침 없음. `DATABASE_URL`이 잘못돼도 `/privacy`는 열려야 하므로 페이지에 DB·`connection()` 호출이 없음을 확인.
- [ ] **Step 4: 커밋** — `git commit -m "feat: add privacy policy page"`

---

### Task 6: 배포 문서

**Files:**
- Modify: `README.md`, `docs/DB_DESIGN.md` (이전 주의점 절), `CLAUDE.md` (1.4 비목표 한 줄)

- [ ] **Step 1: README "배포 (Vercel + Neon)" 절** — 설계 7장의 사용자 작업을 순서대로 체크리스트로: Neon 프로젝트(아시아 리전) → pooled/direct 문자열 → `.env.neon`(`cp .env.neon.example .env.neon`) → `npm run db:apply:neon` → `npm run sync:laws:neon` → `npm run seed:neon` → Vercel 프로젝트 이름 확정(주소) → 구글 콘솔(secret 재발급, 리디렉션 URI 추가) → Vercel 가져오기·**Production에만** 환경 변수(`DATABASE_URL`=pooled, `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)·함수 리전을 Neon과 같게 → 배포 → 동의 화면 홈페이지·처리방침 링크 후 프로덕션 게시 → `/privacy` 자리 표시 채우기 → 완료 기준 확인(설계 2.1). 각 명령은 따로 코드 블록.
  - 연결 수 설정 근거 한 줄(풀 최대 5, 유휴 10초 — 서버리스 인스턴스가 여럿 떠도 Neon pooler가 받아 줌).
  - 미리보기 배포에는 DB가 없어 DB 화면이 오류 날 수 있다는 안내.
  - 문제 해결: 로그인 실패 시 `APP_URL`(끝 `/` 없음, https), 리디렉션 URI 정확히 일치, 동의 화면 게시 상태 확인. "대상 DB가 Neon이 아닙니다" 오류는 `.env.neon` 확인.
  - 삭제 요청 처리는 `docs/ops/README.md` 링크.
- [ ] **Step 2: DB_DESIGN** — 이전 주의점을 실제 절차와 맞춤(Neon pooled/direct 구분, `sslmode` 정규화는 코드가 함, Supabase 문구는 대안으로 남김).
- [ ] **Step 3: CLAUDE.md 1.4** — "Supabase 연동 및 Render 배포" 항목을 "Vercel + Neon 배포는 `docs/superpowers/specs/2026-11-05-vercel-neon-deploy-design.md`로 진행(다른 플랫폼은 비목표)"로 바꾼다. 그 외는 건드리지 않는다.
- [ ] **Step 4: 확인** — `npm test`, `npm run build`. README의 명령 이름이 `package.json`과 일치하는지 대조.
- [ ] **Step 5: 커밋** — `git commit -m "docs: add vercel + neon deployment guide"`

---

## 계획 이후 (사용자 + 컨트롤러)

구현 태스크가 끝나고 브랜치를 병합한 뒤, 사용자가 README 체크리스트대로 콘솔 작업을 하고 컨트롤러가 각 단계 결과(명령 출력, 배포 주소 접속)를 함께 확인한다. 운영 Neon에 처음 접속하는 `db:apply:neon` 출력이 Review Focus 1의 실제 확인이다.
