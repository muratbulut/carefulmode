"use client";

import { Moon, Sun } from "lucide-react";
import { useLayoutEffect } from "react";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DEFAULT_THEME, isTheme, otherTheme, themeFromCookie } from "@/lib/theme";
import { applyTheme, saveTheme } from "./theme-client";

/**
 * Header'ın sağındaki tek tema düğmesi. İki ikon ve iki etiket de çizilir; hangisinin
 * görüneceğini <html data-theme> belirler. Böylece sunucu çıktısı temadan bağımsız kalır.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = getMessages();
  // Geliştirmede React Strict Mode <html> niteliklerini sıfırlayabilir; çerezden tekrar uygula.
  useLayoutEffect(() => {
    const theme = themeFromCookie(document.cookie);
    if (theme) applyTheme(theme);
  }, []);

  function toggle() {
    const current = document.documentElement.getAttribute("data-theme");
    saveTheme(otherTheme(isTheme(current) ? current : DEFAULT_THEME));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      data-testid="theme-toggle"
      className={cn(
        "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface transition-colors hover:border-accent",
        className,
      )}
    >
      <span className="theme-dark-only">
        <Sun className="size-5 text-warning" strokeWidth={2} aria-hidden="true" />
        <span className="sr-only">{t.theme.toGray}</span>
      </span>
      <span className="theme-gray-only">
        <Moon className="size-5 text-fg-2" strokeWidth={2} aria-hidden="true" />
        <span className="sr-only">{t.theme.toDark}</span>
      </span>
    </button>
  );
}
