# DB 설계

- 상위 문서: [PRD.md](../PRD.md), [스펙](superpowers/specs/2026-11-03-study-cafe-mvp-design.md) 6장
- DB: PostgreSQL 17, 표준 SQL만 사용 (확장 없음). `db/init.sql` 하나로 재생성 가능해야 한다.

## 1. 공통 규칙

- 모든 `id`(숫자형)는 `bigint GENERATED ALWAYS AS IDENTITY`.
- 시각 컬럼은 `timestamptz NOT NULL DEFAULT now()` (별도 표기가 있는 경우 제외).
- 조 번호 키는 허브와 같이 `24의2` 형식, 화면에서 "제24조의2"로 표시.
- 모든 SQL은 `$1, $2` 파라미터화.

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
| `law_chapters` | id PK · document_id → law_documents ON DELETE CASCADE · label text NOT NULL (예 '제4장의2') · title text NOT NULL · sort_order int NOT NULL | 문서별 장 |
| `articles` | id PK · document_id → law_documents ON DELETE CASCADE · chapter_id → law_chapters ON DELETE SET NULL · article_key text NOT NULL (예 '24의2') · title text NOT NULL · body text (원문, 플랜 2가 채움) · sort_order int NOT NULL · UNIQUE(document_id, article_key) | 조문. 문서 버전에 묶어 저장 |
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
| `cards` | id PK · area_id → areas · deck text CHECK IN ('law','decree','concept') · front text · answer text · extra text · sort_order int | 암기 카드 |
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

| 테이블 | 출처 |
|---|---|
| `areas`, `units`, `unit_leaves` | `CPPG 법령 허브.html`의 `AREAS` (대단원, `subs`, `leaves`) |
| `law_chapters`, `articles`(제목·장 소속) | `CPPG 법령 허브.html`의 `CHAPTERS`, `CPPG 시행령 허브.html`의 `DECREE` |
| `anchors` | `CPPG 법령 허브.html`의 `ANCHORS` |
| `mnemonics` | `CPPG 법령 허브.html`의 `MNEMO` |
| `cards` | `CPPG 법령 허브.html`의 `CARDS`, 시행령 허브의 `ITEMS`/`DEC_CARDS` (`DOMAINS`·`DECREE`에서 생성) |
| `history_events` | `CPPG 법령 허브.html`의 `HISTORY`, `CPPG 시행령 허브.html`의 `TIMELINE` |
| `unit_items` | `CPPG 시행령 허브.html`의 `DOMAINS[].units[].items` |
| `law_documents` | `docs/sources/법령체계도_개인정보_보호법.xlsx` (법·시행령·고시 이름·번호·시행일) |
| `articles.body` | 국가법령정보센터 OPEN API 동기화(법률·시행령·고시). 고시는 실패 시 `docs/sources/개인정보의 안전성 확보조치 기준(…)(제2026-9호)(20260701).pdf` |
| `article_links` | 법 ↔ 영은 API 또는 `docs/sources/개인정보 보호법(3단비교).pdf`, 영 ↔ 고시는 허브 매핑(예: `영30① · 고시 제7조`) |
| `users`, `sessions`, `user_*`, `questions`, `answers` | seed 없음 (런타임 생성) |

## 5. Supabase / Neon 이전 시 주의

표준 PostgreSQL이므로 `db/init.sql`을 그대로 실행하고 `DATABASE_URL`만 바꾸면 된다. 확인할 점:

1. **SSL**: 접속 문자열에 `sslmode=require`가 필요하다.
2. **커넥션 풀러 주소**: Supabase는 Supavisor, Neon은 `-pooler` 호스트를 사용한다. 서버리스·다중 인스턴스 환경에서는 풀러 주소를 쓴다.
3. **RLS 활성화**: Supabase에서는 모든 테이블에 Row Level Security를 활성화한다. 접속이 서버 전용(서버 코드에서만 DB 접근)이므로 정책은 비워도 된다.
