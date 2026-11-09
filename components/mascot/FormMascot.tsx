"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Mascot } from "./Mascot";
import { resetGaze, setGaze } from "./useEyeTracking";

/** Gözün yazının sonuna yetiştiği uzunluk; daha uzun e-postada göz sağda kalır. */
const FULL_LENGTH = 28;

const isPassword = (el: HTMLInputElement) => el.type === "password" || /password/.test(el.autocomplete);
const isEmail = (el: HTMLInputElement) => el.type === "email";

/**
 * Giriş ve kayıt formunun üstündeki maskot. E-postayı yazarken gözü yazının ucunu izler, şifre
 * alanına geçince gözünü kapatır; menüdeki logo da kapatır (html data-mascot-eyes="shut").
 * Yazılan metin hiçbir yere alınmaz: göz yalnızca yazının uzunluğuna bakar.
 */
export function FormMascot({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [shut, setShut] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    function follow(input: HTMLInputElement) {
      const share = Math.min(input.value.length, FULL_LENGTH) / FULL_LENGTH;
      setGaze(ref.current, -0.9 + share * 1.8, 0.85);
    }
    function onFocus(e: FocusEvent) {
      const el = e.target;
      if (!(el instanceof HTMLInputElement)) return;
      if (isPassword(el)) {
        setShut(true);
        root.dataset.mascotEyes = "shut";
      } else if (isEmail(el)) follow(el);
    }
    function onBlur(e: FocusEvent) {
      if (!(e.target instanceof HTMLInputElement)) return;
      setShut(false);
      delete root.dataset.mascotEyes;
      resetGaze(ref.current);
    }
    function onInput(e: Event) {
      const el = e.target;
      if (el instanceof HTMLInputElement && isEmail(el)) follow(el);
    }
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    document.addEventListener("input", onInput);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("input", onInput);
      delete root.dataset.mascotEyes;
    };
  }, []);

  return <Mascot ref={ref} mood={shut ? "shut" : "idle"} className={cn("h-auto", className)} />;
}
