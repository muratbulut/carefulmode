"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

const selectedItem = '[aria-selected="true"], [aria-current]:not([aria-current="false"]), [aria-pressed="true"]';

/**
 * Yana kaydırılan şeritte (telefondaki sekmeler, süzgeç çipleri) seçili öğeyi tam görünür yapar:
 * adresle gelen ya da kendiliğinden değişen seçim ekranın dışında kalmasın. Yalnızca şerit
 * kaydırılır, sayfa kaydırılmaz; kaydırma anlıktır ("Hareketi azalt" açıkken de sorun olmaz).
 * `key` değişince yeniden bakar.
 */
export function useRevealSelected<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const strip = ref.current;
    if (!strip || strip.scrollWidth <= strip.clientWidth) return;
    const item = strip.querySelector<HTMLElement>(selectedItem);
    if (!item) return;
    const box = strip.getBoundingClientRect();
    const style = getComputedStyle(strip);
    const left = box.left + strip.clientLeft + (parseFloat(style.paddingLeft) || 0);
    const right = box.left + strip.clientLeft + strip.clientWidth - (parseFloat(style.paddingRight) || 0);
    const r = item.getBoundingClientRect();
    if (r.left < left) strip.scrollLeft -= left - r.left;
    else if (r.right > right) strip.scrollLeft += Math.min(r.right - right, r.left - left);
  }, [key]);
  return ref;
}

/** Sunucu bileşenlerinin şeridi için: `useRevealSelected` ile aynı, `selected` seçili öğenin anahtarı. */
export function ScrollStrip({ selected, ...props }: ComponentPropsWithoutRef<"div"> & { selected?: string }) {
  const ref = useRevealSelected<HTMLDivElement>(selected);
  return <div ref={ref} {...props} />;
}
