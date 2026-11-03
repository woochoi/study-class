"use client";

import { useEffect, useState } from "react";
import type { Area } from "@/lib/study/types.ts";

type Node = {
  id: string;
  area: string;
  label: string;
  ref?: string;
  children?: Node[];
};
type Laid = Node & { d: number; size: [number, number]; x: number; y: number };
type Measure = (text: string, font: string) => number;

const FONT = {
  0: '700 16px "Gowun Batang", serif',
  1: '700 14.5px "IBM Plex Sans KR", sans-serif',
  2: '600 14px "IBM Plex Sans KR", sans-serif',
  3: '400 13.5px "IBM Plex Sans KR", sans-serif',
  ref: '400 12px "IBM Plex Mono", monospace',
};

/** SSR·측정 전 대체: 글자 폭 추정 (한글 등 전각은 글자 크기만큼) */
const estimate: Measure = (text, font) => {
  const px = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 14);
  let w = 0;
  for (const ch of text) w += ch.charCodeAt(0) > 0x2e80 ? px : px * 0.58;
  return w;
};

function buildTree(areas: Area[]): Node {
  return {
    id: "root",
    area: "",
    label: "개인정보 보호법 · CPPG",
    children: areas.map((a) => ({
      id: a.id,
      area: a.id,
      label: `${a.roman} ${a.name} ${a.weight}%`,
      children: a.units.map((u) => ({
        id: u.id,
        area: a.id,
        label: u.name,
        children: u.leaves.map((l, k) => ({
          id: `${u.id}-${k}`,
          area: a.id,
          label: l.label,
          ref: l.ref,
        })),
      })),
    })),
  };
}

function defaultCollapsed(areas: Area[]): Set<string> {
  const s = new Set<string>();
  for (const a of areas) for (const u of a.units) s.add(u.id);
  return s;
}

function layout(root: Node, collapsed: Set<string>, tw: Measure) {
  const vis: Laid[] = [];
  const links: [Laid, Laid][] = [];
  let row = 0;
  const ROW = 34;
  const PAD = 18;
  function walk(n: Node, d: number, parent: Laid | null): Laid {
    const isCollapsed = collapsed.has(n.id);
    let size: [number, number];
    if (d < 3) {
      const w =
        tw(n.label, FONT[d as 0 | 1 | 2]) +
        (d === 0 ? 32 : 24) +
        (n.children && isCollapsed ? 34 : 0);
      size = [w, d === 0 ? 38 : d === 1 ? 32 : 28];
    } else {
      size = [tw(n.label, FONT[3]) + tw(n.ref ?? "", FONT.ref) + 34, 26];
    }
    const me: Laid = { ...n, d, size, x: 0, y: 0 };
    vis.push(me);
    if (parent) links.push([parent, me]);
    if (n.children && n.children.length > 0 && !isCollapsed) {
      const kids = n.children.map((c) => walk(c, d + 1, me));
      me.y = (kids[0].y + kids[kids.length - 1].y) / 2;
    } else {
      me.y = PAD + row * ROW + ROW / 2;
      row++;
    }
    return me;
  }
  walk(root, 0, null);
  const colW = [0, 0, 0, 0];
  for (const n of vis) colW[n.d] = Math.max(colW[n.d], n.size[0]);
  const GAP = 46;
  const colX = [PAD];
  for (let i = 1; i < 4; i++) colX[i] = colX[i - 1] + colW[i - 1] + GAP;
  const maxD = Math.max(...vis.map((n) => n.d));
  const W = colX[maxD] + colW[maxD] + PAD;
  const H = Math.max(PAD * 2 + row * ROW, 120);
  for (const n of vis) n.x = colX[n.d];
  return { vis, links, W, H };
}

export default function MindMap({ areas }: { areas: Area[] }) {
  const [root] = useState(() => buildTree(areas));
  const [collapsed, setCollapsed] = useState(() => defaultCollapsed(areas));
  const [mask, setMask] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [focus, setFocus] = useState<string | null>(null);
  const [measure, setMeasure] = useState<{ fn: Measure }>({ fn: estimate });

  // 마운트 후 canvas 로 실제 글자 폭 측정 (웹폰트 로드 뒤 한 번 더)
  useEffect(() => {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return;
    const fn: Measure = (text, font) => {
      ctx.font = font;
      return ctx.measureText(text).width;
    };
    // 웹폰트 로드 뒤(없으면 즉시) 실제 폭으로 교체
    void (document.fonts?.ready ?? Promise.resolve()).then(() =>
      setMeasure({ fn }),
    );
  }, []);

  const { vis, links, W, H } = layout(root, collapsed, measure.fn);
  const tw = measure.fn;

  function setAll(fn: (n: Node, d: number) => boolean) {
    const next = new Set<string>();
    for (const a of root.children ?? []) {
      if (fn(a, 1)) next.add(a.id);
      for (const s of a.children ?? []) if (fn(s, 2)) next.add(s.id);
    }
    setCollapsed(next);
  }

  function onNode(n: Laid) {
    if (n.children) {
      if (n.d === 0) {
        const anyOpen = (n.children ?? []).some((c) => !collapsed.has(c.id));
        setCollapsed((prev) => {
          const next = new Set(prev);
          for (const c of n.children ?? []) {
            if (anyOpen) next.add(c.id);
            else next.delete(c.id);
          }
          return next;
        });
      } else {
        setCollapsed((prev) => {
          const next = new Set(prev);
          if (!next.delete(n.id)) next.add(n.id);
          return next;
        });
      }
    } else if (mask) {
      setRevealed((prev) => {
        const next = new Set(prev);
        if (!next.delete(n.id)) next.add(n.id);
        return next;
      });
    }
  }

  function focusArea(f: string | null) {
    setFocus(f);
    setAll((n, d) =>
      f === null ? d === 2 : d === 1 ? n.id !== f : n.area !== f,
    );
  }

  return (
    <section className="panel">
      <div className="toolbar">
        <button
          type="button"
          className={`chip${focus === null ? " on" : ""}`}
          onClick={() => focusArea(null)}
        >
          전체
        </button>
        {areas.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`chip ${a.id}${focus === a.id ? " on" : ""}`}
            onClick={() => focusArea(a.id)}
          >
            <span className="dot" />
            {a.roman} {a.weight}%
          </button>
        ))}
        <span className="sep" aria-hidden="true" />
        <button
          type="button"
          className="chip"
          onClick={() => {
            setFocus(null);
            setAll(() => false);
          }}
        >
          모두 펼치기
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => {
            setFocus(null);
            setAll((_n, d) => d === 2);
          }}
        >
          접기
        </button>
        <button
          type="button"
          className={`chip${mask ? " on" : ""}`}
          aria-pressed={mask}
          onClick={() => {
            setMask(!mask);
            setRevealed(new Set());
          }}
        >
          조문 번호 가리기
        </button>
      </div>
      <p className="hint">
        노드를 누르면 펼치고 접습니다. ‘조문 번호 가리기’를 켜고 떠올려 본 뒤,
        가려진 칸을 눌러 확인하세요. (법 = 법률, 영 = 시행령 — 「안전성 확보조치
        기준」 제1조의 약칭 방식, 고시 = 하위 고시 · 3단비교: 법 → 영 → 고시)
      </p>
      <div className="mapscroll">
        <svg
          className="mind"
          role="img"
          aria-label="출제영역 마인드맵"
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
        >
          {links.map(([p, c]) => {
            const x1 = p.x + p.size[0];
            const x2 = c.x;
            const mx = (x1 + x2) / 2;
            return (
              <path
                key={c.id}
                className={`lnk ${c.area}`}
                d={`M${x1},${p.y} C${mx},${p.y} ${mx},${c.y} ${x2},${c.y}`}
              />
            );
          })}
          {vis.map((n) => {
            const [w, h] = n.size;
            const cls = n.d === 0 ? "r0" : `d${n.d}`;
            const isCollapsed = collapsed.has(n.id);
            if (n.d < 3) {
              return (
                <g
                  key={n.id}
                  className={`n ${cls} ${n.area}`}
                  transform={`translate(${n.x},${n.y - h / 2})`}
                  onClick={() => onNode(n)}
                >
                  <rect width={w} height={h} rx={h / 2} />
                  <text x={n.d === 0 ? 16 : 12} y={h / 2 + 5}>
                    {n.label}
                  </text>
                  {n.children && isCollapsed && (
                    <text
                      className="badge"
                      x={w - 30}
                      y={h / 2 + 4}
                      style={n.d === 1 ? { fill: "var(--surface)" } : undefined}
                    >
                      +{n.children.length}
                    </text>
                  )}
                </g>
              );
            }
            const ref = n.ref ?? "";
            const lw = tw(n.label, FONT[3]);
            const rw = tw(ref, FONT.ref);
            const rx = lw + 20;
            const hide = mask && !revealed.has(n.id) && ref !== "이론";
            return (
              <g
                key={n.id}
                className={`n ${cls} ${n.area}`}
                transform={`translate(${n.x},${n.y - h / 2})`}
                onClick={() => onNode(n)}
              >
                <rect className="bg" width={w} height={h} rx={6} />
                <text className="l" x={10} y={h / 2 + 4.5}>
                  {n.label}
                </text>
                {hide ? (
                  <rect
                    className="mask"
                    x={rx - 4}
                    y={4}
                    width={rw + 8}
                    height={h - 8}
                    rx={4}
                  />
                ) : (
                  <text className="ref" x={rx} y={h / 2 + 4}>
                    {ref}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
