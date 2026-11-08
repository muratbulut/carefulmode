"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getMessages } from "@/lib/i18n";
import { Mascot } from "./Mascot";

/** Sayfa bundan hızlı açılırsa yükleniyor hiç görünmez; her tıklamada yanıp sönmesin. */
export const SHOW_AFTER_MS = 300;
/** Bir şey ters giderse örtü en geç bu kadar sonra kalkar. */
const GIVE_UP_MS = 15_000;
/** Çıkışta maskot kapanıp uyusun diye örtü en az bu kadar durur (ana sayfadan çıkışta adres değişmez). */
const SIGN_OUT_MS = 2_400;
/** Çıkış düğmesi bu olayı gönderir (AccountMenu). */
export const SIGN_OUT_EVENT = "mascot:sign-out";

const mascotClass = "h-auto w-[88px] lg:w-[104px]";

/** Çıkış: maskot önce uyanık görünür, bir kare sonra kapanıp uyur (geçiş ancak böyle oynar). */
function FallAsleep() {
  const [asleep, setAsleep] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setAsleep(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return <Mascot mood={asleep ? "out" : "idle"} className={mascotClass} />;
}

/** Adresin yol ve sorgu kısmı (usePathname + useSearchParams ile aynı biçimde). */
const currentAddress = () => window.location.pathname + window.location.search;

type Cover = { kind: "loading" | "out"; from: string };

/** Tıklanan bağlantı bu sitede başka bir sayfaya mı gidiyor? */
function internalTarget(e: MouseEvent): URL | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
  if (!(link instanceof HTMLAnchorElement)) return null;
  if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return null;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
  return url;
}

/**
 * Tam ekran yükleniyor (maskot tuvali, "Sayfa geçişi"): bağlantıya tıklanınca sayfa 0,3 saniyede
 * açılmadıysa ortada küçük düğme gider gelir, yazı yok (ekran okuyucuya "Sayfa açılıyor").
 * Çıkışta aynı örtüde düğme kapanır ve maskot uyur. Yeni sayfa gelince (adres değişince) kalkar.
 * useSearchParams yüzünden kök yerleşimde <Suspense> içinde durur (statik kabukta örtü yok).
 */
export function PageOverlay() {
  const t = getMessages().mascot;
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = search ? `${pathname}?${search}` : pathname;
  const [cover, setCover] = useState<Cover | null>(null);

  useEffect(() => {
    let waiting: number | null = null;
    let giveUp: number | null = null;
    const clear = () => {
      if (waiting !== null) window.clearTimeout(waiting);
      if (giveUp !== null) window.clearTimeout(giveUp);
      waiting = giveUp = null;
    };
    function onClick(e: MouseEvent) {
      if (!internalTarget(e)) return;
      clear();
      const from = currentAddress();
      waiting = window.setTimeout(() => {
        // Sayfa bu arada açıldıysa örtüye gerek yok.
        if (currentAddress() !== from) return;
        setCover({ kind: "loading", from });
        giveUp = window.setTimeout(() => setCover(null), GIVE_UP_MS);
      }, SHOW_AFTER_MS);
    }
    function onSignOut() {
      clear();
      setCover({ kind: "out", from: currentAddress() });
      giveUp = window.setTimeout(() => setCover(null), SIGN_OUT_MS);
    }
    document.addEventListener("click", onClick);
    window.addEventListener(SIGN_OUT_EVENT, onSignOut);
    return () => {
      clear();
      document.removeEventListener("click", onClick);
      window.removeEventListener(SIGN_OUT_EVENT, onSignOut);
    };
  }, []);

  // Adres değişti: yeni sayfa geldi, örtü kendiliğinden kalkar (çıkışta süre dolunca).
  const visible = cover !== null && (cover.kind === "out" || cover.from === here);
  if (!visible) return null;
  return (
    <div role="status" data-testid="page-overlay" className="mc-overlay fixed inset-0 z-[100] flex items-center justify-center bg-canvas print:hidden">
      {cover.kind === "out" ? <FallAsleep /> : <Mascot mood="loading" className={mascotClass} />}
      <span className="sr-only">{cover.kind === "out" ? t.signingOut : t.pageLoading}</span>
    </div>
  );
}
