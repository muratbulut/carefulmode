"use client";

import { useEffect, useEffectEvent, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Eğitim kartlarında sürükle bırak (kutulara ayırma, eşleştirme, boşluk doldurma). Dokunarak
 * yerleştirme hep durur; sürükleme isteyene ek bir yoldur.
 *
 * - Farede biraz kımıldayınca (5 px) başlar.
 * - Dokunmada kısa basılı tutunca (180 ms) başlar; ondan önce kayan parmak sayfayı kaydırır.
 * - Bırakılan yer, parmağın altındaki `[data-drop]` öğesidir (değeri yerin sırası).
 * - Sürüklerken ekranın kenarına gelince sayfa kayar; kartlar arası kaydırma çalışmaz (`rootProps`).
 */
export type Drag = { item: number; x: number; y: number; dx: number; dy: number; w: number; over: number | null };
type Gesture = { item: number; pointerId: number; touch: boolean; x0: number; y0: number; dx: number; dy: number; w: number; active: boolean };

const holdMs = 180;

function dropAt(x: number, y: number): number | null {
  const el = document.elementFromPoint?.(x, y)?.closest<HTMLElement>("[data-drop]");
  return el ? Number(el.dataset.drop) : null;
}

export function useDragDrop({ enabled, onStart, onDrop }: { enabled: boolean; onStart?: () => void; onDrop: (item: number, target: number) => void }) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const timer = useRef<number | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const quietUntil = useRef({ at: 0, item: -1 });
  const stopGesture = useRef<() => void>(() => {});

  // Sürükleme sırasında pencere düzeyinde dinlenir: parmak öğenin dışına çıksa da izlenir. Dinleyiciler
  // bastığı andaki kapanışı kullanır; sürüklerken kartın durumu değişmez.
  function onMove(e: PointerEvent) {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    pointer.current = { x: e.clientX, y: e.clientY };
    const dist = Math.hypot(e.clientX - g.x0, e.clientY - g.y0);
    if (!g.active) {
      // Dokunmada basılı tutmadan kayan parmak sayfayı kaydırıyor demektir.
      if (g.touch) {
        if (dist > 8) stopGesture.current();
      } else if (dist > 5) activate();
      return;
    }
    setDrag({ item: g.item, x: e.clientX, y: e.clientY, dx: g.dx, dy: g.dy, w: g.w, over: dropAt(e.clientX, e.clientY) });
  }

  function onUp(e: PointerEvent) {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    if (g.active) {
      quietUntil.current = { at: e.timeStamp + 400, item: g.item };
      const over = e.type === "pointerup" ? dropAt(e.clientX, e.clientY) : null;
      if (over !== null) onDrop(g.item, over);
    }
    stopGesture.current();
  }

  function onTouchMove(e: TouchEvent) {
    if (gesture.current?.active) e.preventDefault();
  }

  function activate() {
    const g = gesture.current;
    if (!g || g.active) return;
    g.active = true;
    onStart?.();
    setDrag({ item: g.item, x: pointer.current.x, y: pointer.current.y, dx: g.dx, dy: g.dy, w: g.w, over: dropAt(pointer.current.x, pointer.current.y) });
  }

  /** Sürüklenebilir öğenin `onPointerDown`'u. */
  function down(item: number, e: ReactPointerEvent<HTMLElement>) {
    if (!enabled || e.button > 0 || gesture.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.pointerType !== "mouse";
    gesture.current = { item, pointerId: e.pointerId, touch, x0: e.clientX, y0: e.clientY, dx: e.clientX - rect.left, dy: e.clientY - rect.top, w: rect.width, active: false };
    pointer.current = { x: e.clientX, y: e.clientY };
    const move = onMove;
    const up = onUp;
    const touchMove = onTouchMove;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("touchmove", touchMove, { passive: false });
    if (touch) timer.current = window.setTimeout(activate, holdMs);
    stopGesture.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("touchmove", touchMove);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      gesture.current = null;
      setDrag(null);
    };
  }

  /** Sürükleyip bırakınca sürüklenen öğeye düşen tıklama sayılmaz (olay zamanıyla). */
  function quiet(item: number, at: number) {
    return item === quietUntil.current.item && at < quietUntil.current.at;
  }

  // Kart kapanırken yarım kalan sürükleme temizlenir.
  useEffect(() => () => stopGesture.current(), []);

  // Sürüklerken parmak ekranın kenarına gelince sayfa kayar (telefonda hedef aşağıda kalabilir).
  const dragging = drag !== null;
  const scrollEdge = useEffectEvent(() => {
    const { x, y } = pointer.current;
    const step = y < 80 ? -12 : y > window.innerHeight - 110 ? 12 : 0;
    if (step === 0) return;
    window.scrollBy(0, step);
    const g = gesture.current;
    if (g?.active) setDrag({ item: g.item, x, y, dx: g.dx, dy: g.dy, w: g.w, over: dropAt(x, y) });
  });
  useEffect(() => {
    if (!dragging) return;
    let frame = 0;
    const tick = () => {
      scrollEdge();
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [dragging]);

  // Öğeyi sürüklerken kartlar arası kaydırma (TrainingPlayer) çalışmasın.
  const rootProps = {
    onTouchStart: (e: ReactTouchEvent) => {
      if (gesture.current) e.stopPropagation();
    },
    onTouchEnd: (e: ReactTouchEvent) => {
      if (gesture.current || e.timeStamp < quietUntil.current.at) e.stopPropagation();
    },
  };

  return { drag, down, quiet, rootProps };
}

/** Sürüklenebilir öğelere ortak sınıflar: uzun basınca menü ve seçim çıkmasın, dokunuş gecikmesin. */
export const draggable = "cursor-grab touch-manipulation select-none [-webkit-touch-callout:none] disabled:cursor-default";

/**
 * Parmağın (farenin) altında giden kopya. Sayfanın gövdesine açılır: kartın giriş animasyonu
 * (transform) sabit konumlu öğeleri kartın içine hapsederdi.
 */
export function DragGhost({ drag, className, children }: { drag: Drag; className?: string; children: ReactNode }) {
  return createPortal(
    <div
      aria-hidden="true"
      className={cn("pointer-events-none fixed top-0 left-0 z-50 border-2 border-accent bg-card font-bold shadow-floating", className)}
      style={{ width: drag.w, transform: `translate3d(${drag.x - drag.dx}px, ${drag.y - drag.dy}px, 0) rotate(-2deg)` }}
    >
      {children}
    </div>,
    document.body,
  );
}
