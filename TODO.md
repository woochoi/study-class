# 남은 할 일

> 2026-11-05 기준. 운영 주소: https://ismsp-study-class.vercel.app
> 배포 순서 전체는 [README.md](README.md)의 "배포 (Vercel + Neon)" 체크리스트를 따른다. 1~10단계는 끝났다.

## 지인 공개 전에 할 일 (순서대로)

- [ ] **동의 화면 게시** (README 11단계)
  - Google Cloud Console → **OAuth 동의 화면**(브랜딩)에서 아래 두 링크를 넣는다.
    - 홈페이지: `https://ismsp-study-class.vercel.app`
    - 개인정보처리방침: `https://ismsp-study-class.vercel.app/privacy`
  - 게시 상태를 **프로덕션으로 게시**한다. 게시하기 전에는 테스트 사용자로 등록된 계정만 로그인할 수 있다.
- [ ] **완료 기준 확인** (README 12단계)
  - 다른 구글 계정으로 가입한다.
  - 회독 체크, 카드 단계, 시험일을 저장한다.
  - 질문을 쓰고, 또 다른 계정으로 답변을 단다.
  - 다시 접속해도 모두 남아 있는지 확인한다.
- [ ] **비밀 값 교체** (작업 중에 채팅에 노출됨)
  - 구글: **Add secret**으로 새 secret을 만든다.
    - Vercel `GOOGLE_CLIENT_SECRET`과 로컬 `.env`를 새 값으로 바꾼다.
    - 운영과 로컬 로그인을 다시 확인한다.
    - 확인되면 이전 secret 두 개를 **사용 중지**하고, 하루 뒤 삭제한다.
  - Neon: `my_study_cafe_owner` 비밀번호를 **Reset**한다.
    - Vercel `DATABASE_URL`(pooled, `-pooler`)을 새 주소로 바꾼다.
    - `.env.neon`의 `DATABASE_URL`(direct)도 새 주소로 바꾼다.
  - Vercel에서 **Redeploy**하고 `/health`가 `DB 연결: OK`인지 확인한다.
- [ ] **처리방침 Neon 연락처 확인**
  - `/privacy`에 `privacy@databricks.com`으로 적었는데, 원문 문장을 직접 확인하지 못했다.
  - https://www.databricks.com/legal/privacynotice 에서 확인하고, 다르면 `src/app/privacy/page.tsx`를 고친다.
- [ ] **삭제 SQL 시험 실행**
  - Neon에서 테스트 브랜치를 만든다.
  - [docs/ops/delete-user.sql](docs/ops/delete-user.sql)을 SQL Editor로 한 번 실행해 본다. `BEGIN…COMMIT`이 한 번에 실행되는지 본다.
- [ ] **지인에게 주소 공유** — 위 항목이 끝난 뒤.

## 운영 메모

- 로컬 `.env`에는 Neon 주소를 넣지 않는다. `npm run dev`에는 대상 DB 검사가 없다.
- 법령 동기화(`npm run sync:laws:neon`)는 open.law.go.kr에 등록한 집 IP에서만 된다.
  - 공유기를 다시 켜서 IP가 바뀌면 마이페이지에서 IP를 고친다.
  - IP가 바뀌어도 사이트 자체는 영향이 없다.
- master에 push하면 Vercel이 운영에 자동 배포한다.

## 나중에 (기능)

- 개인정보보호위원회 결정문 API (3단 화면 "관련 결정문" 칸)
- 시험문제 풀이 · 오답노트
- 복습 퀴즈 (계단식 화면 + 간격 반복 1→3→7→14→30일)

## 알려진 작은 문제

**게시판** (Plan 3)
- 목록에서 삭제된 질문에도 조문 태그 배지가 보인다.
- 마지막 페이지보다 뒤 페이지를 열면 "아직 질문이 없어요"라고 나온다.
- 질문 삭제와 답변 작성이 동시에 일어나면 방금 단 답변이 함께 지워질 수 있다 (매우 드묾).
- 삭제가 실패해도 안내 없이 페이지만 이동한다.

**배포 준비** (Plan 4 리뷰에서 남긴 것)
- 삭제 SQL은 이메일을 다섯 군데에서 바꿔야 한다. 일부만 바꾸면 일부만 지워질 수 있다.
- 삭제 SQL의 이메일 비교는 대소문자를 구분한다.
- Neon 명령은 `-pooler` 주소를 거부하지 않는다 (direct 주소를 써야 한다).
- 테스트 하나가 직접 의존성이 아닌 `pg-connection-string`을 import한다.
- CLAUDE.md의 G4와 §8에 아직 Supabase 문구가 남아 있다.
