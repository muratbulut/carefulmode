"use client";

import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const isReduced = () => typeof window.matchMedia === "function" && window.matchMedia(query).matches;

/** "Hareketi azalt" açık mı? Sunucuda ve ilk çizimde kapalı sayılır; ayar değişince güncellenir. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, isReduced, () => false);
}
