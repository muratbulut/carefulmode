"use client";

import { ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { Dialog } from "@/components/profile/Dialog";
import { brand } from "@/lib/brand";
import { format, getMessages } from "@/lib/i18n";
import { isGovernmentHost, sourceParts } from "@/lib/news/content";
import { cn } from "@/lib/utils";

/**
 * "Kaynağa git": bağlantı hemen açılmaz, önce "... sitesinden ayrılıyorsun" penceresi çıkar
 * (Gundem-Detay-H2-Yan; telefonda alttan açılan kart). Adresin tamamı gösterilir, alan adı
 * vurgulanır. Yalnızca güvenilir listedeki https adres çizilir (sunucu denetler, burada da
 * yeniden denetlenir); yeni sekmede, geldiği sayfayı bildirmeden açılır.
 */
export function LeaveSiteButton({ href, className }: { href: string; className?: string }) {
  const t = getMessages().news;
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const parts = sourceParts(href);
  if (!parts) return null;
  const url = `${parts.scheme}${parts.host}${parts.rest}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("-my-2.5 inline-flex min-h-10 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-bold text-accent-fg hover:underline", className)}
      >
        {t.article.goToSource}
        <ExternalLink className="size-4" strokeWidth={2} aria-hidden="true" />
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        labelledBy={titleId}
        className="max-w-[480px] max-sm:mt-auto max-sm:mb-0 max-sm:w-full max-sm:max-w-full max-sm:rounded-b-none"
      >
        <span className="flex size-[52px] items-center justify-center rounded-2xl bg-warning/14">
          <TriangleAlert className="size-6 text-warning-fg" strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 id={titleId} className="m-0 font-heading text-[23px] leading-tight font-bold">
            {format(t.leave.title, { brand: brand.name })}
          </h2>
          <p className="m-0 text-[15px] leading-normal text-fg-2">{t.leave.text}</p>
        </div>
        <p className="m-0 rounded-xl border border-line bg-canvas px-3.5 py-3 font-mono text-sm leading-normal break-all text-fg-2">
          <span className="sr-only">{t.leave.address}</span>
          {parts.scheme}
          <b className="text-success-fg">{parts.host}</b>
          {parts.rest}
        </p>
        <p className="m-0 flex items-start gap-2 text-[13px] leading-normal text-fg-3">
          <ShieldCheck className="mt-px size-4 flex-none text-success-fg" strokeWidth={2} aria-hidden="true" />
          <span>
            {isGovernmentHost(parts.host.toLowerCase()) ? `${t.leave.gov} ` : null}
            {format(t.leave.checked, { brand: brand.name })}
          </span>
        </p>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-12 flex-1 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-deep text-[15px] font-bold text-fg"
          >
            {t.leave.cancel}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            referrerPolicy="no-referrer"
            onClick={() => setOpen(false)}
            className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent text-[15px] font-bold text-on-accent no-underline transition-[filter] hover:brightness-110"
          >
            {t.leave.go}
            <ExternalLink className="size-4" strokeWidth={2.2} aria-hidden="true" />
            <span className="sr-only">{t.leave.newTab}</span>
          </a>
        </div>
      </Dialog>
    </>
  );
}
