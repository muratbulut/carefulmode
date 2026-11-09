"use client";

import Link from "next/link";
import { Check, UserPlus, X } from "lucide-react";
import { useId } from "react";
import { Dialog } from "@/components/profile/Dialog";
import { withNext } from "@/lib/account/shared";
import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { NeighborhoodIcon } from "./NeighborhoodIcon";

export type SignUpTarget = { name: string; href: string; icon: string; color: string };

/**
 * Ziyaretçi bir laba başlamak isteyince açılan pencere (Yol-Haritasi-Ziyaretci, Lablar-Ziyaretci):
 * "Ücretsiz hesabını aç". Kayıt ve giriş, bitince bu laba döner.
 */
export function SignUpDialog({ target, onClose }: { target: SignUpTarget | null; onClose: () => void }) {
  const t = getMessages();
  const d = t.roadmap.signUpDialog;
  const titleId = useId();
  return (
    <Dialog open={target !== null} onClose={onClose} labelledBy={titleId} className="relative">
      {target ? (
        <>
          <button
            type="button"
            onClick={onClose}
            aria-label={d.close}
            className="absolute top-3 right-3 flex size-11 cursor-pointer items-center justify-center rounded-xl text-fg-3 hover:bg-card hover:text-fg"
          >
            <X className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
          </button>
          <span className="flex size-14 items-center justify-center rounded-2xl bg-accent/12">
            <UserPlus className="size-[26px] text-accent-fg" strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1.5">
            <p className="m-0 text-[13px] font-bold text-fg-3">{d.kicker}</p>
            <h2 id={titleId} className="m-0 font-heading text-2xl leading-tight font-bold">
              {d.title}
            </h2>
          </div>
          <div className="flex items-center gap-2.5 rounded-[14px] border border-card bg-surface-deep px-3.5 py-3 font-bold">
            <NeighborhoodIcon icon={target.icon} color={target.color} className="size-8 rounded-lg" iconClassName="size-[18px]" />
            {target.name}
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {d.perks.map((perk) => (
              <li key={perk} className="flex items-center gap-2.5 text-[15px] text-fg-2">
                <Check className="size-4 flex-none text-success-fg" strokeWidth={2.4} aria-hidden="true" />
                {perk}
              </li>
            ))}
          </ul>
          <Link
            href={withNext(routes.signUp, target.href)}
            className="flex h-[52px] w-full items-center justify-center rounded-xl bg-accent text-[17px] font-bold text-on-accent no-underline transition-[filter] hover:brightness-110"
          >
            {t.nav.links.signUp}
          </Link>
          <p className="m-0 text-center text-[15px] text-fg-3">
            {d.haveAccount}{" "}
            <Link href={withNext(routes.signIn, target.href)} className="font-bold">
              {t.nav.links.signIn}
            </Link>
          </p>
        </>
      ) : null}
    </Dialog>
  );
}
