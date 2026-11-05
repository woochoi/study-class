import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | ISMS-P 스터디 까페",
};

function Todo({ children }: { children: string }) {
  return (
    <mark className="rounded bg-yellow-200 px-1 font-semibold text-black">
      {children}
    </mark>
  );
}

function Basis({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="ml-2 text-sm font-normal underline opacity-70 hover:opacity-100"
    >
      ({label})
    </Link>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 break-words px-4 py-6 leading-relaxed">
      <h1 className="mb-4 text-2xl font-bold">개인정보 처리방침</h1>
      <p className="mb-6 rounded border border-yellow-500 bg-yellow-100 p-3 text-sm text-black">
        초안 — 운영자가 검토 후 확정
      </p>
      <p className="mb-6">
        ISMS-P 스터디 까페(이하 &quot;까페&quot;)는 개인정보 보호법에 따라
        이용자의 개인정보를 보호하고 관련 고충을 처리하기 위해 다음과 같이
        처리방침을 수립·공개합니다.
        <Basis href="/articles/law/30" label="법 제30조" />
      </p>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">
          1. 처리 목적
          <Basis href="/articles/law/30" label="법 제30조" />
        </h2>
        <ul className="list-disc pl-5">
          <li>회원 식별 및 로그인</li>
          <li>학습 진도 저장</li>
          <li>문의 게시판 운영</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">
          2. 수집 항목
          <Basis href="/articles/law/30" label="법 제30조" />
        </h2>
        <ul className="list-disc pl-5">
          <li>구글 계정 식별자</li>
          <li>이메일</li>
          <li>이름</li>
          <li>프로필 사진 주소</li>
          <li>학습 진도·시험일</li>
          <li>작성한 질문·답변</li>
          <li>로그인 세션 정보</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">
          3. 보유 기간
          <Basis href="/articles/law/36" label="법 제36조" />
        </h2>
        <p>
          삭제(탈퇴) 요청 시까지 보유하며, 요청을 받으면 지체 없이 파기합니다.
          탈퇴하는 경우 해당 이용자가 작성한 질문·답변도 함께 삭제됩니다.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">
          4. 처리 위탁 및 국외 이전
          <Basis href="/articles/law/30" label="법 제30조" />
        </h2>
        <ul className="list-disc pl-5">
          <li>
            Vercel Inc. — 호스팅, 서버 위치: <Todo>[Vercel 함수 리전]</Todo>
          </li>
          <li>
            Neon — 데이터베이스, 서버 위치: <Todo>[Neon 리전]</Todo>
          </li>
        </ul>
        <p className="mt-2">
          이전 항목은 위 수집 항목 전부이며, 이전 목적은 서비스 제공(호스팅·저장)
          입니다.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">
          5. 정보주체의 권리와 행사 방법
          <Basis href="/articles/law/36" label="법 제36조" />
        </h2>
        <p>
          이용자는 아래 운영자 연락처로 개인정보의 열람·정정·삭제를 요청할 수
          있으며, 운영자는 지체 없이 조치합니다.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">
          6. 개인정보 보호책임자
          <Basis href="/articles/law/30" label="법 제30조" />
        </h2>
        <ul className="list-disc pl-5">
          <li>
            이름: <Todo>[이름]</Todo>
          </li>
          <li>
            연락처: <Todo>[연락처]</Todo>
          </li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">7. 시행일</h2>
        <p>
          이 처리방침은 <Todo>[시행일]</Todo>부터 시행합니다.
        </p>
      </section>
    </main>
  );
}
