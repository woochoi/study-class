import Link from 'next/link'
import './board.css'

export default function QuestionsNotFound() {
  return (
    <section className="panel">
      <h2>찾는 글이 없어요</h2>
      <p className="hint">삭제되었거나 주소가 잘못되었을 수 있어요.</p>
      <Link href="/questions">목록으로</Link>
    </section>
  )
}
