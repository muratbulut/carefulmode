"use client";

import "@fontsource-variable/caveat";
import "./Chalkboard.css";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { getMessages } from "@/lib/i18n";
import { useReducedMotion } from "./useReducedMotion";

/** Tahtanın içi bu birimlerle çizilir (Chalkboard.css'teki --u). */
const boardWidth = 552;
const boardHeight = 380;
/** Bir adım; yazı her harf için iki adım sürer. */
export const chalkTickMs = 55;

type Segment = { type: "text" | "draw" | "hold" | "wipe"; key: string; text: string; start: number; dur: number };

/**
 * Tahtadaki ders (tuvaldeki plan): iki satır harf harf yazılır, altı çizilir, bir süre durur, silgi
 * siler, kısa bir boşluktan sonra baştan başlar. Yazı ve çizgiden sonra 6 adım soluklanılır.
 */
function buildPlan(lines: readonly string[]) {
  const plan: [Segment["type"], string, string | number][] = [
    ["text", "L1", lines[0]],
    ["text", "L2", lines[1]],
    ["draw", "U", 16],
    ["hold", "H", 120],
    ["wipe", "W", 28],
    ["hold", "G", 14],
  ];
  let at = 0;
  const segments = plan.map(([type, key, value]): Segment => {
    const dur = type === "text" ? String(value).length * 2 : Number(value);
    const segment = { type, key, text: type === "text" ? String(value) : "", start: at, dur };
    at += dur + (type === "text" || type === "draw" ? 6 : 0);
    return segment;
  });
  return { segments, total: at, holdAt: segments.find((s) => s.key === "H")!.start };
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const unit = (n: number) => `calc(${n.toFixed(1)} * var(--u))`;

type Point = { x: number; y: number };

/**
 * Öğretmenler için kahramanındaki tahta (4 Kasım, Murat: 16 B). Tebeşir "Tıklamadan önce / bir
 * düşün." yazar, altını çizer; bir süre sonra silgi siler ve ders baştan başlar.
 *
 * Sürpriz: fare tahtanın üstüne gelince tebeşir imleci izler, basılı tutup sürükleyince tahtaya
 * yazılır; tebeşir eldeyken ders bekler, silgi kullanıcının çizdiklerini de siler. Dokunmatik
 * ekranda sayfa kaydırılabilsin diye yalnızca fare ve kalem yazar. "Hareketi azalt" açıksa yazı
 * son haliyle durur.
 */
export function Chalkboard() {
  const t = getMessages().teachersPage.board;
  const [plan] = useState(() => buildPlan(t.lines));
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  const [hand, setHand] = useState<Point | null>(null);
  const [pressed, setPressed] = useState(false);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  // Yalnızca ekrandayken oynar (IntersectionObserver yoksa hep oynar).
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  const surface = useRef<HTMLDivElement>(null);
  const tickRef = useRef(0);

  useEffect(() => {
    const el = surface.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const running = !reduce && visible && hand === null;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const next = tickRef.current + 1 < plan.total ? tickRef.current + 1 : 0;
      tickRef.current = next;
      // Ders baştan başlarken kullanıcının çizdikleri de silinmiş olur.
      if (next === 0) setStrokes([]);
      setTick(next);
    }, chalkTickMs);
    return () => clearInterval(timer);
  }, [running, plan.total]);

  const t0 = reduce ? plan.holdAt : tick;
  const progress: Record<string, number> = {};
  let active: Segment | null = null;
  for (const segment of plan.segments) {
    const v = clamp((t0 - segment.start) / segment.dur);
    progress[segment.key] = v;
    if (v > 0 && v < 1) active = segment;
  }
  const holding = hand !== null;
  const typed = (key: string) => {
    const segment = plan.segments.find((s) => s.key === key)!;
    return segment.text.slice(0, Math.round(segment.text.length * progress[key]));
  };
  const writing = (key: string) => !holding && active?.key === key;
  const jig = t0 % 2 ? 1 : 0;
  const drawTip = !holding && active?.key === "U" ? { x: 176 + 208 * progress.U, y: 270 - 12 * progress.U } : null;
  const wiping = !holding && progress.W > 0 && progress.W < 1;
  const wipe = { x: -110 + progress.W * 720, y: 150 + Math.sin(progress.W * Math.PI * 7) * 110 };
  const trayChalk = !holding && !(active && (active.type === "text" || active.type === "draw"));

  function point(event: PointerEvent<HTMLDivElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * boardWidth, y: ((event.clientY - rect.top) / rect.height) * boardHeight };
  }
  const usesHand = (event: PointerEvent) => event.pointerType === "mouse" || event.pointerType === "pen";

  function onMove(event: PointerEvent<HTMLDivElement>) {
    if (!usesHand(event)) return;
    const p = point(event);
    setHand(p);
    if (!pressed) return;
    setStrokes((all) => {
      const last = all[all.length - 1];
      if (!last) return all;
      const end = last[last.length - 1];
      if (Math.hypot(p.x - end.x, p.y - end.y) <= 2.5 || last.length >= 400) return all;
      return [...all.slice(0, -1), [...last, p]];
    });
  }

  function onDown(event: PointerEvent<HTMLDivElement>) {
    if (!usesHand(event) || event.button !== 0) return;
    const p = point(event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setHand(p);
    setPressed(true);
    setStrokes((all) => [...all.slice(-59), [p, { x: p.x + 0.1, y: p.y }]]);
  }

  function onLeave(event: PointerEvent<HTMLDivElement>) {
    if (!usesHand(event)) return;
    setPressed(false);
    setHand(null);
  }

  const strokePath = strokes.map((s) => `M${s.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" L")}`).join(" ");

  return (
    <div className="cb-board" role="img" aria-label={t.label}>
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <filter id="cb-chalk" x="-4%" y="-4%" width="108%" height="108%">
            <feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves={2} seed={7} result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.6 0 0 0 -0.45" result="m" />
            <feComposite in="SourceGraphic" in2="m" operator="in" result="c" />
            <feDisplacementMap in="c" in2="n" scale={1.8} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <div
        ref={surface}
        className="cb-surface"
        data-chalk={holding ? "hand" : undefined}
        aria-hidden="true"
        onPointerEnter={onMove}
        onPointerMove={onMove}
        onPointerDown={onDown}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={onLeave}
      >
        <div className="cb-writing" style={{ opacity: 1 - progress.W }}>
          {(["L1", "L2"] as const).map((key, i) => (
            <div key={key} className="cb-line" data-line={i + 1}>
              {typed(key)}
              {writing(key) ? (
                <span className="cb-pin-inline">
                  <span className="cb-stick" style={{ transform: `rotate(-38deg) translateY(${jig}px)` }} />
                </span>
              ) : null}
            </div>
          ))}
          <svg className="cb-svg" viewBox={`0 0 ${boardWidth} ${boardHeight}`} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path
              className="cb-underline"
              d="M176 270 C 236 262, 320 266, 384 258"
              pathLength={100}
              strokeWidth={4}
              strokeDasharray={100}
              strokeDashoffset={(100 * (1 - progress.U)).toFixed(1)}
            />
            {strokePath ? <path className="cb-strokes" d={strokePath} strokeWidth={3.4} /> : null}
          </svg>
        </div>

        {drawTip ? (
          <span className="cb-pin" style={{ left: unit(drawTip.x), top: unit(drawTip.y) }}>
            <span className="cb-stick" style={{ transform: `rotate(-38deg) translateY(${jig}px)` }} />
          </span>
        ) : null}
        {hand ? (
          <span className="cb-pin" style={{ left: unit(hand.x), top: unit(hand.y) }}>
            <span className="cb-stick" style={{ transform: `rotate(${pressed ? -30 : -42}deg)` }} />
          </span>
        ) : null}
        {wiping ? <span className="cb-eraser" style={{ left: unit(wipe.x), top: unit(wipe.y) }} /> : null}
      </div>
      <div className="cb-ledge" aria-hidden="true">
        {trayChalk ? <span className="cb-tray-chalk" /> : null}
        <span className="cb-tray-yellow" />
        <span className="cb-tray-pen" />
        {wiping ? null : <span className="cb-tray-eraser" />}
      </div>
    </div>
  );
}
