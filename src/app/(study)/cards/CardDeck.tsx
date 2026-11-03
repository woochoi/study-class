"use client";

import { useEffect, useRef, useState } from "react";
import { nextCardLevel } from "@/lib/study/progress.ts";
import type { Area, Card } from "@/lib/study/types.ts";
import { clearCardLevels, saveCardLevel } from "../actions.ts";

type Mode = "t2n" | "n2t";

const AUTH_MSG = "로그인하면 진도가 저장돼요";
const FAIL_MSG = "저장하지 못했어요. 다시 시도해 주세요.";

function inRange(c: Card, range: string): boolean {
  if (range === "all") return true;
  if (range === "deck-law") return c.deck === "law";
  if (range === "deck-decree") return c.deck === "decree";
  return c.areaId === range;
}

function poolOf(cards: Card[], range: string, mode: Mode): Card[] {
  return cards.filter(
    (c) => inRange(c, range) && !(mode === "n2t" && c.deck === "concept"),
  );
}

/** 낮은 단계 먼저, 같은 단계 안에서 무작위, 직전 카드는 피함 */
function pickCard(
  deck: Card[],
  levels: Record<string, number>,
  prevId: string | null,
): string | null {
  if (deck.length === 0) return null;
  const lv = (c: Card) => levels[c.id] ?? 1;
  const min = Math.min(...deck.map(lv));
  let pool = deck.filter((c) => lv(c) === min);
  if (prevId && pool.length > 1) pool = pool.filter((c) => c.id !== prevId);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

export default function CardDeck({
  areas,
  cards,
  initialLevels,
}: {
  areas: Area[];
  cards: Card[];
  initialLevels: Record<string, number>;
}) {
  const [levels, setLevels] = useState(initialLevels);
  const [range, setRange] = useState("all");
  const [mode, setMode] = useState<Mode>("t2n");
  const [curId, setCurId] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const latestRef = useRef(initialLevels);
  const seqRef = useRef(new Map<string, number>());
  const confirmedRef = useRef(new Map<string, number>());
  const authShownRef = useRef(false);

  // 첫 카드는 마운트 뒤에 고른다 (렌더 중 무작위 금지: hydration 불일치 방지)
  useEffect(() => {
    // 마운트 직후 한 번 (동기 setState 대신 마이크로태스크)
    void Promise.resolve().then(() =>
      setCurId(pickCard(poolOf(cards, "all", "t2n"), initialLevels, null)),
    );
  }, [cards, initialLevels]);

  const areaOf = new Map(areas.map((a) => [a.id, a]));
  const deck = poolOf(cards, range, mode);
  const cur = curId ? (cards.find((c) => c.id === curId) ?? null) : null;
  const counts = [1, 2, 3].map(
    (k) => deck.filter((c) => (levels[c.id] ?? 1) === k).length,
  );

  function repick(
    nextRange: string,
    nextMode: Mode,
    nextLevels: Record<string, number>,
    prev: string | null,
  ) {
    setCurId(pickCard(poolOf(cards, nextRange, nextMode), nextLevels, prev));
    setFlipped(false);
  }

  function failMessage(reason: "auth" | "invalid") {
    if (reason === "auth") {
      if (authShownRef.current) return;
      authShownRef.current = true;
      setMessage(AUTH_MSG);
    } else {
      setMessage(FAIL_MSG);
    }
  }

  async function grade(ok: boolean) {
    if (!cur) return;
    const id = cur.id;
    const next = nextCardLevel(latestRef.current[id] ?? 1, ok);
    latestRef.current = { ...latestRef.current, [id]: next };
    const mySeq = (seqRef.current.get(id) ?? 0) + 1;
    seqRef.current.set(id, mySeq);
    setLevels(latestRef.current);
    setMessage(null);
    repick(range, mode, latestRef.current, id);
    const res = await saveCardLevel(id, next);
    if (res.ok) {
      confirmedRef.current.set(id, next);
      return;
    }
    // 비로그인: 이번 화면에서만 유지 (되돌리지 않음)
    if (res.reason === "auth") {
      failMessage("auth");
      return;
    }
    if (seqRef.current.get(id) !== mySeq) return;
    const back = confirmedRef.current.get(id) ?? initialLevels[id] ?? 1;
    latestRef.current = { ...latestRef.current, [id]: back };
    setLevels(latestRef.current);
    failMessage(res.reason);
  }

  async function resetDeck() {
    const ids = deck.map((c) => c.id);
    if (ids.length === 0) return;
    const prev = latestRef.current;
    const nextLevels = { ...prev };
    const mySeqs = new Map<string, number>();
    for (const id of ids) {
      delete nextLevels[id];
      const s = (seqRef.current.get(id) ?? 0) + 1;
      seqRef.current.set(id, s);
      mySeqs.set(id, s);
    }
    latestRef.current = nextLevels;
    setLevels(nextLevels);
    setMessage(null);
    repick(range, mode, nextLevels, null);
    const res = await clearCardLevels(ids);
    if (res.ok) {
      for (const id of ids) confirmedRef.current.delete(id);
      return;
    }
    if (res.reason === "auth") {
      failMessage("auth");
      return;
    }
    // 더 새로운 변경이 없는 카드만 되돌린다
    const restored = { ...latestRef.current };
    for (const id of ids) {
      if (seqRef.current.get(id) !== mySeqs.get(id)) continue;
      const back = confirmedRef.current.get(id) ?? initialLevels[id];
      if (back === undefined) delete restored[id];
      else restored[id] = back;
    }
    latestRef.current = restored;
    setLevels(restored);
    failMessage(res.reason);
  }

  // 키보드: Space 뒤집기, 1 다시, 2 알아요 (입력 요소에서는 무시)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (/INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement).tagName))
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "1") void grade(false);
      else if (e.key === "2") void grade(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // 카드 면 구성
  let tag = "";
  let q = "";
  let ask = "";
  let mono = false;
  let main: { text: string; mono: boolean } | null = null;
  let extra: string | null = null;
  if (cur) {
    const a = cur.areaId ? areaOf.get(cur.areaId) : undefined;
    tag = a ? `${a.roman} ${a.name}` : `시행령 · ${cur.extra ?? ""}`;
    extra = cur.extra;
    if (cur.deck === "concept") {
      q = cur.front;
      ask = "떠올린 뒤 눌러서 확인";
      main = { text: cur.answer, mono: false };
    } else {
      // law: 제목=front, 번호=answer / decree: 제목=answer, 번호=front
      const title = cur.deck === "law" ? cur.front : cur.answer;
      const num = cur.deck === "law" ? cur.answer : cur.front;
      if (mode === "t2n") {
        q = title;
        ask = "몇 조일까요?";
        main = { text: num, mono: true };
      } else {
        q = num;
        mono = true;
        ask = "조문 제목은?";
        main = { text: title, mono: false };
      }
    }
  }
  const areaClass = cur?.areaId ?? "";
  const lv = cur ? (levels[cur.id] ?? 1) : 1;

  return (
    <section className="panel">
      <div className="deckbar">
        <div className="toolbar">
          <label htmlFor="deckArea" className="muted" style={{ fontSize: 13 }}>
            범위
          </label>
          <select
            id="deckArea"
            value={range}
            onChange={(e) => {
              setRange(e.target.value);
              repick(e.target.value, mode, latestRef.current, curId);
            }}
          >
            <option value="all">전체 {cards.length}장</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.roman} {a.name} (
                {cards.filter((c) => c.areaId === a.id).length})
              </option>
            ))}
            <option value="deck-law">
              법률 카드 ({cards.filter((c) => c.deck === "law").length})
            </option>
            <option value="deck-decree">
              시행령 카드 ({cards.filter((c) => c.deck === "decree").length})
            </option>
          </select>
          <label htmlFor="deckMode" className="muted" style={{ fontSize: 13 }}>
            방향
          </label>
          <select
            id="deckMode"
            value={mode}
            onChange={(e) => {
              const m = e.target.value as Mode;
              setMode(m);
              repick(range, m, latestRef.current, curId);
            }}
          >
            <option value="t2n">제목 → 조문 번호</option>
            <option value="n2t">조문 번호 → 제목</option>
          </select>
        </div>
        <div className="boxes" aria-live="polite">
          <span>
            1단계 <b>{counts[0]}</b>
          </span>
          <span>
            2단계 <b>{counts[1]}</b>
          </span>
          <span>
            3단계(암기) <b>{counts[2]}</b>
          </span>
        </div>
      </div>

      <div
        className={`card ${areaClass}`}
        style={
          cur && !cur.areaId
            ? { ["--ac" as string]: "var(--accent)" }
            : undefined
        }
        tabIndex={0}
        aria-live="polite"
        onClick={() => setFlipped((f) => !f)}
      >
        {cur && main ? (
          <>
            <span className="tag">{tag}</span>
            <span className="lvl">{lv}단계</span>
            <div className={`q${mono ? " mono" : ""}`}>{q}</div>
            {flipped ? (
              <div className="a">
                {main.mono ? (
                  <span className="mono">{main.text}</span>
                ) : (
                  <b>{main.text}</b>
                )}
                {extra && (
                  <>
                    <br />
                    <span className="muted">{extra}</span>
                  </>
                )}
              </div>
            ) : (
              <div className="ask">{ask}</div>
            )}
          </>
        ) : (
          <div className="q">
            {curId === null && deck.length > 0
              ? "불러오는 중…"
              : "카드가 없습니다"}
          </div>
        )}
      </div>

      <div className="cbtns">
        <button
          type="button"
          className="btn bad"
          onClick={() => void grade(false)}
        >
          다시 볼래요 <kbd>1</kbd>
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setFlipped((f) => !f)}
        >
          뒤집기 <kbd>Space</kbd>
        </button>
        <button
          type="button"
          className="btn pri"
          onClick={() => void grade(true)}
        >
          알아요 <kbd>2</kbd>
        </button>
      </div>
      {message && (
        <p role="status" className="hint" style={{ textAlign: "center" }}>
          {message}
        </p>
      )}
      <p className="hint" style={{ textAlign: "center" }}>
        ‘알아요’를 누르면 한 단계 올라가고, ‘다시’를 누르면 1단계로 돌아갑니다.
        낮은 단계 카드가 먼저 나옵니다.{" "}
        <button
          type="button"
          className="chip"
          style={{ marginLeft: 6 }}
          onClick={() => void resetDeck()}
        >
          단계 초기화
        </button>
      </p>
    </section>
  );
}
