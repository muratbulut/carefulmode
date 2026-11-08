"use client";

import { Copy, Link2 } from "lucide-react";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Bağlantıyı panoya kopyalar; tarayıcı izin vermezse false. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Başlıktaki "Öğretmen davet bağlantısı" düğmesi (masaüstü): bağlantıyı kopyalar. */
export function InviteButton({ onCopy, className }: { onCopy: () => void; className?: string }) {
  const t = getMessages().school;
  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "inline-flex h-12 flex-none cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-4 font-[inherit] text-[15px] font-bold text-fg transition-colors hover:border-accent",
        className,
      )}
    >
      <Link2 className="size-[18px] text-accent-fg" strokeWidth={2} aria-hidden="true" />
      {t.inviteButton}
    </button>
  );
}

/**
 * "Öğretmenleri davet et": okulun davet bağlantısı (profildeki Öğretmenlik formu okulu seçili açar)
 * ve kopyala düğmesi. Bağlantıda yalnızca okulun kimliği vardır.
 */
export function InviteCard({ url, onCopy }: { url: string; onCopy: () => void }) {
  const t = getMessages().school.invite;
  return (
    <section aria-labelledby="school-invite" className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-4 lg:p-5 print:hidden">
      <h2 id="school-invite" className="m-0 text-base font-bold">
        {t.title}
      </h2>
      <p className="m-0 text-[13px] leading-normal text-fg-2">{t.text}</p>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-deep py-2.5 pr-2.5 pl-3">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-3">
          {url}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="relative inline-flex h-[34px] flex-none cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-accent px-2.5 font-[inherit] text-[13px] font-bold text-on-accent after:absolute after:-inset-y-[3px] after:inset-x-0"
        >
          <Copy className="size-3.5" strokeWidth={2} aria-hidden="true" />
          {t.copy}
        </button>
      </div>
    </section>
  );
}
