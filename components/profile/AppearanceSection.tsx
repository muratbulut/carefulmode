"use client";

import { Check, Moon, Sun } from "lucide-react";
import { saveTheme, useTheme } from "@/components/theme/theme-client";
import { getMessages } from "@/lib/i18n";
import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { SectionCard } from "./SectionCard";

/**
 * Tema seçimi (koyu / gri). Önizlemeler kendi temalarıyla çizilir: data-theme verilen kutuda
 * renk değişkenleri o temanınkine döner.
 */
export function AppearanceSection({ onDone }: { onDone: (message: string) => void }) {
  const t = getMessages().profile.appearance;
  const theme = useTheme();
  const options: { value: Theme; label: string; hint: string; Icon: typeof Moon }[] = [
    { value: "dark", label: t.dark, hint: t.darkHint, Icon: Moon },
    { value: "gray", label: t.gray, hint: t.grayHint, Icon: Sun },
  ];

  return (
    <SectionCard Icon={Moon} tone="violet" title={t.title} lead={t.lead}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map(({ value, label, hint, Icon }) => {
          const on = theme === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => {
                if (on) return;
                saveTheme(value);
                onDone(t.changed);
              }}
              className={cn(
                "flex cursor-pointer flex-col gap-2.5 rounded-2xl border-2 p-3 text-left transition-colors",
                on ? "border-accent" : "border-line hover:border-line-strong",
              )}
            >
              <span data-theme={value} aria-hidden="true" className="flex h-20 gap-2.5 rounded-xl bg-canvas p-2.5">
                <span className="w-[30%] rounded-lg bg-card" />
                <span className="flex flex-1 flex-col gap-2 pt-1">
                  <span className="h-1.5 w-[70%] rounded-full bg-line" />
                  <span className="h-2 w-[45%] rounded-full bg-accent" />
                </span>
              </span>
              <span className="flex items-center gap-2 px-1">
                <Icon className="size-4 text-fg-2" strokeWidth={2} aria-hidden="true" />
                <b className="flex-1 text-[15px]">{label}</b>
                {on ? <Check className="size-4 text-accent-fg" strokeWidth={2.6} aria-hidden="true" /> : null}
              </span>
              <span className="px-1 text-[13px] text-fg-3">{hint}</span>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
