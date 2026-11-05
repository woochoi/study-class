# ISMS-P 스터디 까페 — Vercel + Neon 배포 설계

- 작성일: 2026-11-05
- 브랜치: `feature/vercel-neon` (master 527cfb7에서 시작)
- 앞선 설계: [2026-11-03-study-cafe-mvp-design.md](2026-11-03-study-cafe-mvp-design.md) — 이 문서는 그 위에 "외부 공개"만 더한다.
- 표기: **(결정)** = 사용자가 정한 것, **(설계자 판단)** = 사용자가 맡기거나 묻지 않아 설계자가 정한 것.

## 1. 의도 — 왜 하는가

로컬(`localhost:3000` + Docker PostgreSQL)에서 1~8단계가 모두 동작하는 것을 확인했다. 이제 학원 스터디를 함께하는 **지인 약 20명**이 각자 구글로 가입·로그인해서 같은 사이트에서 공부하고 질문·답변을 주고받게 한다 **(결정)**.

## 2. 목표 · 비목표 · 실패 조건

### 2.1 목표

| # | 목표 | 성공 기준 |
|---|---|---|
| D1 | 공개 주소로 배포 | `https://<프로젝트>.vercel.app`에서 대시보드·3단 원문·게시판이 열린다 |
| D2 | 외부 DB 연동 | 운영 데이터가 Neon PostgreSQL에 저장되고, 재배포·재시작 후에도 유지된다 |
| D3 | 누구나 구글로 가입 | 구글 OAuth 앱을 **프로덕션으로 게시**해 테스트 사용자 등록 없이 구글 계정으로 가입·로그인된다 **(결정)** |
| D4 | 개인정보처리방침 공개 | `/privacy` 페이지가 있고 모든 화면에서 링크로 갈 수 있다 |
| D5 | 로컬 개발 유지 | 로컬은 지금처럼 Docker DB + `npm run dev`로 동작하고, 테스트는 로컬 TEST DB를 쓴다 |

**완료 기준:** 배포 주소에서 다른 사람이 구글로 가입한다 → 회독 체크·카드 단계·시험일을 저장한다 → 질문을 쓰고, 또 다른 계정이 답변한다 → 다시 접속해도 모두 남아 있다.

### 2.2 비목표 (이번에 하지 않음)

- 개인 도메인 연결. Vercel 무료 주소(`*.vercel.app`)를 쓴다 **(결정)**.
- 로컬 사용자 데이터(내 진도·시험일·질문) 이전. 운영 DB는 **모든 사용자가 0에서 시작**한다 **(결정)**. 법령 원문과 학습 데이터만 넣는다.
- 셀프 회원 탈퇴 버튼 **(결정: 이번엔 없음)**. 삭제 요청은 운영자가 처리한다(5.5).
- 미리보기 배포(Preview)에서의 로그인. 브랜치 미리보기는 화면 확인용이다(5.6).
- 도배 방지(작성 횟수 제한), 관리자 기능, 알림, 모니터링 도구 연동. 20명 규모라 이번에는 두지 않는다 **(설계자 판단)**.
- Supabase, Render 등 다른 플랫폼.
- 새 런타임 의존성(`@vercel/functions`, `@neondatabase/serverless` 등). 지금처럼 `pg`만 쓴다 (CLAUDE.md NFR-6).

### 2.3 실패 조건 (동작해도 실패로 보는 것)

- 운영 DB 접속 정보, 구글 client secret, 법령 API `OC`가 Git 저장소(공개)나 브라우저 번들에 들어간다.
- 채팅에 노출된 적 있는 구글 client secret을 운영에 그대로 쓴다. → 운영에는 **새로 발급한 secret**만 쓴다.
- 운영용 명령(스키마 적용·seed·동기화)이 실수로 로컬 DB에, 또는 로컬용 명령이 운영 DB에 실행된다.
- 운영 DB에 로컬 테스트 데이터(테스트 사용자·질문)가 섞인다.
- DB 연결이 암호화되지 않는다(SSL 없이 접속).
- 사용자가 늘면 DB 연결 수가 넘쳐 사이트가 멈춘다.
- 개인정보처리방침이 실제 처리 내용(수집 항목·위탁·국외 이전)과 다르다.

## 3. 제약

- 앞선 설계와 CLAUDE.md 4~6장을 그대로 따른다. Server Actions, 파라미터화 SQL, `server-only` DB 모듈, 표준 PostgreSQL만 쓰고, 별도 REST API는 두지 않는다(OAuth 콜백 하나만 예외).
- 법령 API(`LAW_API_OC`)는 **등록된 IP(사용자 집 PC)에서만** 호출된다. 그래서 Vercel 서버는 법령 API를 부르지 않고, 원문 동기화는 집 PC에서 Neon을 대상으로 실행한다. 이미 화면은 DB만 읽는 구조라 앱 코드는 바뀌지 않는다.
- 사용자는 Neon과 Vercel에 이미 가입해 두었다(계정 이메일은 사용자 본인). **콘솔 작업(프로젝트 생성, 연결 문자열 복사, 환경 변수 입력, 구글 콘솔 설정)은 사용자가 직접 한다.** 빌더는 절차를 문서로 안내하고, 비밀값을 출력·커밋하지 않는다.
- GitHub `woochoi/study-class`는 **공개 저장소**다.

## 4. 구성

```text
지인 브라우저 ──https──▶ Vercel (Next.js 16, *.vercel.app)
                           │  DATABASE_URL = Neon pooled 주소 (SSL)
                           ▼
                        Neon PostgreSQL (운영)
                           ▲
사용자 집 PC ──────────────┘  .env.neon: Neon direct 주소 (SSL)
  npm run db:apply:neon / seed:neon / sync:laws:neon
  (법령 API는 집 IP에서만 호출됨)

로컬 개발: npm run dev ─▶ Docker PostgreSQL :5433 (지금과 같음, .env)
```

- `master`에 푸시하면 Vercel이 운영(Production)에 자동 배포한다 **(설계자 판단)**.
- 리전: Vercel 함수와 Neon DB를 **같은 아시아 리전**에 둔다. Neon에서 고를 수 있는 가장 가까운 리전을 고르고, Vercel 함수 리전을 그에 맞춘다(설정 위치는 빌더 재량: `vercel.json` 또는 대시보드) **(설계자 판단)**.

## 5. 기능 상세

### 5.1 DB 연결 (코드 변경)

- `src/lib/db.ts`는 `DATABASE_URL`을 그대로 쓰되 다음을 만족해야 한다 **(설계자 판단)**:
  - Neon 연결은 SSL로 한다. 연결 문자열의 `sslmode`(Neon 인증서는 공인 CA이므로 인증서 검증까지 하는 방식)로 처리하는 것을 우선하고, 로컬 Docker 연결은 지금처럼 SSL 없이 동작해야 한다. `pg` 버전의 `sslmode` 처리 경고가 로그에 남지 않게 한다.
  - 서버리스 환경에서 연결이 넘치지 않도록 풀 크기를 작게 하고 유휴 연결을 빨리 닫는다. 수치는 빌더 재량, 근거를 README에 한 줄로 남긴다.
- 사이트(Vercel)는 Neon **pooled** 주소, 스크립트(스키마 적용·seed·동기화)는 Neon **direct** 주소를 쓴다 **(설계자 판단)**. 여러 문장을 한 번에 실행하는 `init.sql`·트랜잭션 동기화가 풀러에서 문제를 일으키지 않게 하기 위해서다.
- 사용자는 Neon 콘솔이 주는 연결 문자열을 **그대로 붙여 넣는다** **(설계자 판단)**. 그 문자열의 `sslmode` 값을 `pg`가 경고 없이 안전하게(인증서 검증 포함) 처리하도록 하는 것은 코드 쪽 책임이다. 사용자가 문자열을 손으로 고쳐야 하는 방식은 피한다.
- 풀러(트랜잭션 모드) 호환성을 계획 단계에서 **확인 항목으로 둔다**: 요청 경로에 세션 상태(`SET`, `LISTEN`, advisory lock, 이름 붙은 prepared statement)가 없는지 검색한다. `withTransaction`은 한 연결에서 `BEGIN/COMMIT`하므로 문제없다.
- 운영(`NODE_ENV=production`)에서 `DATABASE_URL`·`APP_URL`·`GOOGLE_CLIENT_ID`·`GOOGLE_CLIENT_SECRET` 중 하나라도 비어 있으면 **알아볼 수 있는 오류로 바로 실패**하게 한다(빈 `APP_URL`로 조용히 잘못된 리디렉션을 만들지 않음) **(설계자 판단)**. 빌드 단계는 이 검사 때문에 실패하지 않아야 한다(검사는 요청 시점).

### 5.2 운영 DB 준비 (집 PC에서)

- 운영 전용 환경 파일 `.env.neon` (Git 제외, `.gitignore`에 추가)과 견본 `.env.neon.example`(값 없이 커밋)을 둔다 **(설계자 판단)**. 내용은 `DATABASE_URL`(Neon direct)과 `LAW_API_OC` 두 개다.
- npm 명령을 따로 둔다: `db:apply:neon`, `seed:neon`, `sync:laws:neon`. 각각 **`.env.neon`만** 읽는다(`.env`를 함께 읽지 않음 — 어느 `DATABASE_URL`이 이기는지 헷갈리지 않게).
- 운영 명령은 대상 DB를 확인할 수 있게 **접속 호스트(비밀번호 제외)를 먼저 출력**하고, 대상이 `localhost`/`127.0.0.1`이면 실행을 거부한다. 반대로 기존 로컬 명령(`db:apply`, `db:apply:test`, `seed`, `sync:laws`, `npm test`)은 호스트가 `.neon.tech`로 끝나면 거부한다 **(설계자 판단, 2.3 혼동 방지)**. 검사는 **실제로 접속할 최종 연결 문자열**(테스트는 `TEST_DATABASE_URL`로 바꾼 뒤의 값)을 기준으로 한다.
- 순서: `db:apply:neon` → `sync:laws:neon` → `seed:neon`. 셋 다 지금처럼 여러 번 실행해도 결과가 같다.
- 운영 DB에는 TEST DB를 만들지 않는다. 테스트는 로컬 TEST DB에서만 돈다.

### 5.3 Vercel 설정 (사용자가 대시보드에서)

- GitHub `woochoi/study-class` 저장소를 가져와 프로젝트를 만든다. Production 브랜치는 `master`.
- Production 환경 변수: `DATABASE_URL`(Neon pooled), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`(새로 발급), `APP_URL`(`https://<프로젝트>.vercel.app`, 끝에 `/` 없음). `LAW_API_OC`와 `POSTGRES_*`, `TEST_DATABASE_URL`은 넣지 않는다.
- 빌드 명령은 기본값(`next build`). 빌드 중에 DB 접속이 필요하지 않아야 한다(지금 구조는 DB 읽기를 요청 시점으로 미뤄 두었음) — 빌더가 확인한다.

### 5.4 구글 로그인

- Google Cloud Console에서 (사용자가):
  - 승인된 리디렉션 URI에 `https://<프로젝트>.vercel.app/auth/google/callback` 추가 (로컬 주소는 남겨 둠).
  - client secret 새로 발급 → 로컬 `.env`와 Vercel에 새 값 입력, 옛 secret 폐기.
  - OAuth 동의 화면: 앱 이름, 지원 이메일, 홈페이지(`https://<프로젝트>.vercel.app`), 개인정보처리방침(`/privacy`) 링크를 넣고 **프로덕션으로 게시** **(결정)**. 요청 범위는 지금처럼 `openid email profile`만.
- 앱 코드는 이미 `APP_URL`로 콜백 주소를 만들고, 운영에서 쿠키를 `secure`로 둔다. 빌더는 운영 주소에서 쿠키·리디렉션이 맞는지 확인할 절차를 남긴다.

### 5.5 개인정보처리방침 `/privacy`와 삭제 요청 처리

- 법적 근거: 개인정보 보호법 제30조(처리방침 수립·공개), 제36조(삭제 요구). 문구의 최종 확정은 **사용자가 직접 검토**한다 — 빌더는 초안을 쓴다.
- 초안에 들어갈 내용 (실제 처리와 일치해야 함):
  - 처리 목적: 회원 식별·로그인, 학습 진도 저장, 문의 게시판 운영
  - 수집 항목: 구글 계정 식별자, 이메일, 이름, 프로필 사진 주소, 학습 진도·시험일, 작성한 질문·답변, 로그인 세션 정보
  - 보유 기간: 삭제(탈퇴) 요청 시까지, 요청 시 지체 없이 파기
  - 처리 위탁 및 국외 이전: Vercel(호스팅), Neon(DB) — 서버 위치·이전 항목 기재. 리전은 사용자가 콘솔에서 고른 뒤 정해지므로 **`[Neon 리전]`, `[Vercel 함수 리전]` 자리 표시로 두고 사용자가 채운다** **(설계자 판단)**
  - 정보주체의 권리와 행사 방법: 운영자 연락처로 열람·정정·삭제 요청
  - 개인정보 보호책임자(운영자) 연락처 — **빌더는 자리만 두고, 실제 값은 사용자가 채운다**
  - 시행일
- 모든 화면의 공통 영역(푸터 등)에 `/privacy` 링크를 둔다. 로그인 없이 볼 수 있어야 한다.
- 삭제 요청 처리 **(설계자 판단: 탈퇴자의 질문·답변도 함께 삭제)**: 운영자가 Neon SQL Editor에서 실행할 **삭제 SQL 절차**를 `docs/`에 남긴다. `db/init.sql` 기준 외래 키(확인함):
  - `sessions`, `user_unit_reads`, `user_card_levels`, `user_settings`의 `user_id` → `ON DELETE CASCADE`
  - `answers.question_id` → `ON DELETE CASCADE`
  - `questions.author_id`, `answers.author_id` → 동작 지정 없음(삭제 막힘) — 그래서 직접 지워야 한다
  - 순서: 그 사용자의 답변 삭제 → 그 사용자의 질문 삭제(달린 다른 사람 답변도 함께 삭제됨) → 사용자 행 삭제(세션·진도·설정 자동 삭제). 한 트랜잭션에서, 먼저 이메일로 대상 사용자와 지워질 건수를 조회해 확인한 뒤 실행한다. 사용자는 이메일만 바꿔 넣는다.
  - 이 절차는 로컬 TEST DB에서 한 번 실행해 보는 테스트로 고정한다.

### 5.6 미리보기 배포

- `master` 외 브랜치를 푸시하면 Vercel이 미리보기 주소를 만든다. 미리보기 주소는 구글 리디렉션 URI에 없으므로 **로그인은 되지 않는다** **(설계자 판단)**.
- 미리보기에는 **운영 DB를 주지 않는다** **(설계자 판단)**: 환경 변수는 Production에만 넣는다. 미리보기 빌드는 성공해야 하고(빌드 중 DB 접속 없음), 미리보기 화면에서 DB가 필요한 곳은 오류가 날 수 있음을 README에 적는다.

## 6. 문서

- `README.md`에 "배포(Vercel + Neon)" 절: 사용자 콘솔 작업 체크리스트(Neon → Vercel → 구글 순서), `.env.neon` 사용법, 운영 DB 준비 명령, 배포 후 확인 순서(2.1 완료 기준), 문제 해결(로그인 실패 시 확인할 것: `APP_URL`, 리디렉션 URI, 쿠키).
- `docs/DB_DESIGN.md` 8장(이전 주의점)을 실제 절차와 맞춘다.
- `CLAUDE.md` 1.4 비목표의 "Supabase 연동 및 Render 배포" 항목을 이번 결정(Vercel + Neon 배포)에 맞게 고친다.
- 삭제 요청 SQL 절차 문서 (5.5).

## 7. 사용자가 직접 해야 하는 일 (순서)

1. Neon: 프로젝트 생성(아시아 리전) → pooled·direct 연결 문자열 복사
2. 집 PC: `.env.neon`에 direct 주소와 `LAW_API_OC` 입력 → `db:apply:neon` → `sync:laws:neon` → `seed:neon`
3. Vercel: 프로젝트 이름(기본 `study-class`)을 **먼저 정해** 운영 주소 `https://<이름>.vercel.app`을 확정한다 **(설계자 판단: 주소를 먼저 정해 구글 설정과 `APP_URL`을 한 번에)**
4. 구글 콘솔: client secret 재발급, 리디렉션 URI에 3번 주소 추가
5. Vercel: 저장소 가져오기 → Production 환경 변수 입력(`APP_URL` = 3번 주소) → 배포
6. 구글 콘솔: 동의 화면에 홈페이지·처리방침 링크 → 프로덕션 게시
7. `/privacy` 문구 검토, 보호책임자 연락처와 리전 입력
8. 다른 계정으로 완료 기준 확인 → 지인에게 주소 공유

## 8. 빌더 재량

- 풀 크기·유휴 시간 수치, SSL 처리를 연결 문자열로 할지 코드로 할지(2.3 만족 조건).
- 운영/로컬 DB 혼동 방지 검사의 위치와 방식.
- 리전 설정 위치(`vercel.json` 또는 대시보드 안내).
- `/privacy` 화면 구성과 공통 링크 위치.
