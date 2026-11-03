# ISMS-P 온라인 스터디 까페

ISMS-P(정보보호 및 개인정보보호 관리체계 인증 심사 전문가) 대비를 위해 개인정보보호법을 함께 공부하고, 문의 게시판으로 질문·답변을 나누는 온라인 스터디 사이트입니다. (Next.js + PostgreSQL)

## 사전 준비

- Node.js 24
- Docker (Docker Desktop 또는 OrbStack)
- 5433 포트(PostgreSQL)와 3000 포트(Next.js)가 비어 있어야 합니다.

## 실행 방법

1. 환경 변수 파일을 만들고 값을 채웁니다 (`POSTGRES_PASSWORD`, `DATABASE_URL` / `TEST_DATABASE_URL`(localhost:5433), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL=http://localhost:3000`, 추후 `LAW_API_OC`).

```bash
cp .env.example .env
```

2. PostgreSQL 컨테이너를 실행합니다.

```bash
docker compose up -d
```

3. 의존성을 설치합니다.

```bash
npm install
```

4. 개발 DB에 스키마를 적용합니다.

```bash
npm run db:apply
```

5. 테스트 DB에 스키마를 적용합니다.

```bash
npm run db:apply:test
```

6. 개발 서버를 실행합니다.

```bash
npm run dev
```

7. 테스트를 실행합니다.

```bash
npm test
```

## Google OAuth 설정

1. Google Cloud Console에서 OAuth 클라이언트 ID(웹 애플리케이션)를 만듭니다.
2. 승인된 리디렉션 URI에 `http://localhost:3000/auth/google/callback` 을 등록합니다.
3. 발급된 클라이언트 ID/시크릿을 `.env`의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 넣습니다.
4. 사이트는 `APP_URL`과 같은 호스트(`http://localhost:3000`)로 여세요. `localhost`와 `127.0.0.1`을 섞으면 로그인 쿠키가 맞지 않아 로그인이 깨집니다.

## 문서

- [PRD.md](PRD.md)
- [DB 설계](docs/DB_DESIGN.md)
- [MVP 설계 스펙](docs/superpowers/specs/2026-11-03-study-cafe-mvp-design.md)
- [플랜 1 구현 계획](docs/superpowers/plans/2026-11-03-plan1-foundation-google-login.md)
