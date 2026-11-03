import { Suspense } from 'react'
import { getCurrentProgress } from '@/lib/study/current-progress.ts'
import ExamDate from './_components/ExamDate.tsx'
import StudyTabs from './_components/StudyTabs.tsx'
import './study.css'

async function ExamDateLoader() {
  const { progress } = await getCurrentProgress()
  return <ExamDate initial={progress.examDate} />
}

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="study">
      <div className="wrap">
        <header className="top">
          <div>
            <div className="eyebrow">CPPG · ISMS-P 대비 — 개인정보 보호법 · 시행령</div>
            <h1>CPPG 조문 학습판</h1>
            <p>
              출제영역 5개 대단원을 법률·시행령 조문과 이어 놓았습니다. 배점이 큰데 아직 덜 본 단원부터 추천하고, 암기 카드로
              조문 번호를 반복합니다.
            </p>
          </div>
          <Suspense fallback={<ExamDate initial={null} />}>
            <ExamDateLoader />
          </Suspense>
        </header>
        <StudyTabs />
        {children}
      </div>
    </div>
  )
}
