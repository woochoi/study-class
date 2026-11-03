# 플랜 2 — 법령 대시보드 + 3단 원문 (6단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 허브 HTML의 학습 데이터와 국가법령정보센터 원문을 DB에 넣고, 5개 탭 대시보드와 법 → 시행령 → 고시 3단 원문 화면을 사용자별 진도 저장과 함께 동작시킨다.

**Architecture:** 데이터 적재는 두 개의 CLI 스크립트(`npm run seed`, `npm run sync:laws`)가 담당하고, 원문·매핑 파싱은 서버/Next에 의존하지 않는 순수 모듈(`src/lib/law/*`, `src/lib/study/*`)로 분리해 `node --test`로 검증한다. 화면은 서버 컴포넌트가 DB를 읽고, 상호작용(탭 내부 토글·마인드맵·카드)은 클라이언트 컴포넌트가 받은 데이터로 처리하며, 진도 변경은 Server Actions로 저장한다.

**Tech Stack:** 플랜 1과 동일 (Next.js 16.4.4 App Router + Cache Components + Partial Prefetching, React 19, TypeScript, Tailwind, `pg`, `node --test`). 새 의존성 없음.

**Spec:** [docs/superpowers/specs/2026-11-03-study-cafe-mvp-design.md](../specs/2026-11-03-study-cafe-mvp-design.md) — 특히 5.2, 5.3(「API 조사 결과」 표 = 확인된 엔드포인트), 6, 7장 · DB: [docs/DB_DESIGN.md](../../DB_DESIGN.md) · 이전 플랜: [plan1](2026-11-03-plan1-foundation-google-login.md)

## Global Constraints

- 플랜 1 Global Constraints 전부 유지: 런타임 의존성 `next`·`react`·`react-dom`·`pg`·`server-only`만, 모든 SQL `$1…` 파라미터화, DB를 만지는 `src/lib/**` 모듈 첫 줄 `import 'server-only'`, Route Handler는 OAuth 콜백 하나뿐(`src/app/api/` 금지), `src/lib/**` 상대 import는 `.ts` 확장자, `@/`는 `src/app/**`에서만, TS `enum`·parameter properties 금지, 화면 문구 한국어, 테스트 출력 깨끗하게.
- Next 16은 학습 데이터와 다르다: 페이지·라우팅·Server Action·Cache Components 코드를 쓰기 전 `node_modules/next/dist/docs/`의 해당 가이드를 읽는다(AGENTS.md).
- Cache Components + Partial Prefetching: 요청마다 다른 값(cookies, DB, `new Date()`)을 읽는 서버 컴포넌트는 `<Suspense>` 안에 두고, `cookies()` 뒤라도 시계·DB를 쓰기 전에 `await connection()`(`next/server`)을 호출한다 — 플랜 1에서 실제로 터진 버그(`4f01832`).
- **순수 모듈 규칙:** `src/lib/law/*.ts`, `src/lib/study/progress.ts`, `src/lib/study/hub-data.ts`, `src/lib/law/linkify.ts`는 `server-only`·`next/*`·`db.ts`를 import하지 않는다(스크립트와 테스트가 직접 import). DB를 쓰는 것은 `*-db.ts`/`queries.ts`/`three-tier.ts`로 분리.
- **스크립트 규칙:** `scripts/*.ts`는 `server-only`를 import하지 않고 `pg.Client`를 직접 쓴다(플랜 1 `scripts/db-apply.ts`와 같은 방식). 각 적재는 한 트랜잭션 — 중간 실패 시 이전 데이터가 그대로 남아야 한다.
- 법령 API: 베이스 `https://www.law.go.kr/DRF`, 모든 호출에 `OC=process.env.LAW_API_OC`, `type=JSON`. 문서 4종(스펙 5.3 표):
  - 현행 법률 `lawService.do?target=law&MST=283839` (법률 제21445호, 시행 2026-09-11)
  - 시행예정 법률 `lawService.do?target=eflaw&MST=289415&efYd=20270309` (법률 제21910호, 시행 2027-03-09, `is_upcoming=true`)
  - 현행 시행령 `lawService.do?target=law&MST=289537` (대통령령 제36671호)
  - 고시 `lawService.do?target=admrul&ID=2100000281400` (「개인정보의 안전성 확보조치 기준」 고시 제2026-9호, 시행 2026-07-01)
  - 법↔영 연결 `lawService.do?target=thdCmp&MST=283839&knd=2` → `LspttnThdCmpLawXService.위임조문삼단비교.법률조문[]`의 `시행령조문`(객체 또는 없음)
  - MST/ID 값은 `scripts/law-sources.ts` 한 곳에 상수로 둔다. 테스트는 네트워크를 쓰지 않는다(`fetchJson` 주입 + 고정 픽스처).
- `promulgation_no` 표기: `법률 제21445호`, `법률 제21910호`, `대통령령 제<공포번호>호`, `고시 제2026-9호`. `source`는 API에서 온 문서 `'api'`.
- 조 키(`article_key`) 표기: `'2'`, `'24의2'` (API `조문번호` + 가지번호가 있으면 `'의' + 가지번호`, 3단비교의 `'0030'`/`'00'` 같은 0 패딩은 제거). 화면 표기는 `제24조의2`. URL은 `/articles/law/24의2` (인코딩된 형태도 받아야 함).
- 원문 `body`는 줄 구조 텍스트: 조문 첫 줄 다음에 항은 줄바꿈, 호는 앞 공백 2칸, 목은 4칸. 화면은 `white-space: pre-wrap`.
- 시행령 ↔ 고시 연결(API에 없음): `db/seed/notice-links.json`(이 플랜에서 작성) — 영 `30` → 고시 제2장 조문 전부(3~13조, 6의2 포함), 영 `30의2` → 고시 제3장 조문 전부(14~18조), 영 `21의2` → 고시 `7`.
- 비로그인: 대시보드·3단 원문 읽기 가능, 진도 저장 버튼을 누르면 "로그인하면 진도가 저장돼요" 안내(저장 안 함).
- 법제처 출처 표기: 3단 원문 화면 하단에 "출처: 법제처 국가법령정보센터 · 받아 온 날짜 YYYY-MM-DD".

## Review Focus

1. **한글·인코딩 URL:** `/articles/law/24%EC%9D%982`와 `/articles/law/24의2`가 같은 화면, 없는 키(`/articles/law/999`)·잘못된 종류(`/articles/foo/1`)는 404 페이지(500 아님). (Task 9 테스트)
2. **동기화 재실행:** `sync:laws`를 두 번 돌려도 문서·조문·연결 수가 같고, 사용자 진도·질문의 `article_id`가 끊기지 않는다(조문 행 id 유지). (Task 3 테스트)
3. **seed 재실행:** `seed`를 다시 돌려도 `cards` id가 유지되어 `user_card_levels`가 살아 있다. (Task 4 테스트)
4. **비로그인 진도 클릭:** DB에 아무것도 쓰지 않고 `{ ok:false, reason:'auth' }`를 돌려준다. (Task 5 테스트)
5. **연결 없는 조문:** 법 제1조처럼 시행령·고시가 없는 조문은 해당 칸에 "시행령 조문 없음"/"고시 조문 없음", 고시 조문으로 들어오면 위로 거슬러 법·영이 채워진다. (Task 9 테스트)

---

### Task 1: 조 키 · 원문 파서 (순수 모듈 + 픽스처)

**Files:**
- Create: `src/lib/law/types.ts`, `src/lib/law/article-key.ts`, `src/lib/law/parse-law.ts`, `src/lib/law/parse-admrul.ts`, `src/lib/law/parse-thdcmp.ts`, `scripts/make-law-fixtures.ts`, `test/fixtures/law-api/{law,law-upcoming,decree,admrul,thdcmp}.json`
- Test: `src/lib/law/article-key.test.ts`, `src/lib/law/parse-law.test.ts`, `src/lib/law/parse-admrul.test.ts`, `src/lib/law/parse-thdcmp.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `type DocKind = 'law' | 'decree' | 'notice'`
  - `type ParsedChapter = { label: string; title: string; sortOrder: number }` (label 예 `'제4장의2'`, title 예 `'가명정보의 처리에 관한 특례'`)
  - `type ParsedArticle = { key: string; title: string; body: string; chapterLabel: string | null; sortOrder: number }`
  - `type ParsedDocument = { kind: DocKind; title: string; promulgationNo: string; promulgatedOn: string | null; effectiveOn: string; isUpcoming: boolean; chapters: ParsedChapter[]; articles: ParsedArticle[] }` (날짜는 `'YYYY-MM-DD'`)
  - `type ParsedLink = { fromKind: DocKind; fromKey: string; toKind: DocKind; toKey: string; note: string | null }`
- Produces (`article-key.ts`): `articleKeyFromParts(no: string, branch?: string | null): string` · `formatArticleKey(key: string): string` (`'24의2'`→`'제24조의2'`) · `parseArticleKey(text: string): string | null` (`'제24조의2(주민…)'`→`'24의2'`, 조문 아님→null) · `compareArticleKeys(a: string, b: string): number`
- Produces: `parseLawDocument(json: unknown, opts: { kind: 'law' | 'decree'; isUpcoming: boolean }): ParsedDocument` · `parseAdmrulDocument(json: unknown): ParsedDocument` · `parseThdCmpLinks(json: unknown): ParsedLink[]` (법→영, 중복 제거)

- [ ] **Step 1: 픽스처 만들기** — `scripts/make-law-fixtures.ts`: `.env`의 `LAW_API_OC`로 Global Constraints의 5개 호출을 하고, 응답을 잘라 `test/fixtures/law-api/`에 저장한다. 남길 조문: 법률 `1·2·3·24·24의2·28의2·29` + 그 사이의 장/절 `전문` 항목, 시행예정 법률 `28의12~28의15` + 해당 절 `전문`, 시행령 `1·2·21의2·30·30의2` + 장 `전문`, 고시 `조문내용` 전부(23개, 작음), 3단비교는 법률 조 `1·2·29·24의2` 항목. `기본정보`는 그대로 둔다. 실행: `node --env-file=.env scripts/make-law-fixtures.ts`. 픽스처는 커밋한다(공개 법령).

- [ ] **Step 2: 실패 테스트**

```ts
// article-key.test.ts
assert.equal(articleKeyFromParts('24', '2'), '24의2'); assert.equal(articleKeyFromParts('0030', '00'), '30'); assert.equal(articleKeyFromParts('3', null), '3')
assert.equal(formatArticleKey('24의2'), '제24조의2'); assert.equal(parseArticleKey('제6조의2(인터넷망의 차단 조치 등) …'), '6의2'); assert.equal(parseArticleKey('제1장 총칙'), null)
assert.deepEqual(['28의10','3','28의2','28'].sort(compareArticleKeys), ['3','28','28의2','28의10'])
// parse-law.test.ts (law.json)
doc.promulgationNo === '법률 제21445호', doc.effectiveOn === '2026-09-11', doc.promulgatedOn === '2026-03-10', isUpcoming false
articles 키에 '24의2','28의2' 포함, '전문' 항목은 조문이 아님(장 heading만 chapters로), 장 label/title 예: { label:'제1장', title:'총칙' }
article '29'.chapterLabel === '제4장'; '3'.body 줄 수 === 1 + 항 8개; body 첫 줄은 '제3조(개인정보 보호 원칙)'로 시작
decree.json: '30'.body 에 '\n  1. ' 과 '\n    가. ' 이 있다(호·목 들여쓰기); promulgationNo === '대통령령 제36671호'
law-upcoming.json + isUpcoming:true: promulgationNo '법률 제21910호', '28의12'.title === '인공지능기술 개발을 위한 개인정보의 이용', 제목 없는 같은 번호의 '전문' 항목은 조문으로 넣지 않음
// parse-admrul.test.ts
promulgationNo '고시 제2026-9호', effectiveOn '2026-07-01', kind 'notice'; 조문 키 '1'~'19' + '6의2' (총 20개), chapters 3개
'2'.body 가 '같다.\n  1. "개인정보처리시스템"' 형태로 호가 줄바꿈; '7'.body 에 '\n②' 가 있다; 날짜 '2026.7.1' 같은 표기는 쪼개지지 않는다
// parse-thdcmp.test.ts
links 에 { fromKind:'law', fromKey:'29', toKind:'decree', toKey:'30', note:null } 포함; '1' 에서 나가는 링크 없음; 같은 쌍은 한 번만
```

- [ ] **Step 3: 실패 확인** — `npm test` → FAIL (모듈 없음)
- [ ] **Step 4: 구현** — 법률/시행령: `법령.조문.조문단위[]` 중 `조문여부==='조문'`만 조문, `전문` 중 `/^\s*제\d+장(의\d+)?\s/`로 시작하는 것만 장(절은 무시하되 직전 장을 유지). 키는 `articleKeyFromParts(조문번호, 조문가지번호)`. body = `조문내용.trim()` + 각 `항[].항내용` + `호[].호내용`(앞 2칸) + `목[].목내용`(앞 4칸), 줄바꿈 연결. 고시: `AdmRulService.조문내용[]` 문자열 — `/^제\d+장/`이면 장, `parseArticleKey`가 키를 주면 조문; body는 원문에 `([①-⑳])` 앞 줄바꿈, `/(?<=다[.:])\s*(\d{1,2})\.\s*/` 앞 줄바꿈+2칸, `/(?<=다[.:])\s*([가-하])\.\s/` 앞 줄바꿈+4칸. 문서 메타는 `기본정보`/`행정규칙기본정보`(공포번호·공포일자·시행일자, 발령번호·발령일자·시행일자). 형식이 어긋나면 `Error('unexpected law api shape: <where>')`.
- [ ] **Step 5: 통과 확인** — `npm test` → PASS
- [ ] **Step 6: 커밋** — `git commit -m "feat: add law api parsers and fixtures"`

---

### Task 2: 시행령↔고시 연결 seed · 링크 해석

**Files:**
- Create: `db/seed/notice-links.json`, `src/lib/law/notice-links.ts`
- Test: `src/lib/law/notice-links.test.ts`

**Interfaces:**
- Consumes: `ParsedDocument`, `ParsedLink` (Task 1)
- Produces: `type NoticeLinkRule = { decreeKey: string; noticeChapter?: string; noticeKeys?: string[] }` · `expandNoticeLinks(rules: NoticeLinkRule[], notice: ParsedDocument): ParsedLink[]` (영→고시, `fromKind:'decree'`, `toKind:'notice'`)
- `db/seed/notice-links.json` 내용(정확히): `[{"decreeKey":"30","noticeChapter":"제2장"},{"decreeKey":"30의2","noticeChapter":"제3장"},{"decreeKey":"21의2","noticeKeys":["7"]}]`

- [ ] **Step 1: 실패 테스트** — admrul 픽스처로: 영 `30` → 고시 `3,4,5,6,6의2,7,8,9,10,11,12,13`(12개, 이 순서); 영 `30의2` → `14~18`; 영 `21의2` → `7`; 규칙의 장/키가 고시에 없으면 `Error('notice link target missing: …')`.
- [ ] **Step 2: 실패 확인 → Step 3: 구현 → Step 4: 통과** (`npm test`)
- [ ] **Step 5: 커밋** — `git commit -m "feat: add decree-to-notice link rules"`

---

### Task 3: 법령 동기화 스크립트 (`npm run sync:laws`)

**Files:**
- Create: `scripts/law-sources.ts`, `scripts/sync-laws.ts`, `src/lib/law/sync.ts` (순수 아님: `pg` 클라이언트 인자를 받는 적재 함수 — `server-only` 금지)
- Modify: `package.json` (`"sync:laws": "node --env-file=.env scripts/sync-laws.ts"`)
- Test: `src/lib/law/sync.test.ts`

**Interfaces:**
- Consumes: Task 1 파서, Task 2 `expandNoticeLinks`
- Produces:
  - `type FetchJson = (url: string) => Promise<unknown>`
  - `fetchAllLawSources(fetchJson: FetchJson, oc: string): Promise<{ docs: ParsedDocument[]; links: ParsedLink[] }>` (법률·시행예정·시행령·고시 파싱 + thdCmp 링크 + notice-links 확장)
  - `saveLawData(client: pg.ClientBase, data: { docs; links }, now: Date): Promise<{ documents: number; articles: number; links: number }>` — 한 트랜잭션. `law_documents` upsert `ON CONFLICT (kind, promulgation_no)`(title·dates·is_upcoming·source='api'·fetched_at=now 갱신), `law_chapters` upsert `(document_id, label)`, `articles` upsert `(document_id, article_key)`(title·body·chapter_id·sort_order 갱신, **id 유지**), 이번 데이터에 없는 조문은 삭제하지 않고 그대로 둔다. `article_links`는 이번에 적재한 문서들에서 나가는 링크를 지우고 다시 넣는다. 링크 대상은 `is_upcoming=false` 문서의 조문(법률 쪽 출발이 현행에 없고 시행예정에만 있으면 시행예정 조문).
  - 스크립트: `LAW_API_OC` 없으면 종료코드 1 + 안내, 성공 시 `documents/articles/links` 수 출력. `law-sources.ts`에 문서별 기대 `promulgationNo`를 두고, 받아 온 값이 다르면 저장은 하되 `경고: <문서> 공포번호가 기대값과 다릅니다 (<기대> → <실제>) — 허브 매핑을 확인하세요`를 stderr로 출력(스펙 5.3 「법령 버전」). API가 "사용자 정보 검증에 실패" JSON을 주면 `Error('law api rejected the call: register this machine IP at open.law.go.kr')`.
  - PDF(`docs/sources/`)는 이번 플랜에서 쓰지 않는다 — 고시 본문을 API에서 받을 수 있음이 확인됨(스펙 5.3 표). PDF는 대조·백업용으로 남긴다.

- [ ] **Step 1: 실패 테스트** (테스트 DB, 픽스처를 돌려주는 가짜 `fetchJson`; URL로 어떤 픽스처를 줄지 고른다)

```ts
test('saves 4 documents, articles and links')        // law_documents 4행(is_upcoming 1행), 법 '29'→영 '30'→고시 '7' 연결 존재
test('re-running keeps ids and counts')               // 두 번 실행: 문서·조문·링크 수 동일, articles '29'의 id 동일 (Review Focus 2)
test('fetch failure leaves previous data intact')    // 1회 성공 후, 두 번째 실행의 fetchJson이 고시에서 throw → 예외, 기존 행 수·body 그대로
test('upcoming-only article 28의12 is stored on the upcoming document')
```
테스트 끝에 자신이 만든 행을 지운다(문서 삭제 → CASCADE). 다른 테스트 파일과 병렬 실행되므로 개수는 **이 테스트가 넣은 promulgation_no 범위**로만 센다.
- [ ] **Step 2: 실패 확인 → Step 3: 구현 → Step 4: 통과** (`npm test`)
- [ ] **Step 5: 실제 실행** — `npm run sync:laws` (개발 DB). 기대: documents 4, articles ≈ 141+146+153+20 범위, links > 100. psql로 `SELECT title, body FROM articles a JOIN law_documents d ON d.id=a.document_id WHERE d.kind='notice' AND a.article_key='7'` 확인.
- [ ] **Step 6: 커밋** — `git commit -m "feat: sync law texts from law.go.kr"`

---

### Task 4: 허브 데이터 추출 · seed (`npm run seed`) · 스키마 보정

**Files:**
- Create: `scripts/extract-hub-data.ts`, `db/seed/hub-law.json`, `db/seed/hub-decree.json`, `src/lib/study/hub-data.ts`, `src/lib/study/seed.ts`, `scripts/seed.ts`
- Modify: `db/init.sql`, `docs/DB_DESIGN.md`, `package.json` (`"seed": "node --env-file=.env scripts/seed.ts"`)
- Test: `src/lib/study/hub-data.test.ts`, `src/lib/study/seed.test.ts`

**Interfaces:**
- Produces (`hub-data.ts`, 순수): `type SeedData = { areas; units; unitLeaves; unitItems; anchors; mnemonics; cards; history }` (각 행은 DB 컬럼과 1:1, camelCase) · `buildSeedData(lawHub: unknown, decreeHub: unknown): SeedData`
- Produces (`seed.ts`): `saveSeedData(client: pg.ClientBase, data: SeedData): Promise<Record<string, number>>` — 한 트랜잭션. `areas`/`units`/`anchors` upsert(text PK), `cards` upsert `ON CONFLICT (deck, sort_order)`(**id 유지**), 이번 seed에 없는 `(deck, sort_order)` 카드는 삭제, `unit_leaves`·`unit_items`·`mnemonics`·`history_events`는 지우고 다시 넣기.
- 스키마: `cards.area_id`를 NULL 허용으로 — `init.sql`의 CREATE TABLE에서 `NOT NULL` 제거 + 기존 DB용 `ALTER TABLE cards ALTER COLUMN area_id DROP NOT NULL;`(재실행 안전). DB_DESIGN 표·이유("시행령 조문 카드는 대단원이 없음") 갱신. 이후 `npm run db:apply`, `npm run db:apply:test`.

- [ ] **Step 1: 추출 스크립트** — `scripts/extract-hub-data.ts`: 두 HTML의 `<script>`에서 `const NAME=` 선언을 `node:vm`으로 평가해 배열만 꺼낸다(DOM 코드는 실행하지 않음 — 각 선언의 리터럴 구간만 잘라 평가). 법령 허브: `AREAS, ANCHORS, MNEMO, CARDS, HISTORY`(CARDS는 `.map` 결과 그대로 i/area/t/n/x/concept), 시행령 허브: `DOMAINS, DECREE, TIMELINE`(DECREE는 `.map` 결과). JSON으로 `db/seed/hub-law.json`, `hub-decree.json`에 저장(커밋). 실행 후 파일에 `AREAS` 5개, `CARDS` 57개, `DECREE` 11개 장이 있는지 출력.
- [ ] **Step 2: 실패 테스트 `hub-data.test.ts`** (실제 seed JSON 사용)

```ts
areas 5개, weight 합 100, id 'a1'~'a5'; units 14개, id 'a1-1' 등 허브 그대로, law_summary/decree_summary = 허브 law/dec
unitLeaves: 허브 leaves 순서대로 (label, ref); unitItems: DOMAINS[di].units[ui] → AREAS[di].subs[ui] (순번 매칭), is_key = !!it[3]
cards: deck 'law' = CARDS 중 concept 아님(sort_order 0..), deck 'concept' = CARDS concept + DOMAINS 항목(앞: 항목명, 답: law_ref, extra: decree_ref, area = 해당 대단원), deck 'decree' = DECREE 조문(앞: '제30조' 형식, 답: 조 제목, extra: 장 제목, area null); 각 deck 안 sort_order 0부터 연속
anchors 34개(article_key 예 '24의2', is_new = 4번째 값 1); history = HISTORY(doc_kind 'law', article_keys = 태그) + TIMELINE(doc_kind 'decree', article_keys [])
```
- [ ] **Step 3: 실패 테스트 `seed.test.ts`** (테스트 DB) — 저장 후 행 수 검증; 사용자 1명 만들어 `user_card_levels`에 카드 하나 level 2 → seed 다시 실행 → 같은 card_id·level 2 유지 (Review Focus 3); 끝나면 seed 테이블·사용자 정리.
- [ ] **Step 4: 실패 확인 → Step 5: 구현 → Step 6: 통과** (`npm test`)
- [ ] **Step 7: 실제 실행** — `npm run db:apply && npm run seed` → 테이블별 행 수 출력.
- [ ] **Step 8: 커밋** — `git commit -m "feat: seed study data from hub html"`

---

### Task 5: 학습 데이터 조회 · 진도 저장 · 진도 계산

**Files:**
- Create: `src/lib/study/progress.ts` (순수), `src/lib/study/queries.ts`, `src/lib/study/progress-db.ts`, `src/lib/study/types.ts`, `src/app/(study)/actions.ts`
- Modify: `src/lib/auth/current-user.ts` (React `cache()`로 감싸기 — 한 요청에서 여러 컴포넌트가 불러도 DB 1회)
- Test: `src/lib/study/progress.test.ts`, `src/lib/study/progress-db.test.ts`

**Interfaces:**
- Produces (`types.ts`): `Area = { id; roman; name; weight; units: Unit[] }`, `Unit = { id; name; lawSummary; decreeSummary; leaves: {label; ref}[]; items: {label; lawRef; decreeRef; isKey}[] }`, `Card = { id: string; areaId: string | null; deck: 'law'|'concept'|'decree'; front; answer; extra: string | null }`, `Chapter = { label; title; articles: { key; title; isUpcoming: boolean }[] }`, `HistoryEvent`, `Anchor`, `Mnemonic`, `UserProgress = { reads: Record<string, number>; levels: Record<string, number>; examDate: string | null }`
- Produces (`progress.ts`): `weightedProgress(areas: Area[], reads): number` (0~100 반올림, 법령 허브 `renderOverview`와 같은 식) · `priorityUnits(areas, reads, limit = 4): { area: Area; unit: Unit; score: number }[]` (score = 대단원 배점/중단원 수 × (1 − 회독/3), 0 제외, 내림차순) · `nextCardLevel(level: number, ok: boolean): 1|2|3` (ok → min(3, level+1), 아니면 1) · `ddayLabel(examDate: string | null, today: Date): string` (`'D-?'`, `'D-12'`, `'D-Day'`, `'D+3'`, 날짜 기준은 자정) · `toggleRead(current: number, n: 1|2|3): number` (같은 n을 다시 누르면 n−1)
- Produces (`queries.ts`, server-only): `getStudyData(): Promise<{ areas; anchors; mnemonics; cards; history; lawChapters: Chapter[]; decreeChapters: Chapter[] }>` (장·조문은 현행 법률 + 시행예정에만 있는 조문을 `isUpcoming:true`로 끼워 넣음, 시행령은 현행) · `getUserProgress(userId: string): Promise<UserProgress>`
- Produces (`progress-db.ts`, server-only): `setUnitReads(userId, unitId, reads: 0|1|2|3)` · `setCardLevel(userId, cardId, level: 1|2|3)` · `resetCardLevels(userId, cardIds: string[])` · `setExamDate(userId, date: string | null)` — 모두 upsert, 범위 밖 값은 `Error('invalid progress value')`
- Produces (`actions.ts`, `'use server'`): `saveUnitReads(unitId: string, reads: number)`, `saveCardLevel(cardId: string, level: number)`, `clearCardLevels(cardIds: string[])`, `saveExamDate(date: string | null)` → 모두 `Promise<{ ok: true } | { ok: false; reason: 'auth' | 'invalid' }>`. 로그인 확인은 `getCurrentUser()`, 비로그인이면 DB에 쓰지 않는다. 날짜는 `/^\d{4}-\d{2}-\d{2}$/`만.
- Actions의 판정 로직은 `progress-db.ts`의 `applyProgressChange(user: User | null, change: …)`로 빼서 테스트한다(Server Action 파일은 얇게).

- [ ] **Step 1: 실패 테스트 `progress.test.ts`** — 허브와 같은 수치: 전부 0회독 → 0, a4 두 중단원 3회독 → 30, priority 첫 항목은 a4(배점 30), `nextCardLevel(3,true)===3`, `nextCardLevel(2,false)===1`, `ddayLabel('2026-11-15', new Date('2026-11-03T15:00:00'))==='D-12'`, 당일 'D-Day', 지난 날 'D+3', null 'D-?', `toggleRead(2,2)===1`, `toggleRead(0,3)===3`.
- [ ] **Step 2: 실패 테스트 `progress-db.test.ts`** — 저장·조회 왕복, 재저장 덮어쓰기, `reads 4`/`level 0` 거부, `applyProgressChange(null, …)` → `{ ok:false, reason:'auth' }`이고 해당 테이블 행 수 변화 없음 (Review Focus 4). 테스트용 사용자·카드·단원은 직접 만들고 정리.
- [ ] **Step 3: 실패 확인 → Step 4: 구현 → Step 5: 통과** (`npm test`)
- [ ] **Step 6: 커밋** — `git commit -m "feat: add study queries and progress storage"`

---

### Task 6: 대시보드 뼈대 · 개요·진도 탭

**Files:**
- Create: `src/app/(study)/layout.tsx`, `src/app/(study)/_components/StudyTabs.tsx`, `src/app/(study)/page.tsx` (개요·진도, 기존 `src/app/page.tsx` 대체 — 삭제하고 `login_error` 안내는 이 페이지로 옮김), `src/app/(study)/_components/ReadChecklist.tsx` (client), `src/app/(study)/_components/ExamDate.tsx` (client), `src/app/(study)/_components/ChapterAnchors.tsx` (client), `src/app/_components/theme.css` 또는 `globals.css`에 허브 색 토큰 추가
- Delete: `src/app/page.tsx`

**Interfaces:**
- Consumes: Task 5 전부, `formatArticleKey`
- Tabs(정확히, 순서대로): `개요·진도` `/` · `마인드맵` `/mindmap` · `암기 카드` `/cards` · `조문 매핑표` `/laws` · `개정 연혁` `/history`
- 개요 화면 구성은 `CPPG 법령 허브.html`의 `p-overview` 섹션을 그대로 옮긴다: 요약 숫자 3개(배점 가중 진도 %, 외운 카드(3단계)/전체, 회독 체크 합/42), 배점과 진도 막대(배점 내림차순), 지금 볼 단원(상위 4), 장별 조문 번호 앵커(번호·앵커를 누르면 그 자리에서 조문 전체 제목 표시 + "원문 보기" 링크 `/articles/law/<key>`), 회독 체크리스트(1·2·3회 버튼 → `saveUnitReads`), 꼭 외울 묶음, 우측 상단 시험일·D-day(`saveExamDate`).
- 색: 허브 `:root`의 토큰(`--c1`~`--c5`, `--accent` 등, 다크 모드 포함)을 CSS 변수로 가져와 대단원 색을 같게 한다.
- 비로그인: 진도 버튼은 보이되 누르면 "로그인하면 진도가 저장돼요" 문구(저장 안 함). 로그인 상태는 서버에서 진도를 읽어 초기값으로 준다.

- [ ] **Step 1: 구현** — 서버 컴포넌트에서 `getStudyData()`·`getCurrentUser()`·`getUserProgress()`를 `<Suspense>` 안에서 호출(Global Constraints의 `connection()` 규칙). 클라이언트 컴포넌트는 낙관적 갱신 후 Action 결과가 실패면 되돌리고 문구 표시.
- [ ] **Step 2: 확인** — `npm run build` 성공; `npm run dev` 후 `curl -s localhost:3000/ | grep -c '개인정보보호의 이해'` ≥ 1, 탭 5개 링크 존재, `제24조의2` 앵커 존재. 로그 오류 없음.
- [ ] **Step 3: 커밋** — `git commit -m "feat: add study dashboard overview tab"`

---

### Task 7: 마인드맵 · 암기 카드 탭

**Files:**
- Create: `src/app/(study)/mindmap/page.tsx`, `src/app/(study)/mindmap/MindMap.tsx` (client), `src/app/(study)/cards/page.tsx`, `src/app/(study)/cards/CardDeck.tsx` (client)

**Interfaces:**
- Consumes: `getStudyData`, `getUserProgress`, `saveCardLevel`, `clearCardLevels`, `nextCardLevel`
- 마인드맵: 법령 허브 `renderMind`/`buildTree`의 SVG 트리 그대로(노드 클릭 펼침·접기, 대단원 포커스 칩, 모두 펼치기/접기, "조문 번호 가리기" 토글 + 가린 칸 클릭으로 하나씩 보기). 트리 데이터는 `areas[].units[].leaves`.
- 카드: 법령 허브 카드 동작 그대로(낮은 단계 먼저, 같은 단계 안 무작위, 직전 카드 반복 회피, 뒤집기 Space, 1=다시·2=알아요, 단계 초기화). 범위 select: `전체` · 대단원 5개 · `법률 카드`(deck law) · `시행령 카드`(deck decree); 방향 select(제목 → 번호 / 번호 → 제목)는 deck `law`·`decree`에만 적용하고 `concept`는 항상 앞→답. 비로그인은 단계 변화가 화면에서만 유지되고 저장 시도 시 안내 문구.

- [ ] **Step 1: 구현**
- [ ] **Step 2: 확인** — build 성공; `/mindmap`에 `<svg`와 `개인정보 라이프사이클 관리`, `/cards`에 범위 옵션 `시행령 카드`가 있는지 curl로 확인.
- [ ] **Step 3: 커밋** — `git commit -m "feat: add mindmap and flashcard tabs"`

---

### Task 8: 조문 매핑표 · 개정 연혁 탭 · 조문 링크

**Files:**
- Create: `src/lib/law/linkify.ts` (순수), `src/app/(study)/laws/page.tsx`, `src/app/(study)/laws/LawTable.tsx` (client, 검색), `src/app/(study)/history/page.tsx`, `src/app/_components/ArticleRefText.tsx`
- Test: `src/lib/law/linkify.test.ts`

**Interfaces:**
- Produces: `splitArticleRefs(text: string): Array<{ text: string; key?: string }>` — `제24조의2`, `제28조의8~11`(첫 키 `28의8`만 링크), `제39조~제40조`(각각) 인식, 나머지는 일반 텍스트. `ArticleRefText({ text, kind })` → 키가 있는 조각은 `/articles/<kind>/<key>` 링크.
- 조문 매핑표: 법령 허브 `p-laws`(검색 + 표: 출제영역·중단원 | 법(링크 kind law) | 시행령(링크 kind decree)) + 그 아래 시행령 허브 `시행령 조문 색인`(장별 `제N조 제목`, 각 링크 kind decree).
- 개정 연혁: 법령 허브 `p-history` 타임라인(doc_kind law) + 시행령 허브 `꼭 볼 부칙`(doc_kind decree). 태그 `제N조`는 링크.

- [ ] **Step 1: 실패 테스트 `linkify.test.ts`** — `'제2조 정의, 제24조의2 주민등록번호'` → 키 `2`, `24의2`; `'제28조의8~11 국외 이전'` → 키 `28의8` 하나; `'제39조~제40조 유출'` → `39`, `40`; `'고시 제7조'`는 이 함수 결과에서 키 `7`(종류 판단은 호출자); 숫자 없는 텍스트 → 조각 1개.
- [ ] **Step 2: 실패 확인 → Step 3: 구현 → Step 4: 통과** (`npm test`)
- [ ] **Step 5: 확인** — build; `/laws?q=위탁`… 검색은 클라이언트이므로 curl로는 표에 `href="/articles/law/26"` 존재, `/history`에 `데이터 3법 개정` 존재.
- [ ] **Step 6: 커밋** — `git commit -m "feat: add law mapping table and history tabs"`

---

### Task 9: 3단 원문 화면 `/articles/[kind]/[key]`

**Files:**
- Create: `src/lib/law/three-tier.ts` (server-only), `src/app/articles/[kind]/[key]/page.tsx`, `src/app/articles/[kind]/[key]/not-found.tsx` 또는 앱 공통 `src/app/not-found.tsx`
- Test: `src/lib/law/three-tier.test.ts`

**Interfaces:**
- Consumes: DB(Task 3 적재), `formatArticleKey`, `ArticleRefText`
- Produces: `type ArticleView = { id: string; kind: DocKind; key: string; title: string; body: string | null; doc: { title; promulgationNo; effectiveOn; isUpcoming; fetchedAt: string | null } }` · `type ThreeTier = { entry: ArticleView; law: ArticleView[]; decree: ArticleView[]; notice: ArticleView[] }` · `parseArticleParams(kind: string, key: string): { kind: DocKind; key: string } | null` (key는 `decodeURIComponent` 후 `/^\d+(의\d+)?$/`) · `getThreeTier(kind: DocKind, key: string): Promise<ThreeTier | null>`
- 해석 규칙: 입구가 법률이면 현행 법률 조문(없으면 시행예정 조문) → 연결된 시행령 → 그 시행령에 연결된 고시. 입구가 시행령이면 위로 법률, 아래로 고시. 입구가 고시면 연결된 시행령 → 그 위 법률. 각 칸은 조 키 순서, 중복 제거. 없는 조문 → null.
- 화면(스펙 5.3 A안): 제목 줄 `formatArticleKey(entry.key)` + 제목, 넓은 화면 3칸 / 좁은 화면 세로(`grid-cols-1 md:grid-cols-3`), 칸 머리 `법률`·`시행령`·`고시 · 개인정보의 안전성 확보조치 기준`, 입구 조문 강조, 빈 칸은 `시행령 조문 없음`/`고시 조문 없음`, 시행예정 조문은 `🔜 2027. 3. 9. 시행` 표시, body는 `whitespace-pre-wrap`. 아래: 기준 법령(문서별 promulgationNo·시행일), "이 조문에 대해 질문하기" 링크 `/questions/new?articleId=<entry.id>`(게시판은 플랜 3), "관련 결정문" 자리(문구 "준비 중이에요"), 출처 줄(Global Constraints).

- [ ] **Step 1: 실패 테스트 `three-tier.test.ts`** (테스트 DB에 Task 3 `saveLawData`로 픽스처 적재)

```ts
parseArticleParams('law', '24%EC%9D%982') → { kind:'law', key:'24의2' }; ('law','24의2') 동일; ('foo','1') → null; ('law','abc') → null   // Review Focus 1
getThreeTier('law','29') → law ['29'], decree ['30'], notice ['3',...,'13'] (12개)
getThreeTier('notice','7') → decree에 '30','21의2' 포함, law에 '29' 포함   // Review Focus 5
getThreeTier('law','1') → decree [], notice []                              // Review Focus 5
getThreeTier('law','28의12') → law[0].doc.isUpcoming === true
getThreeTier('law','999') → null
```
- [ ] **Step 2: 실패 확인 → Step 3: 구현 → Step 4: 통과** (`npm test`)
- [ ] **Step 5: 페이지 구현** — `params`는 Next 16 방식(문서 확인), 잘못된 파라미터·null → `notFound()`. 개요·매핑표·연혁의 조문 링크가 이 페이지로 온다.
- [ ] **Step 6: 확인** — build; dev에서 `curl -s -o /dev/null -w '%{http_code}' localhost:3000/articles/law/999` → `404`, `/articles/foo/1` → `404`, `/articles/law/29`에 `제30조`·`개인정보의 암호화`·`시행령`·`출처: 법제처` 포함.
- [ ] **Step 7: 커밋** — `git commit -m "feat: add three-tier article view"`

---

### Task 10: 수동 검증 (6단계 완료 기준) · 문서

- [ ] **Step 1:** 브라우저 패널에서 `/` → 탭 5개 이동, 앵커 `29` → "원문 보기" → 3단 화면에서 법 제29조·영 제30조 ①항 각 호·고시 제3~13조가 세 칸으로 보인다(스펙 6단계 완료 기준).
- [ ] **Step 2:** 로그인 상태에서 회독 체크·카드 단계·시험일 저장 → 새로고침·`npm run dev` 재시작 후 유지. 로그아웃 상태에서 누르면 안내 문구, DB 변화 없음.
- [ ] **Step 3:** 좁은 화면(375px)에서 3단 화면이 세로로 쌓이고 가로 스크롤이 없다. 다크 모드에서 대단원 색이 보인다.
- [ ] **Step 4:** `npm run sync:laws`, `npm run seed`를 한 번씩 더 실행 → 진도 유지.
- [ ] **Step 5:** README "실행 방법"에 `npm run sync:laws`·`npm run seed` 순서와 `LAW_API_OC`(등록 IP에서만 호출됨) 추가, DB_DESIGN의 seed 출처 절을 실제 파일(`db/seed/*.json`)로 갱신. `npm test`·`npm run build`·`npm run lint` 통과 후 커밋 — `git commit -m "docs: document seed and law sync"`
