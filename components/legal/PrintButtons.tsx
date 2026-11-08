"use client";

import { Download, Printer } from "lucide-react";
import { useState } from "react";
import { Toast } from "@/components/status/Toast";
import { getMessages } from "@/lib/i18n";

const buttonClass =
  "inline-flex h-[42px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface font-[inherit] text-sm font-bold text-fg transition-colors hover:border-accent";

/**
 * Yazdır ve PDF düğmeleri. PDF ayrı bir dosya olarak üretilmez: tarayıcının yazdırma penceresi
 * açılır, bildirim "PDF olarak kaydet"i seçmeyi söyler. Yazdırırken menüler ve düğmeler gizlenir.
 */
export function PrintButtons() {
  const t = getMessages().legal;
  const [toast, setToast] = useState<string | null>(null);

  function print(message: string) {
    setToast(message);
    // Yazdırma penceresi sayfayı dondurur; önce bildirim görünsün.
    window.setTimeout(() => window.print(), 250);
  }

  return (
    <div className="flex gap-2 print:hidden">
      <button type="button" aria-label={t.print} onClick={() => print(t.printing)} className={`${buttonClass} w-[42px]`}>
        <Printer className="size-[18px] text-fg-2" strokeWidth={2} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => print(t.pdfHint)} className={`${buttonClass} px-3.5`}>
        <Download className="size-4 text-fg-2" strokeWidth={2} aria-hidden="true" />
        {t.pdf}
      </button>
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
