# ISMS-P 온라인 스터디 까페

ISMS-P(정보보호 및 개인정보보호 관리체계 인증 심사 전문가) 대비를 위해 개인정보보호법을 함께 공부하고, 문의 게시판으로 질문·답변을 나누는 온라인 스터디 사이트입니다. (Next.js + PostgreSQL)

## 사전 준비

- Node.js 24
- Docker (Docker Desktop 또는 OrbStack)
- 5433 포트(PostgreSQL)와 3000 포트(Next.js)가 비어 있어야 합니다.

## 실행 방법

1. 환경 변수 파일을 만들고 값을 채웁니다 (`POSTGRES_PASSWORD`, `DATABASE_URL` / `TEST_DATABASE_URL`(localhost:5433), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL=http://localhost:3000`, `LAW_API_OC`).

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

6. 국가법령정보센터 OPEN API에서 법령 원문을 가져옵니다. `.env`의 `LAW_API_OC`(OPEN API 인증키 ID)가 필요합니다.

```bash
npm run sync:laws
```

7. 학습 데이터(허브 HTML에서 추출한 단원·카드·연혁 등)를 적재합니다.

```bash
npm run seed
```

8. 개발 서버를 실행합니다.

```bash
npm run dev
```

9. 테스트를 실행합니다.

```bash
npm test
```

### 법령 동기화와 seed

- `npm run sync:laws`는 국가법령정보센터 OPEN API에서 4개 문서를 가져옵니다: 개인정보 보호법(법률 제21445호), 시행 예정 법률(법률 제21910호, 2027. 3. 9. 시행), 시행령(대통령령 제36671호), 「개인정보의 안전성 확보조치 기준」(고시 제2026-9호). 법 ↔ 시행령 연결은 3단비교에서, 시행령 ↔ 고시 연결은 `db/seed/notice-links.json`에서 가져옵니다.
- `npm run seed`는 `db/seed/hub-law.json`, `db/seed/hub-decree.json`(두 허브 HTML을 `scripts/extract-hub-data.ts`로 추출한 결과)을 적재합니다.
- 두 명령 모두 멱등이며 조문·카드 id를 유지하므로 다시 실행해도 사용자 진도가 보존됩니다.
- 새 DB에서는 `npm run db:apply` → `npm run sync:laws` → `npm run seed` 순서를 권장합니다. seed는 sync에 의존하지 않아 순서를 바꿔도 됩니다.
- `LAW_API_OC` 호출은 open.law.go.kr에 등록한 IP/도메인에서만 허용됩니다. 등록되지 않은 곳이면 `law api rejected the call: register this machine IP at open.law.go.kr` 오류로 실패합니다. 집 IP는 바뀔 수 있으니 실패하면 다시 등록하세요.
- `docs/sources/`의 PDF는 교차 검증용으로 보관하며, 앱은 고시 본문을 API에서 읽습니다.
- `npm test`는 일부 테스트가 공유 테스트 DB에 fixture 법령 문서를 적재하므로 파일을 직렬(`--test-concurrency=1`)로 실행합니다.

## 화면

- `/` 개요·진도
- `/mindmap` 마인드맵
- `/cards` 암기 카드
- `/laws` 조문 매핑표
- `/history` 개정 연혁
- `/articles/<law|decree|notice>/<조 키>` 조문 3단 보기 (예: `/articles/law/29`, `/articles/law/24의2`)
- `/questions` 문의 게시판 목록 (`?page=`, 조문 태그 필터 `?kind=law&key=29`)
- `/questions/new` 질문 작성 (`?kind=law&key=29`로 조문 태그를 미리 붙임)
- `/questions/<id>` 질문 상세·답변
- `/questions/<id>/edit` 질문 수정
- `/questions/answers/<answerId>/edit` 답변 수정

### 문의 게시판 규칙

읽기는 로그인 없이 가능하고, 질문·답변 작성은 구글 로그인이 필요합니다. 자기 글(질문·답변)만 수정·삭제할 수 있습니다. 답변이 달린 질문을 삭제하면 답변은 그대로 두고 질문은 "삭제된 질문입니다"로 표시되며, 그 질문의 답변이 모두 지워지면 목록에서 사라집니다. 본문은 일반 텍스트(줄바꿈만 유지)이고, 목록은 페이지당 20개 최신순입니다. 3단 보기 화면의 "이 조문에 대해 질문하기"로 조문 태그(예: `법 제29조`)가 붙은 질문을 쓸 수 있고, 질문이 있으면 "이 조문 질문 N개 보기" 링크가 나타납니다.

### 확인 방법

다른 사람의 답변 흐름은 다른 구글 계정으로 로그인해 직접 확인해야 합니다(수동). 자동 테스트(`npm test`)는 두 번째 테스트 사용자로 같은 흐름을 검증합니다.

## 데이터 유지 확인

데이터는 Docker named volume(`study-class_pgdata`)에 저장되므로 새로고침, `npm run dev` 재시작, 컨테이너를 지웠다 다시 만들어도 남습니다. 확인 순서:

1. 로그인해서 회독 체크·암기 카드 단계·시험일을 바꾸고 질문을 하나 올립니다.
2. 브라우저를 새로고침합니다.
3. `npm run dev`를 끄고 다시 실행합니다.
4. 컨테이너를 지우고 다시 만듭니다. `-v`를 붙이면 볼륨까지 지워지므로 붙이지 않습니다.

```bash
docker compose down
```

```bash
docker compose up -d --wait
```

5. 다시 접속해 로그인 상태, 진도, 시험일, 질문이 그대로인지 확인합니다.

2026-11-03에 이 순서로 확인했습니다(사용자·세션·조문 420개·카드 242개·진도·질문 수가 재생성 전후 같음).

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
- [플랜 2 구현 계획](docs/superpowers/plans/2026-11-03-plan2-dashboard-three-tier.md)
- [플랜 3 구현 계획](docs/superpowers/plans/2026-11-03-plan3-question-board.md)
