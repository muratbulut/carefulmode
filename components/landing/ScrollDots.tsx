"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Yana kayan kart listesinin altındaki noktalar; görünen kartı gösterir. Süs içindir. */
export function ScrollDots({ target, count, className }: { target: string; count: number; className?: string }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const list = document.getElementById(target);
    if (!list) return;
    const cards = Array.from(list.querySelectorAll<HTMLElement>("[data-step]"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(cards.indexOf(entry.target as HTMLElement));
        }
      },
      { root: list, threshold: 0.6 },
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [target]);

  return (
    <div aria-hidden="true" className={cn("flex justify-center gap-1.5", className)}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn("h-1.5 rounded-full transition-[width,background-color]", i === active ? "w-5 bg-logo" : "w-1.5 bg-line")}
        />
      ))}
    </div>
  );
}
