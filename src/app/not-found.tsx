import Link from 'next/link'

export default function NotFound() {
  return (
    <main style={{ padding: '48px 16px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>찾는 조문이 없어요</h1>
      <p style={{ margin: '12px 0 24px' }}>주소를 다시 확인하거나 처음 화면에서 조문을 골라 주세요.</p>
      <Link href="/" style={{ textDecoration: 'underline' }}>
        처음으로 돌아가기
      </Link>
    </main>
  )
}
