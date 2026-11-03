# ISMS-P 온라인 스터디 까페

ISMS-P (정보보호 및 개인정보보호 관리체계 인증 심사 전문가 자격) 을 위해 개인정보보호법을 공부하고 있다.
혼자 공부하기 어려워 온라인 커뮤니티 형식으로 같이 공부도 하고 관련 시험 문제들 올려서 같이 풀어보고 오답노트까지 작성하는 사이트

## 1. 개요
ISMS-P (정보보호 및 개인정보보호 관리체계 인증 심사 전문가 자격) 공부 및 합격을 위한 온라인 공부방을 만든다.

### 1.1 사전 참고
** 반드시 먼저 [구글 드라이브 URL], [개인정보보호법 URL], [개인정보보호법 3단 비교 URL] 사이트를 참고해라. **
- 개인정보보호법 자료는 아래 구글드라이브에 있다. (볍, 시행령, 고시 등)
  - [구글 드라이브 URL] : https://drive.google.com/drive/u/0/folders/1_dWEFCEObpCGSo8ZjxGqmAFAcvuTOxDw
- 개인정보보호법 구조는 3단 구조이다
  - 법 -> 시행령 -> 시행규칙 (고시)
  - 법조문 단계 : 조,항,호,목
- [개인정보보호법 URL] : https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=213857&efYd=20200805&ancYnChk=0#AJAX
https://www.law.go.kr/LSW/lsStmdInfoP.do?lsiSeq=213857&ancYnChk=0
- [개인정보보호법 3단 비교 URL] : https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=213857&lsId=011357&chrClsCd=010102&viewCls=lsPtnThdCmp&ancYnChk=0#20200805
- 사이트 내 공부 대시보드는 해당 문서를 참고한다. [CPPG 법령 허브.html], [CPPG 시행령 허브.html]

### 1.2 첫번째 목표

| # | 목표 | 성공 기준 |
|---|---|---|
| G1 | 법령(시행령) 대시보드 및 문의 질문/답변 게시판, 법령 상세 조회 | 함께 대시보드 기능을 이용하여 학습할 수 있게 함 |
| G2 | 데이터 영구 저장 | 새로고침, Next.js 재시작, Docker 컨테이너 재시작 후에도 데이터 유지 |
| G3 | 안전한 DB 접근 | DB 접속은 서버 코드에서만, 비밀번호는 환경변수, SQL은 모두 파라미터화 |
| G4 | 이전 가능성 | 같은 SQL 스크립트로 Supabase PostgreSQL에 동일한 테이블 생성 가능 |

### 1.3 두번째 목표
- 회원가입 / 로그인(구글 로그인), 사용자별 데이터 분리
- 외부 API 연동 :
  - [국가법령정보센터 OPEN API] : https://open.law.go.kr/LSO/openApi/guideList.do
  - [개인정보보호위원회_결정문 목록 조회 API] : https://www.data.go.kr/data/15103265/openapi.do?recommendDataYn=Y

### 1.4 비목표 (이번 구현에서는 하지 않는 것)
- 별도 REST API (`app/api/*` Route Handler 포함), Express · NestJS · Spring Boot 같은 별도 백엔드 (예외: 구글 OAuth 콜백 `src/app/auth/google/callback/route.ts` 하나)
- Supabase 연동 및 Render 배포 (설계만 이전 가능하게 해 두고 실제 이전은 하지 않음)
- Redux · Zustand · React Query 같은 상태 관리 라이브러리, ORM(Prisma, Drizzle 등)


## 2. 사용자와 사용 시나리오

**사용자**: 내 스터디 까페에서 로그인해서 공부를 하는 모든분
**시나리오 흐름** : 
- 스터디 까페에 로그인 후 법령 대시보드를 보고 공부를 하다가 궁금한게 있으면 문의 게시판에 문의을 하고 답변을 한다.
- 대시 보드에서 모르는 법령에 대해서 상세 조회를 할 수 있게 한다.

## 3. 기능 요구사항
- 회원 가입 및 구글 로그인
- 문의 답변 게시판
- 법령 상세 조회 기능 (구글 드라이브 및 오픈 API 이용)

## 4. 비기능 요구사항

| ID | 구분 | 요구사항 |
|---|---|---|
| NFR-1 | 영속성 | PostgreSQL 데이터는 Docker **named volume**에 저장해 컨테이너를 지웠다 다시 만들어도 유지 |
| NFR-2 | 보안 | DB 접속 정보는 `.env`의 `DATABASE_URL`로 관리하고 Git에 커밋하지 않음 (`.env.example`만 커밋) |
| NFR-3 | 보안 | DB 모듈은 `import 'server-only'`로 보호해 클라이언트 번들에 포함되지 않게 함 |
| NFR-4 | 보안 | 모든 SQL은 `$1, $2` 형식의 **파라미터화된 쿼리** 사용. 문자열 이어붙이기 금지 |
| NFR-5 | 이식성 | 표준 PostgreSQL SQL만 사용 (확장 설치 불필요). Supabase에서 같은 스크립트로 재생성 가능 |
| NFR-6 | 단순성 | 런타임 의존성은 `next`, `react`, `react-dom`, `pg` 정도로 최소화 |
| NFR-7 | 실행 환경 | Docker에는 PostgreSQL만 실행. Next.js는 macOS에서 `npm run dev`로 직접 실행 |

## 5. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js 16.4 (App Router, Turbopack) | 서버 컴포넌트 + Server Actions, Cache Components 기본 활성 |
| 언어 / UI | React + TypeScript | |
| 스타일 | Tailwind CSS (또는 순수 CSS) | `create-next-app` 기본 옵션 사용 |
| 데이터 변경 | Next.js Server Actions | 별도 REST API 없음 |
| DB | PostgreSQL 17 (Docker Compose) | `postgres:17` 공식 이미지 |
| DB 드라이버 | `pg` (node-postgres) + `@types/pg` | ORM 사용 안 함 |
| 개발 환경 | macOS (Apple Silicon), Node.js 24, OrbStack(Docker) | 0단계에서 확인 완료 |

### 5.1 사전 준비

- Node.js 20 이상 (개발 환경: Node.js 24)
- Docker + Docker Compose (Docker Desktop 또는 OrbStack)
- 이 프로젝트의 DB는 호스트 포트 5433(PostgreSQL)을 사용하고 Next.js는 3000 포트를 사용하므로, 두 포트가 비어 있어야 합니다.


## 6. 환경 변수

| 변수 | 예시 | 설명 |
|---|---|---|
| `DATABASE_URL` | `postgresql://studycafe:<비밀번호>@localhost:5433/my_study_cafe` | Next.js 서버에서 PostgreSQL에 접속할 때 사용하는 연결 문자열 |
| `POSTGRES_USER` | `studycafe` | Docker PostgreSQL 컨테이너 초기 사용자 |
| `POSTGRES_PASSWORD` | (직접 지정) | Docker PostgreSQL 컨테이너 초기 비밀번호 |
| `POSTGRES_DB` | `my_study_cafe` | Docker PostgreSQL 컨테이너 초기 데이터베이스 이름 |

- `.env` → 실제 값. Docker Compose와 Next.js가 **같은 파일을 함께 읽음**. **Git 제외** (`.gitignore`에 등록)
- `.env.example` → 값 없이 변수 이름만 적어 **Git에 커밋**
- 파일을 `.env` 하나로 합친 이유: Docker Compose는 `.env`만 자동으로 읽고, Next.js도 `.env`를 읽기 때문입니다.
- Supabase로 이전할 때는 `DATABASE_URL`만 Supabase 접속 문자열로 바꾸면 됩니다.


## 7. 단계별 구현 계획

| 단계 | 작업 | 산출물 | 완료 기준 |
|---|---|---|---|
| **1단계** | PRD · DB 설계 (현재) | `PRD.md`, `docs/DB_DESIGN.md` | 문서 검토 완료 |
| **2단계** | DB 환경 구성 | `docker-compose.yml`, `db/init.sql`, `.env.example`, `.gitignore` | 관련 테이블들 생성 확인 |
| **3단계** | Next.js 프로젝트 생성 | `create-next-app` 결과물, `pg` 설치 | `npm run dev` 후 기본 페이지 표시 |
| **4단계** | DB 연결 모듈 | `src/lib/db.ts`, `src/lib/types.ts` | 서버에서 `SELECT 1` 성공 |
| **5단계** | 구글 로그인 | 사용자·세션 테이블, 로그인/로그아웃 Server Action, OAuth 콜백 Route Handler, 세션 조회 서버 유틸 | 구글로 로그인 → 새로고침·`npm run dev` 재시작 후에도 로그인 유지, 로그아웃 동작 |
| **6단계** | 법령 대시보드 + 3단 원문 | 참조 데이터 seed SQL, 법령 API 동기화 스크립트, 대시보드 5개 탭, 3단 원문 화면, 진도 저장 Server Action | 법 제29조 → 영 제30조 → 고시 원문이 세 칸으로 표시, 회독 체크가 재시작 후 유지 |
| **7단계** | 문의 게시판 | 질문·답변 테이블, 목록/상세/작성/수정/삭제 화면, 조문 태그 | 3단 화면에서 질문 작성 → 다른 계정으로 답변 → 목록에 "답변 있음" 표시 |
| **8단계** | 검증 및 정리 | `README.md` | 새로고침 · 앱 재시작 · 컨테이너 재시작 후 데이터 유지 확인 |


## 8. Supabase로 이전하려면 (참고)

1. Supabase SQL Editor에서 그대로 실행 -> init.sql
2. `.env`의 `DATABASE_URL`을 Supabase 접속 문자열로 바꿉니다 (SSL 필요).
앱 코드는 바꿀 필요가 없습니다. 자세한 내용과 주의점(RLS, SSL)은 [docs/DB_DESIGN.md](docs/DB_DESIGN.md) 참고하세요.
