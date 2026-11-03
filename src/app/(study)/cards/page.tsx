import { connection } from "next/server";
import { Suspense } from "react";
import { getCurrentProgress } from "@/lib/study/current-progress.ts";
import { getStudyData } from "@/lib/study/queries.ts";
import CardDeck from "./CardDeck.tsx";

async function Loader() {
  // DB 읽기는 요청 시점에 실행 (정적 셸에 굳지 않게)
  await connection();
  const [data, { progress }] = await Promise.all([
    getStudyData(),
    getCurrentProgress(),
  ]);
  return (
    <CardDeck
      areas={data.areas}
      cards={data.cards}
      initialLevels={progress.levels}
    />
  );
}

export default function CardsPage() {
  return (
    <Suspense fallback={<p className="hint">불러오는 중…</p>}>
      <Loader />
    </Suspense>
  );
}
