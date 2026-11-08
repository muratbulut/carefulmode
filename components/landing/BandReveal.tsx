"use client";

import { useEffect } from "react";

/**
 * Tanıtım sayfasında ekranın altındaki bantları gizler, ekrana girince aşağıdan belirtir
 * (globals.css, landing-band). Betik çalışmazsa hiçbir şey gizlenmez; "Hareketi azalt" açıksa
 * CSS gizlemez, bant olduğu gibi görünür.
 */
export function BandReveal() {
  useEffect(() => {
    const bands = Array.from(document.querySelectorAll<HTMLElement>(".landing-band"));
    const below = bands.filter((band) => band.getBoundingClientRect().top >= window.innerHeight);
    if (below.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.reveal = "shown";
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15 },
    );
    for (const band of below) {
      band.dataset.reveal = "hidden";
      observer.observe(band);
    }
    return () => {
      observer.disconnect();
      for (const band of below) delete band.dataset.reveal;
    };
  }, []);
  return null;
}
