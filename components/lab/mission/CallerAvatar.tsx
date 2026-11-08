"use client";

import { useEffect, useRef } from "react";
import type { CallerLook } from "@/lib/lab/content";
import { callerRig } from "./caller-rig";
import { fatherRig } from "./father-rig";

/** Annenin ve babanın parçaları aynı biçimde; babada bıyık (beard) da var. */
type Rig = {
  viewBox: string;
  base: string;
  body: string;
  hair: string;
  nose: string;
  beard?: string;
  lips: Record<keyof typeof callerRig.lips, string>;
  eyes: Record<keyof typeof callerRig.eyes, string>;
  brows: Record<keyof typeof callerRig.brows, string>;
};
const rigs: Record<CallerLook, Rig> = { mother: callerRig, father: fatherRig };

/** Görüntünün kırpması: yuvarlak gelen arama resmi (yüz), belden yukarı (bust) ve görüşmede telefon ekranı (call: baş ortada, omuzlar altta). */
const crops = { face: "470 300 820 820", bust: "330 230 1084 1084", call: "170 150 1400 1400" } as const;

export type CallerMood = "happy" | "worried";

// Konuşurken ağız şekilleri (Ayşegül ve Ayça videolarındaki TALKSET'in sadeleşmişi) ve dinlenen ağız.
const talk: Record<CallerMood, readonly (keyof typeof callerRig.lips)[]> = {
  happy: ["14", "30", "25", "08", "22"],
  worried: ["27", "07", "10", "24"],
};
const rest: Record<CallerMood, keyof typeof callerRig.lips> = { happy: "22", worried: "24" };
const brows: Record<CallerMood, keyof typeof callerRig.brows> = { happy: "12", worried: "13" };

/** Kararlı sözde rastgele: aynı karede hep aynı ağız. */
function hash(n: number) {
  n = (n ^ 61) ^ (n >>> 16);
  n = n + (n << 3);
  n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d);
  return (n ^ (n >>> 15)) >>> 0;
}

/**
 * Arayan velinin çizimi (Notionists). Konuşurken ağzı oynar, ara ara göz kırpar, başı hafifçe
 * sallanır. Çizim parçaları sabit SVG'dir (caller-rig.ts); hareket her karede yalnızca ağız, göz ve
 * başın dönüşünü değiştirir. "Hareketi azalt" açıksa hiç oynamaz, dinlenen yüzüyle durur.
 */
export function CallerAvatar({
  talking,
  look = "mother",
  mood = "happy",
  crop = "bust",
  className,
}: {
  talking: boolean;
  look?: CallerLook;
  mood?: CallerMood;
  crop?: keyof typeof crops;
  className?: string;
}) {
  const rig = rigs[look];
  const head = useRef<SVGGElement>(null);
  const face = useRef<SVGGElement>(null);
  const lips = useRef<SVGGElement>(null);
  const eyes = useRef<SVGGElement>(null);
  const shown = useRef({ lips: rest[mood] as string, eyes: "05" });

  useEffect(() => {
    const set = (el: SVGGElement | null, key: "lips" | "eyes", value: string) => {
      if (!el || shown.current[key] === value) return;
      shown.current[key] = value;
      el.innerHTML = key === "lips" ? rig.lips[value as keyof typeof rig.lips] : rig.eyes[value as keyof typeof rig.eyes];
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      set(lips.current, "lips", rest[mood]);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const t = (now - start) / 1000;
      const shapes = talk[mood];
      set(lips.current, "lips", talking ? shapes[hash(Math.floor(t * 9)) % shapes.length] : rest[mood]);
      // Her 3,4 saniyede bir 0,12 saniyelik göz kırpma.
      set(eyes.current, "eyes", t % 3.4 > 3.28 ? "03" : "05");
      const tilt = Math.sin(t * 1.3) * 1.4 + (talking ? Math.sin(t * 8.5) * 1.6 : 0) + (mood === "worried" ? -2 : 1);
      const lift = talking ? Math.abs(Math.sin(t * 4.2)) * 6 : 0;
      const transform = `translate(0 ${lift.toFixed(1)}) rotate(${tilt.toFixed(2)} 870 1060)`;
      head.current?.setAttribute("transform", transform);
      face.current?.setAttribute("transform", transform);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [talking, mood, rig]);

  return (
    <svg viewBox={crops[crop]} fill="none" aria-hidden="true" className={className}>
      {/* Notionists sırası: baş, gövde (yaka boynun üstünde), sonra saç ve yüz. */}
      <g ref={face} dangerouslySetInnerHTML={{ __html: rig.base }} />
      <g dangerouslySetInnerHTML={{ __html: rig.body }} />
      <g ref={head}>
        <g dangerouslySetInnerHTML={{ __html: rig.hair }} />
        <g ref={lips} dangerouslySetInnerHTML={{ __html: rig.lips[rest[mood]] }} />
        {rig.beard ? <g dangerouslySetInnerHTML={{ __html: rig.beard }} /> : null}
        <g dangerouslySetInnerHTML={{ __html: rig.nose }} />
        <g ref={eyes} dangerouslySetInnerHTML={{ __html: rig.eyes["05"] }} />
        <g dangerouslySetInnerHTML={{ __html: rig.brows[brows[mood]] }} />
      </g>
    </svg>
  );
}
