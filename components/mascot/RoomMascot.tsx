"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Mascot, type MascotMood } from "./Mascot";
import { gazeTowards, resetGaze, setGaze } from "./useEyeTracking";

/** Sahnedeki bir bağlantının üstüne gelinince gönderilen olay; detail bağlantı öğesi ya da null. */
export const LOOK_EVENT = "mascot:look";

/** Bağlantıya bak / bakmayı bırak (sahnelerdeki useLinkPeek çağırır). */
export function lookAt(el: Element | null) {
  window.dispatchEvent(new CustomEvent<Element | null>(LOOK_EVENT, { detail: el }));
}

/**
 * Oda oynatıcısının şeridindeki maskot. Sahnede bir bağlantının üstüne gelinince göz ona döner ve
 * dikkatle bakar; tuzak da olsa güvenli de olsa aynı bakar, çünkü hangisinin tuzak olduğu tarayıcıya
 * hiç gönderilmez. Duygular (şüpheli, hacklendi) oynatıcıdan, sunucunun cevabından sonra gelir.
 */
export function RoomMascot({ mood = "idle", className }: { mood?: MascotMood; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    function onLook(e: Event) {
      const target = (e as CustomEvent<Element | null>).detail;
      const el = ref.current;
      // Telefonda şerit maskotu gizli olabilir; görünmüyorsa bakış yok.
      if (!el || el.getBoundingClientRect().width === 0) return;
      if (!target) {
        setLooking(false);
        resetGaze(el);
        return;
      }
      const box = target.getBoundingClientRect();
      const { x, y } = gazeTowards(el, box.left + box.width / 2, box.top + box.height / 2, 120);
      setGaze(el, x, y);
      setLooking(true);
    }
    window.addEventListener(LOOK_EVENT, onLook);
    return () => window.removeEventListener(LOOK_EVENT, onLook);
  }, []);

  const shown = mood === "idle" && looking ? "look" : mood;
  return <Mascot ref={ref} mood={shown} className={cn("h-auto flex-none", className)} />;
}
