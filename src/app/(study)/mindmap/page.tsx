import { connection } from "next/server";
import { Suspense } from "react";
import { getStudyData } from "@/lib/study/queries.ts";
import MindMap from "./MindMap.tsx";

async function Loader() {
  // DB 읽기는 요청 시점에 실행 (정적 셸에 굳지 않게)
  await connection();
  const data = await getStudyData();
  return <MindMap areas={data.areas} />;
}

export default function MindMapPage() {
  return (
    <Suspense fallback={<p className="hint">불러오는 중…</p>}>
      <Loader />
    </Suspense>
  );
}
