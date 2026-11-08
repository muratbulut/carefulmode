"use client";

import { useEffect, useState } from "react";
import type { Deadline } from "@/lib/account/shared";

/** Geri sayım: bitişe kalan saniye (bitince 0). Saniyede birkaç kez güncellenir. */
export function useSecondsLeft(deadline: Deadline | undefined) {
  // Başlangıçta 0: kalan süre bitişten ve başlangıç anından hesaplanır (statik sayfada saat okunmaz).
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (!deadline) return 0;
  return Math.max(0, Math.ceil((deadline.until - Math.max(now, deadline.from)) / 1000));
}
