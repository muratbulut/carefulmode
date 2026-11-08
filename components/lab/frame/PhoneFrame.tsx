"use client";

import { BatteryFull, Signal, Wifi } from "lucide-react";
import type { ReactNode } from "react";
import { getMessages } from "@/lib/i18n";

/**
 * Masaüstünde sahneyi bir telefonun içinde açar (satış görevli oda, Murat 2 Kasım: Mesajlar Postam'a
 * benzemesin, öğrenci telefonundaki uygulamalara bakıyormuş gibi olsun). Çerçeve, yan tuşlar, durum
 * çubuğu ve ana ekran çizgisi yalnızca masaüstünde görünür; telefonda sahne zaten tam ekrandır.
 * İçerideki sahne `data-device="phone"` ile her ekran genişliğinde telefon düzeninde kalır
 * (`desk`/`wide` kırılımları, globals.css).
 */
export function PhoneFrame({ children, inert }: { children: ReactNode; inert?: boolean }) {
  const t = getMessages().lab.call;
  const key = "absolute hidden w-1 bg-call-phone-edge lg:block";
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:h-[var(--lab-height)] lg:items-center lg:justify-center" data-testid="phone-frame">
      <div className="relative flex min-h-0 w-full flex-1 flex-col lg:h-full lg:w-[392px] lg:flex-none">
        {/* Yan tuşlar: solda sessiz ve ses, sağda güç. */}
        <span aria-hidden="true" className={`${key} top-[110px] -left-[5px] h-7 rounded-l-sm`} />
        <span aria-hidden="true" className={`${key} top-[160px] -left-[5px] h-14 rounded-l-sm`} />
        <span aria-hidden="true" className={`${key} top-[230px] -left-[5px] h-14 rounded-l-sm`} />
        <span aria-hidden="true" className={`${key} top-[190px] -right-[5px] h-20 rounded-r-sm`} />
        <div
          inert={inert}
          data-device="phone"
          className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-scene-white lg:h-full lg:rounded-[48px] lg:border-[10px] lg:border-call-phone lg:shadow-[0_0_0_2px_var(--call-phone-edge),0_30px_70px_rgb(0_0_0/0.5)]"
        >
          <div aria-hidden="true" className="relative hidden h-9 flex-none items-center justify-between bg-scene-paper px-7 text-[13px] font-bold text-scene-ink lg:flex">
            <span>{t.time}</span>
            <span className="absolute top-2 left-1/2 h-[22px] w-[88px] -translate-x-1/2 rounded-full bg-call-phone" />
            <span className="flex items-center gap-1">
              <Signal className="size-3.5" strokeWidth={2.6} />
              <Wifi className="size-3.5" strokeWidth={2.6} />
              <BatteryFull className="size-4" strokeWidth={2.2} />
            </span>
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
          <div aria-hidden="true" className="hidden h-5 flex-none items-center justify-center bg-scene-white lg:flex">
            <span className="h-1 w-28 rounded-full bg-scene-ink" />
          </div>
        </div>
      </div>
    </div>
  );
}
