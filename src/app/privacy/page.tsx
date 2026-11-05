import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | ISMS-P 스터디 까페",
};

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
          4. 제3자 제공
          <Basis href="/articles/law/30" label="법 제30조" />
        </h2>
        <p>
          까페는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에
          따른 경우는 예외로 합니다.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">
          5. 처리 위탁 및 국외 이전
          <Basis href="/articles/law/28의8" label="법 제28조의8" />
        </h2>
        <ul className="list-disc pl-5">
          <li>
            이전받는 자: Vercel Inc. (호스팅), 서버 위치: 싱가포르(AWS
            ap-southeast-1, sin1), 연락처: privacy@vercel.com
          </li>
          <li>
            이전받는 자: Neon, LLC (데이터베이스, Databricks, Inc. 계열),
            서버 위치: 싱가포르(AWS ap-southeast-1), 연락처:
            privacy@databricks.com
          </li>
        </ul>
        <ul className="mt-2 list-disc pl-5">
          <li>이전 항목: 위 수집 항목 전부</li>
          <li>이전 목적: 서비스 제공(호스팅·저장)</li>
          <li>이전 시기·방법: 서비스를 이용할 때 네트워크를 통해 수시로 전송</li>
          <li>보유·이용 기간: 삭제(탈퇴) 요청 시까지</li>
        </ul>
        <p className="mt-2">
          호스팅 사업자는 접속 기록(IP 주소 등)을 자체 정책에 따라 보관할 수
          있습니다.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">
          6. 자동 수집 장치(쿠키)
          <Basis href="/articles/law/30" label="법 제30조" />
        </h2>
        <ul className="list-disc pl-5">
          <li>
            로그인 세션 쿠키: 로그인 상태를 유지하기 위해서만 사용하며 최대 30일간
            유지됩니다.
          </li>
          <li>
            구글 로그인 확인용 쿠키: 구글 로그인 진행 중에만 사용하며 10분 안에
            만료됩니다.
          </li>
          <li>추적·광고 목적의 쿠키는 사용하지 않습니다.</li>
          <li>
            브라우저에서 쿠키를 거부하면 로그인할 수 없어 서비스를 이용할 수
            없습니다.
          </li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">
          7. 파기 절차 및 방법
          <Basis href="/articles/law/36" label="법 제36조" />
        </h2>
        <p>
          삭제 요청을 확인하면 운영자가 데이터베이스에서 해당 이용자의 데이터를
          삭제하며, 삭제한 데이터는 복구할 수 없습니다. 처리 기록을 남깁니다.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">
          8. 안전성 확보 조치
          <Basis href="/articles/law/29" label="법 제29조" />
        </h2>
        <ul className="list-disc pl-5">
          <li>전송 구간 암호화: HTTPS, 데이터베이스 연결 시 SSL 인증서 검증</li>
          <li>데이터베이스 접근은 서버에서만 이루어짐</li>
          <li>로그인 세션 토큰은 해시(SHA-256)로 저장</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">
          9. 정보주체의 권리와 행사 방법
          <Basis href="/articles/law/36" label="법 제36조" />
        </h2>
        <p>
          이용자는 아래 운영자 연락처로 개인정보의 열람·정정·삭제를 요청할 수
          있으며, 운영자는 지체 없이 조치합니다.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">
          10. 개인정보 보호책임자
          <Basis href="/articles/law/30" label="법 제30조" />
        </h2>
        <ul className="list-disc pl-5">
          <li>
            이름: 최웅식
          </li>
          <li>
            연락처: epee2000@gmail.com
          </li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">11. 시행일</h2>
        <p>
          이 처리방침은 2026년 11월 5일부터 시행합니다.
        </p>
      </section>
    </main>
  );
}
