# ISMS-P 스터디 까페 — PRD

- 상위 문서: [CLAUDE.md](CLAUDE.md)
- 상세 설계 스펙: [docs/superpowers/specs/2026-11-03-study-cafe-mvp-design.md](docs/superpowers/specs/2026-11-03-study-cafe-mvp-design.md)
- DB 설계: [docs/DB_DESIGN.md](docs/DB_DESIGN.md)

## 1. 배경

ISMS-P / CPPG를 준비하는 사람들이 함께 개인정보 보호법을 공부하는 온라인 공부방이다. 대시보드에서 법 조문을 따라 내려가다 시행령에서 "세부 기준은 보호위원회가 고시한다"로 끝나면, 실제 해야 할 일(예: 「개인정보의 안전성 확보조치 기준」 제7조 암호화)은 고시 원문을 봐야 알 수 있다. 그래서 이번 구현의 중심은 **법 → 시행령 → 고시를 한 화면에서 원문으로 보는 것**, 그리고 막히면 **바로 질문하고 스터디원이 답하는 것**이다.

## 2. 목표

| # | 목표 | 성공 기준 |
|---|---|---|
| M1 | 구글 로그인 | 구글 계정으로 로그인 → 새로고침·서버 재시작 후에도 유지, 로그아웃 가능 |
| M2 | 법령 대시보드 | 법령 허브의 5개 탭이 DB 데이터로 동작, 진도가 사용자별로 DB에 저장 |
| M3 | 3단 원문 조회 | 조문 번호를 누르면 법 · 시행령 · 고시 원문이 세 칸으로 표시 (법 제29조 → 영 제30조 → 고시 제4~12조) |
| M4 | 문의 게시판 | 로그인 사용자 누구나 질문·답변, 답변 달린 질문 표시, 조문 태그 질문 |
| M5 | G2~G4 유지 | 영속성, 서버 전용 DB 접근 + 파라미터화 SQL, Supabase/Neon에서 같은 `init.sql`로 재생성 |

## 3. 비목표

- 복습 리마인드 퀴즈, 간격 반복
- 시험 문제 풀이 · 오답노트
- 개인정보보호위원회 결정문 API
- 게시판 알림, 답변 채택, 추천, 첨부파일, 대댓글
- 「안전성 확보조치 기준」 외의 고시 화면
- Supabase/Neon 실제 이전, Render 배포
- 상태관리 라이브러리, ORM, 인증 라이브러리, 별도 REST API (예외: 구글 OAuth 콜백 Route Handler 하나)

## 4. 사용자와 흐름

사용자: 로그인해서 함께 공부하는 모든 사람. 관리자·답변 전담자는 없다.

1. 구글로 로그인한다.
2. 대시보드에서 배점 대비 덜 본 단원을 확인한다.
3. 조문 매핑표나 앵커에서 법 제29조를 누른다.
4. 3단 원문 화면에서 법 · 시행령 · 고시를 나란히 읽는다.
5. 모르면 "이 조문에 대해 질문하기"로 조문 태그가 붙은 질문을 작성한다.
6. 다른 스터디원이 답을 달면 목록에 "답변 있음"이 표시된다.
7. 회독 체크·암기 카드 단계가 내 계정에 저장된다.

비로그인 사용자도 대시보드·3단 원문·게시판 읽기는 가능하다. 진도 저장·질문·답변은 로그인이 필요하다.

## 5. 기능 요구사항

- **구글 로그인**: OAuth 2.0 Authorization Code 흐름 직접 구현(`fetch` + Node `crypto`). 사용자 식별은 `(provider, provider_user_id)`. 세션은 DB `sessions`에 토큰 해시 저장, 쿠키는 `httpOnly; SameSite=Lax`.
- **법령 대시보드**: 개요·진도 / 마인드맵 / 암기 카드 / 조문 매핑표 / 개정 연혁. 회독 1~3회, 카드 3단계, 시험일 D-day.
- **3단 원문 조회**: 법률·시행령(국가법령정보센터 OPEN API)과 고시(API 우선, 실패 시 `docs/sources/` PDF)를 미리 받아 DB에 저장하고 화면은 DB만 읽는다. 기준 법령(공포번호·시행일)과 받은 날짜를 표시한다.
- **문의 게시판**: 질문·답변, "답변 있음" 표시, 조문 태그, 자기 글만 수정·삭제(답변 있는 질문은 소프트 삭제), 본문은 일반 텍스트.

## 6. 비기능 요구사항

| ID | 구분 | 요구사항 |
|---|---|---|
| NFR-1 | 영속성 | PostgreSQL 데이터는 Docker named volume에 저장 |
| NFR-2 | 보안 | DB 접속 정보는 `.env`의 `DATABASE_URL`, Git 미커밋 (`.env.example`만 커밋) |
| NFR-3 | 보안 | DB 모듈은 `import 'server-only'` |
| NFR-4 | 보안 | 모든 SQL은 `$1, $2` 파라미터화 |
| NFR-5 | 이식성 | 표준 PostgreSQL SQL만 사용, Supabase/Neon에서 같은 스크립트로 재생성 |
| NFR-6 | 단순성 | 런타임 의존성 `next`, `react`, `react-dom`, `pg` 정도로 최소화 |
| NFR-7 | 실행 환경 | Docker에는 PostgreSQL만, Next.js는 macOS에서 `npm run dev` |

실패 조건: 원문이 틀리거나 오래된 사실이 드러나지 않음, 외부 API 장애 시 3단 화면 불가, 브라우저 번들에 비밀값 포함, 타인 글 수정·삭제 가능.

## 7. 기술 스택

Next.js 16.4 (App Router, Server Actions) · React + TypeScript · PostgreSQL 17 (Docker Compose) · `pg` (ORM 없음). 상세는 [CLAUDE.md](CLAUDE.md) 5장.

## 8. 단계 계획

| 단계 | 작업 | 산출물 | 완료 기준 |
|---|---|---|---|
| 1단계 | PRD · DB 설계 | `PRD.md`, `docs/DB_DESIGN.md` | 문서 검토 완료 |
| 2단계 | DB 환경 구성 | `docker-compose.yml`, `db/init.sql`, `.env.example`, `.gitignore` | 관련 테이블들 생성 확인 |
| 3단계 | Next.js 프로젝트 생성 | `create-next-app` 결과물, `pg` 설치 | `npm run dev` 후 기본 페이지 표시 |
| 4단계 | DB 연결 모듈 | `src/lib/db.ts`, `src/lib/types.ts` | 서버에서 `SELECT 1` 성공 |
| 5단계 | 구글 로그인 | 사용자·세션 테이블, 로그인/로그아웃 Server Action, OAuth 콜백 Route Handler, 세션 유틸 | 로그인이 새로고침·재시작 후 유지, 로그아웃 동작 |
| 6단계 | 법령 대시보드 + 3단 원문 | seed SQL, 법령 API 동기화 스크립트, 대시보드 5개 탭, 3단 원문 화면, 진도 저장 | 법 제29조 → 영 제30조 → 고시 원문 세 칸 표시, 회독 체크 유지 |
| 7단계 | 문의 게시판 | 질문·답변 테이블, 목록/상세/작성/수정/삭제 화면, 조문 태그 | 3단 화면에서 질문 → 다른 계정 답변 → "답변 있음" 표시 |
| 8단계 | 검증 및 정리 | `README.md` | 새로고침·앱 재시작·컨테이너 재시작 후 데이터 유지 |

## 9. 사용자가 직접 해야 하는 일

- Google Cloud Console에서 OAuth 클라이언트 생성, 리디렉션 URI `http://localhost:3000/auth/google/callback` 등록 → `.env` 입력 (5단계 전)
- 국가법령정보센터 OPEN API 활용신청(승인 1~2일) → `LAW_API_OC`를 `.env`에 입력 (6단계 전)
