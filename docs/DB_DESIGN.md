# DB 설계

- 상위 문서: [PRD.md](../PRD.md), [스펙](superpowers/specs/2026-11-03-study-cafe-mvp-design.md) 6장
- DB: PostgreSQL 17, 표준 SQL만 사용 (확장 없음). `db/init.sql` 하나로 재생성 가능해야 한다.

## 1. 공통 규칙

- 모든 `id`(숫자형)는 `bigint GENERATED ALWAYS AS IDENTITY`.
- 시각 컬럼은 `timestamptz NOT NULL DEFAULT now()` (별도 표기가 있는 경우 제외).
- 조 번호 키는 허브와 같이 `24의2` 형식, 화면에서 "제24조의2"로 표시.
- 모든 SQL은 `$1, $2` 파라미터화.
- DB 호스트 포트는 **5433**이다 (5432는 다른 로컬 프로젝트가 사용 중). `DATABASE_URL`/`TEST_DATABASE_URL`도 5433을 사용한다.
- `db/init.sql`은 멱등(`IF NOT EXISTS`)이라 새 테이블·인덱스는 다시 적용해도 안전하지만, 실제 데이터가 생긴 뒤 기존 컬럼을 바꾸는 변경은 별도의 명시적 ALTER 스크립트가 필요하다.

## 2. ERD

```mermaid
erDiagram
  users ||--o{ sessions : has
  users ||--o{ user_unit_reads : has
  users ||--o{ user_card_levels : has
  users ||--o| user_settings : has
  users ||--o{ questions : writes
  users ||--o{ answers : writes
  law_documents ||--o{ law_chapters : has
  law_documents ||--o{ articles : has
  law_chapters ||--o{ articles : groups
  articles ||--o{ article_links : from
  articles ||--o{ article_links : to
  articles ||--o{ questions : tagged
  questions ||--o{ answers : has
  areas ||--o{ units : has
  areas ||--o{ anchors : has
  areas ||--o{ mnemonics : has
  areas ||--o{ cards : has
  units ||--o{ unit_leaves : has
  units ||--o{ unit_items : has
  units ||--o{ user_unit_reads : read
  cards ||--o{ user_card_levels : level

  users {
    bigint id PK
    text provider
    text provider_user_id
    text email
    text display_name
    text avatar_url
    timestamptz created_at
    timestamptz updated_at
  }
  sessions {
    text token_hash PK
    bigint user_id FK
    timestamptz expires_at
    timestamptz created_at
  }
  law_documents {
    bigint id PK
    text kind
    text title
    text promulgation_no
    date promulgated_on
    date effective_on
    boolean is_upcoming
    text source
    timestamptz fetched_at
  }
  law_chapters {
    bigint id PK
    bigint document_id FK
    text label
    text title
    int sort_order
  }
  articles {
    bigint id PK
    bigint document_id FK
    bigint chapter_id FK
    text article_key
    text title
    text body
    int sort_order
  }
  article_links {
    bigint from_article_id PK
    bigint to_article_id PK
    text note
  }
  areas {
    text id PK
    text roman
    text name
    int weight
    int sort_order
  }
  units {
    text id PK
    text area_id FK
    text name
    text law_summary
    text decree_summary
    int sort_order
  }
  unit_leaves {
    bigint id PK
    text unit_id FK
    text label
    text ref
    int sort_order
  }
  unit_items {
    bigint id PK
    text unit_id FK
    text label
    text law_ref
    text decree_ref
    boolean is_key
    int sort_order
  }
  anchors {
    text article_key PK
    text label
    text area_id FK
    boolean is_new
  }
  mnemonics {
    bigint id PK
    text area_id FK
    text title
    text body
    int sort_order
  }
  cards {
    bigint id PK
    text area_id FK
    text deck
    text front
    text answer
    text extra
    int sort_order
  }
  history_events {
    bigint id PK
    text doc_kind
    text date_label
    text title
    text summary
    text_array article_keys
    boolean is_key
    int sort_order
  }
  user_unit_reads {
    bigint user_id PK
    text unit_id PK
    smallint reads
  }
  user_card_levels {
    bigint user_id PK
    bigint card_id PK
    smallint level
  }
  user_settings {
    bigint user_id PK
    date exam_date
  }
  questions {
    bigint id PK
    bigint author_id FK
    bigint article_id FK
    text title
    text body
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }
  answers {
    bigint id PK
    bigint question_id FK
    bigint author_id FK
    text body
    timestamptz created_at
    timestamptz updated_at
  }
```

## 3. 테이블 정의

### 3.1 사용자·세션 (5단계)

| 테이블 | 컬럼 (제약) | 용도 |
|---|---|---|
| `users` | id PK · provider text NOT NULL · provider_user_id text NOT NULL · email text · display_name text NOT NULL · avatar_url text · created_at · updated_at · UNIQUE(provider, provider_user_id) | 구글 로그인 사용자. 인증 방식이 바뀌어도 데이터가 유지되도록 `(provider, provider_user_id)`로 식별 |
| `sessions` | token_hash text PK (sha256 hex) · user_id → users ON DELETE CASCADE · expires_at timestamptz NOT NULL · created_at · INDEX(user_id) | 서버 세션. 브라우저에는 무작위 토큰만, DB에는 해시만 저장 |

### 3.2 법령 원문 (6단계)

| 테이블 | 컬럼 (제약) | 용도 |
|---|---|---|
| `law_documents` | id PK · kind text CHECK IN ('law','decree','notice') · title text NOT NULL · promulgation_no text NOT NULL (예 '법률 제21445호', '고시 제2026-9호') · promulgated_on date · effective_on date NOT NULL · is_upcoming boolean NOT NULL DEFAULT false · source text CHECK IN ('api','pdf','seed') · fetched_at timestamptz · UNIQUE(kind, promulgation_no) | 법령 문서 버전. 현행/시행 예정 법률, 시행령, 고시 |
| `law_chapters` | id PK · document_id → law_documents ON DELETE CASCADE · label text NOT NULL (예 '제4장의2') · title text NOT NULL · sort_order int NOT NULL · UNIQUE(document_id, label) | 문서별 장. 유니크 키는 seed/동기화가 `ON CONFLICT`로 upsert하기 위한 안정 키 |
| `articles` | id PK · document_id → law_documents ON DELETE CASCADE · chapter_id → law_chapters ON DELETE SET NULL · article_key text NOT NULL (예 '24의2') · title text NOT NULL · body text (원문, 6단계 동기화 스크립트가 채움) · sort_order int NOT NULL · UNIQUE(document_id, article_key) | 조문. 문서 버전에 묶어 저장 |
| `article_links` | from_article_id → articles CASCADE · to_article_id → articles CASCADE · note text (예 '①항 4호') · PK(from_article_id, to_article_id) | 법 → 시행령 → 고시 조문 연결 |

### 3.3 학습 구조 참조 (6단계)

| 테이블 | 컬럼 (제약) | 용도 |
|---|---|---|
| `areas` | id text PK ('a1'~'a5') · roman text · name text · weight int CHECK 0~100 · sort_order int | 대단원(배점) |
| `units` | id text PK ('a1-1' …) · area_id → areas · name text · law_summary text · decree_summary text · sort_order int | 중단원 |
| `unit_leaves` | id PK · unit_id → units CASCADE · label text · ref text · sort_order int | 마인드맵 잎 |
| `unit_items` | id PK · unit_id → units CASCADE · label text · law_ref text · decree_ref text · is_key boolean DEFAULT false · sort_order int | 세부 항목(법 ↔ 시행령 짝) |
| `anchors` | article_key text PK · label text · area_id → areas · is_new boolean DEFAULT false | 조문 앵커 |
| `mnemonics` | id PK · area_id → areas · title text · body text · sort_order int | 기억 묶음 |
| `cards` | id PK · area_id → areas (NULL 허용) · deck text CHECK IN ('law','decree','concept') · front text · answer text · extra text · sort_order int · UNIQUE(deck, sort_order) | 암기 카드. 유니크 키로 seed를 `ON CONFLICT` upsert하므로 재seed해도 카드 id가 유지되어 `user_card_levels`가 보존됨. 카드 id는 deck 안 순서(sort_order)가 바뀌지 않는 한 유지된다 — 허브에서 카드를 중간에 끼워 넣으면 이후 카드의 진도가 다른 카드로 옮겨 간다. area_id가 NULL 허용인 이유: 시행령 조문 카드는 대단원이 없음 |
| `history_events` | id PK · doc_kind text CHECK IN ('law','decree') · date_label text · title text · summary text · article_keys text[] NOT NULL DEFAULT '{}' · is_key boolean DEFAULT false · sort_order int | 개정 연혁 |

`unit_leaves`는 법령 허브 `AREAS[].subs[].leaves`(마인드맵), `unit_items`는 시행령 허브 `DOMAINS[].units[].items`이다. 두 허브의 중단원은 대단원별 개수·순서가 같으므로 순번으로 매칭한다.

### 3.4 사용자 진도 (6단계)

| 테이블 | 컬럼 (제약) | 용도 |
|---|---|---|
| `user_unit_reads` | user_id → users CASCADE · unit_id → units CASCADE · reads smallint CHECK 0~3 · PK(user_id, unit_id) | 중단원 회독 수 |
| `user_card_levels` | user_id → users CASCADE · card_id → cards CASCADE · level smallint CHECK 1~3 · PK(user_id, card_id) | 카드 단계 |
| `user_settings` | user_id PK → users CASCADE · exam_date date | 시험일(D-day) |

### 3.5 게시판 (7단계)

| 테이블 | 컬럼 (제약) | 용도 |
|---|---|---|
| `questions` | id PK · author_id → users · article_id → articles ON DELETE SET NULL · title text CHECK length 1~200 · body text CHECK length 1~5000 · created_at · updated_at · deleted_at timestamptz · INDEX(created_at DESC) · INDEX(article_id) | 질문. `deleted_at`으로 소프트 삭제, `article_id`가 조문 태그 |
| `answers` | id PK · question_id → questions ON DELETE CASCADE · author_id → users · body text CHECK length 1~5000 · created_at · updated_at · INDEX(question_id, created_at) | 답변 |

## 4. seed 출처

데이터는 두 경로로 적재한다. 카드 id는 deck 안 순서(sort_order)가 바뀌지 않는 한 유지된다 — 허브에서 카드를 중간에 끼워 넣으면 이후 카드의 진도가 다른 카드로 옮겨 간다. 법령 원문은 `npm run sync:laws`(API), 학습 구조는 `npm run seed`(JSON)이며 둘 다 `ON CONFLICT` upsert라 재실행해도 조문·카드 id가 유지된다.

| 테이블 | 출처 |
|---|---|
| `law_documents` | `npm run sync:laws`가 국가법령정보센터 OPEN API에서 채움 (`source='api'`). 법률 제21445호, 시행 예정 법률 제21910호, 시행령 제36671호, 고시 제2026-9호 |
| `law_chapters`, `articles` (제목·장·`body`) | `npm run sync:laws`가 API 응답으로 채움 (`source='api'`) |
| `article_links` (법 ↔ 시행령) | `npm run sync:laws`가 API 3단비교에서 채움 |
| `article_links` (시행령 ↔ 고시) | `db/seed/notice-links.json` (허브 매핑, 예: `영30① · 고시 제7조`)을 sync가 반영 |
| `areas`, `units`, `unit_leaves`, `anchors`, `mnemonics`, 법 카드·개념 카드(법령 허브의 concept cards)·`history_events` (law) | `db/seed/hub-law.json` (`CPPG 법령 허브.html`에서 `scripts/extract-hub-data.ts`로 추출) |
| `unit_items`, 시행령 카드·개념 카드(DOMAINS 상세 항목)·`history_events` (decree) | `db/seed/hub-decree.json` (`CPPG 시행령 허브.html`에서 동일 스크립트로 추출) |
| 테스트용 법령 | `test/fixtures/law-api/*` (`law.json`, `law-upcoming.json`, `decree.json`, `admrul.json`, `thdcmp.json`) — API 응답 fixture |
| `users`, `sessions`, `user_*`, `questions`, `answers` | seed 없음 (런타임 생성) |

`docs/sources/`의 PDF·엑셀은 교차 검증용으로만 보관하며 앱은 읽지 않는다.

## 5. Supabase / Neon 이전 시 주의

표준 PostgreSQL이므로 `db/init.sql`을 그대로 실행하고 `DATABASE_URL`만 바꾸면 된다. 확인할 점:

1. **SSL**: 접속 문자열에 `sslmode=require`가 필요하다.
2. **커넥션 풀러 주소**: Supabase는 Supavisor, Neon은 `-pooler` 호스트를 사용한다. 서버리스·다중 인스턴스 환경에서는 풀러 주소를 쓴다.
3. **RLS 활성화**: Supabase에서는 모든 테이블에 Row Level Security를 활성화한다. 접속이 서버 전용(서버 코드에서만 DB 접근)이므로 정책은 비워도 된다.
