"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_THEME, THEME_COLOR, isTheme, themeCookie, type Theme } from "@/lib/theme";

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

/** Temayı uygular ve tercihi çereze yazar (üst menüdeki düğme ve profildeki Görünüm). */
export function saveTheme(theme: Theme) {
  applyTheme(theme);
  document.cookie = themeCookie(theme, location.protocol === "https:");
}

function readTheme(): Theme {
  const value = document.documentElement.getAttribute("data-theme");
  return isTheme(value) ? value : DEFAULT_THEME;
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** Şu anki tema; başka bir yerden (ör. üst menü) değişince de güncellenir. Sunucuda varsayılan. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
}
