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

## 배포 (Vercel + Neon)

운영은 Vercel(앱) + Neon(PostgreSQL)으로 배포합니다. 로컬 개발(Docker DB + `npm run dev`)과 `npm test`(로컬 TEST DB)는 그대로입니다. 자세한 설계는 [배포 설계](docs/superpowers/specs/2026-11-05-vercel-neon-deploy-design.md)를 보세요. 아래 순서대로 진행합니다.

- [ ] **1. Neon 프로젝트 만들기**: 아시아 리전으로 프로젝트를 만들고 연결 문자열 두 가지를 복사합니다. pooled(호스트에 `-pooler`가 있음)는 Vercel용, direct(`-pooler` 없음)는 집 PC의 스키마·데이터 적재용입니다. 콘솔이 주는 문자열(`sslmode=require` 등)은 **그대로** 붙여 넣으면 됩니다. 코드가 SSL 인증서 검증(`verify-full`)으로 정규화합니다.
- [ ] **2. `.env.neon` 만들기** (집 PC): 견본을 복사해 direct 연결 문자열을 `DATABASE_URL`에, 인증키를 `LAW_API_OC`에 넣습니다. `.env.neon`은 Git에 올라가지 않습니다.

```bash
cp .env.neon.example .env.neon
```

- [ ] **3. 스키마 적용**: 실행하면 맨 처음 `대상 DB: <호스트> (neon)`이 출력됩니다. **이 호스트가 방금 만든 Neon 프로젝트인지 확인한 뒤** 진행하세요. Node의 `--env-file`은 셸에 이미 `export`된 변수를 덮어쓰지 않으므로, 셸에서 `export DATABASE_URL=...`을 하지 마세요(했다면 다른 DB로 접속할 수 있으니 출력된 호스트로 반드시 확인). `.neon.tech`가 아닌 호스트는 명령이 거부합니다.

```bash
npm run db:apply:neon
```

- [ ] **4. 법령 동기화**: `LAW_API_OC`는 open.law.go.kr에 등록한 IP에서만 동작하므로 **집 PC**에서 실행합니다.

```bash
npm run sync:laws:neon
```

- [ ] **5. 학습 데이터 적재**

```bash
npm run seed:neon
```

- [ ] **6. Vercel 프로젝트 이름 확정**: 운영 주소 `https://<이름>.vercel.app`이 이름으로 정해지므로(기본 `study-class`) 먼저 정해 두면 구글 설정과 `APP_URL`을 한 번에 맞출 수 있습니다.
- [ ] **7. 구글 콘솔**: OAuth 클라이언트 secret을 재발급하고, 승인된 리디렉션 URI에 `https://<이름>.vercel.app/auth/google/callback`을 추가합니다. 리디렉션 URI는 정확히 일치해야 합니다.
- [ ] **8. Vercel 가져오기와 환경 변수**: GitHub 저장소를 가져온 뒤 **Production에만** 아래 변수를 입력합니다. Function Region은 Neon과 같은 아시아 리전으로 맞춥니다(Settings > Functions).
  - `DATABASE_URL`: Neon **pooled** 연결 문자열
  - `APP_URL`: `https://<이름>.vercel.app` (끝에 `/` 없이, https)
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: 구글 콘솔 값(재발급한 secret)
- [ ] **9. 배포**: 배포를 실행하고 `https://<이름>.vercel.app`이 열리는지 확인합니다.
- [ ] **10. `/privacy` 확정**: `src/app/privacy/page.tsx`의 `[Vercel 함수 리전]`, `[Neon 리전]`, `[Vercel 연락처]`, `[Neon 연락처]`, `[이름]`, `[연락처]`, `[시행일]`을 실제 값으로 바꾸고 문구를 검토한 뒤 상단 "초안" 안내 문구를 지우고 다시 배포합니다.
- [ ] **11. 동의 화면 게시**: 구글 콘솔 OAuth 동의 화면에 홈페이지(`https://<이름>.vercel.app`)와 개인정보처리방침(`https://<이름>.vercel.app/privacy`) 링크를 넣고 **프로덕션으로 게시**합니다. `/privacy`가 확정된 뒤에 하세요. 그래야 테스트 사용자 등록 없이 누구나 구글로 가입합니다.
- [ ] **12. 완료 기준 확인**: 다른 구글 계정으로 배포 주소에서 가입 → 회독 체크·카드 단계·시험일 저장 → 질문 작성 → 또 다른 계정이 답변 → 다시 접속해도 모두 남아 있는지 확인합니다. 확인되면 지인에게 주소를 공유합니다.

### 배포 참고

- **주의**: `npm run dev`/`next start`에는 대상 DB 가드가 없습니다. Neon 주소를 `.env`에 절대 넣지 마세요. Neon 주소는 `.env.neon`(집 PC 스크립트)과 Vercel 환경 변수에만 둡니다.
- **연결 수**: 앱의 DB 연결 풀은 최대 5개, 유휴 10초입니다. 서버리스 인스턴스가 여럿 떠도 Neon pooler(`-pooler` 주소)가 받아 줍니다.
- **미리보기 배포**: Production에만 환경 변수를 넣으므로 미리보기 배포에는 DB가 없습니다. DB를 쓰는 화면은 오류가 날 수 있으며 정상입니다. `/privacy`는 DB 없이 열립니다.
- **삭제 요청 처리**: [삭제 절차](docs/ops/README.md)를 따릅니다. 처음 쓰기 전에 Neon 테스트 브랜치에서 삭제 SQL을 Neon SQL Editor로 한 번 시험 실행하세요(편집기에서 여러 문을 트랜잭션으로 실행하는 동작은 로컬에서 확인하지 못했습니다).

### 배포 문제 해결

- **구글 로그인이 실패함**: `APP_URL`이 `https://<이름>.vercel.app` 형태인지(끝 `/` 없음, https), 구글 콘솔의 리디렉션 URI가 `APP_URL` + `/auth/google/callback`과 정확히 일치하는지, 동의 화면이 프로덕션으로 게시되었는지 확인합니다.
- **"운영 명령의 대상이 Neon이 아닙니다" 오류**: `.env.neon`의 `DATABASE_URL`이 Neon(`.neon.tech`) 주소인지 확인합니다. 반대로 "로컬 명령이 Neon DB에 접속하려 합니다" 오류가 나면 `.env`의 `DATABASE_URL`이 Neon을 가리키는 것입니다.
- **`sync:laws:neon`이 `register this machine IP` 오류로 실패함**: open.law.go.kr에 현재 집 IP를 다시 등록하세요.

## 문서

- [PRD.md](PRD.md)
- [DB 설계](docs/DB_DESIGN.md)
- [MVP 설계 스펙](docs/superpowers/specs/2026-11-03-study-cafe-mvp-design.md)
- [플랜 1 구현 계획](docs/superpowers/plans/2026-11-03-plan1-foundation-google-login.md)
- [플랜 2 구현 계획](docs/superpowers/plans/2026-11-03-plan2-dashboard-three-tier.md)
- [플랜 3 구현 계획](docs/superpowers/plans/2026-11-03-plan3-question-board.md)
- [배포 설계 (Vercel + Neon)](docs/superpowers/specs/2026-11-05-vercel-neon-deploy-design.md)
- [플랜 4 구현 계획](docs/superpowers/plans/2026-11-05-plan4-vercel-neon-deploy.md)
- [삭제 요청 처리 절차](docs/ops/README.md)
