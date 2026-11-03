import { Suspense } from 'react'
import { getCurrentProgress } from '@/lib/study/current-progress.ts'
import { getStudyData } from '@/lib/study/queries.ts'
import ChapterAnchors from './_components/ChapterAnchors.tsx'
import PriorityUnits from './_components/PriorityUnits.tsx'
import ProgressProvider from './_components/ProgressProvider.tsx'
import ProgressSummary from './_components/ProgressSummary.tsx'
import ReadChecklist from './_components/ReadChecklist.tsx'

async function LoginError({ searchParams }: { searchParams: PageProps<'/'>['searchParams'] }) {
  const { login_error } = await searchParams
  if (!login_error) return null
  return (
    <p role="alert" className="notice">
      로그인에 실패했어요. 다시 시도해 주세요.
    </p>
  )
}

async function Overview() {
  const [data, { progress }] = await Promise.all([getStudyData(), getCurrentProgress()])
  const knownCards = data.cards.filter((c) => (progress.levels[c.id] ?? 1) >= 3).length
  const areaOf = new Map(data.areas.map((a) => [a.id, a]))
  return (
    <ProgressProvider areas={data.areas} initialReads={progress.reads}>
      <section className="panel">
        <div className="grid2">
          <div className="box">
            <ProgressSummary knownCards={knownCards} totalCards={data.cards.length} />
          </div>
          <div className="box">
            <h3>지금 볼 단원</h3>
            <p className="hint" style={{ marginBottom: 12 }}>
              배점 × 남은 회독으로 계산했습니다. 회독을 체크하면 순서가 바뀝니다.
            </p>
            <PriorityUnits />
          </div>
        </div>

        <div className="box">
          <h3>장별 조문 번호 앵커</h3>
          <p className="hint" style={{ marginBottom: 12 }}>
            장마다 기준점이 되는 조문 번호입니다. 점선 칸은 시험 빈도가 높아 새로 넣은 앵커입니다. 칸 아래 작은 번호는 그 장의
            조문 전체이고, 밑줄 친 번호가 앵커입니다. 밑줄 없는 번호는 앞뒤 앵커에 붙여 외우세요.{' '}
            <b>번호나 앵커를 누르면 조문 전체 제목이 나옵니다</b>(다시 누르면 닫힘, 기울임 번호는 시행예정).
          </p>
          <ChapterAnchors chapters={data.lawChapters} anchors={data.anchors} />
        </div>

        <div className="grid2">
          <div className="box">
            <h3>회독 체크리스트</h3>
            <ReadChecklist />
          </div>
          <div className="box">
            <h3>꼭 외울 묶음</h3>
            <ul className="mn">
              {data.mnemonics.map((m) => (
                <li key={`${m.areaId}-${m.title}`} className={areaOf.has(m.areaId) ? m.areaId : undefined}>
                  <b>{m.title}</b>
                  <span>{m.body}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </ProgressProvider>
  )
}

export default function StudyHome(props: PageProps<'/'>) {
  return (
    <>
      <Suspense>
        <LoginError searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={<p className="hint">불러오는 중…</p>}>
        <Overview />
      </Suspense>
    </>
  )
}
