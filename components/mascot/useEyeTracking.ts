"use client";

import { useEffect, type RefObject } from "react";

/** Bakış yönünü maskotun köküne yazar (-1 ile 1 arası). Göz bebeği CSS'te bu değişkenlerle kayar. */
export function setGaze(el: Element | null, x: number, y: number) {
  if (!(el instanceof SVGElement)) return;
  el.style.setProperty("--mc-x", x.toFixed(2));
  el.style.setProperty("--mc-y", y.toFixed(2));
}

/** Varsayılan bakış: biraz sağa (logodaki hâli). */
export function resetGaze(el: Element | null) {
  if (!(el instanceof SVGElement)) return;
  el.style.removeProperty("--mc-x");
  el.style.removeProperty("--mc-y");
}

/** Gözün bir noktaya bakması için yön: maskotun göz topundan (kutunun %70'i) o noktaya. */
export function gazeTowards(el: Element, px: number, py: number, near = 260) {
  const box = el.getBoundingClientRect();
  const cx = box.left + box.width * (90 / 128);
  const cy = box.top + box.height / 2;
  const dx = px - cx;
  const dy = py - cy;
  const d = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, d / near);
  return { x: (dx / d) * k, y: (dy / d) * k };
}

/**
 * Göz fareyi izler. Yalnızca fare olan cihazda ve "Hareketi azalt" kapalıyken; telefonda ve tablette
 * maskot yalnızca kırpar. Her harekette yeniden çizim olmaz: değer doğrudan SVG'ye yazılır.
 */
export function useEyeTracking(ref: RefObject<SVGSVGElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window.matchMedia !== "function") return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let last: PointerEvent | null = null;

    function apply() {
      frame = 0;
      const el = ref.current;
      if (!el || !last || !fine.matches || reduced.matches) return;
      const { x, y } = gazeTowards(el, last.clientX, last.clientY);
      setGaze(el, x, y);
    }
    function onMove(e: PointerEvent) {
      if (e.pointerType !== "mouse") return;
      last = e;
      if (!frame) frame = window.requestAnimationFrame(apply);
    }
    function onLeave() {
      resetGaze(ref.current);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ref, enabled]);
}
