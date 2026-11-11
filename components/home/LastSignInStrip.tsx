"use client";

import { History, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { markSignInNoticeSeen } from "@/lib/account/sign-in-notice";
import { format, getMessages, rich } from "@/lib/i18n";
import { paths } from "@/lib/navigation";

/**
 * Girişten sonra ana sayfanın üstünde bir kez görünen "Son girişin" şeridi (hoca öncesi kontrol, 23).
 * Açılınca sunucuya "görüldü" der; "Ben değildim" profildeki Güvenlik bölümüne (şifre değiştir) götürür.
 */
export function LastSignInStrip({ when }: { when: string }) {
  const t = getMessages().home.lastSignIn;
  const [open, setOpen] = useState(true);

  useEffect(() => {
    markSignInNoticeSeen().catch(() => {});
  }, []);

  if (!open) return null;
  return (
    <div
      role="status"
      data-testid="last-sign-in"
      className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-sm leading-normal text-fg-2 anim-pop lg:px-5"
    >
      <History className="size-[18px] flex-none text-accent-light" strokeWidth={2.2} aria-hidden="true" />
      <p className="m-0 min-w-0 flex-1">
        {rich(format(t.text, { when }), { b: (chunk) => <b className="text-fg">{chunk}</b> })}
        <span className="sr-only"> {t.notMeHint}</span>
      </p>
      <Link
        href={paths.profileSection("security")}
        className="flex min-h-10 flex-none items-center rounded-xl px-2 font-bold text-accent-fg no-underline hover:underline"
      >
        {t.notMe}
      </Link>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label={t.close}
        className="-mr-1.5 flex size-10 flex-none cursor-pointer items-center justify-center rounded-xl text-fg-3 hover:text-fg"
      >
        <X className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
      </button>
    </div>
  );
}
