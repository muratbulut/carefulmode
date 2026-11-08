"use client";

import { LayoutDashboard, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { signOut } from "@/lib/account/actions";
import { getMessages } from "@/lib/i18n";
import { paths, routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const itemClass =
  "flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-left text-[15px] font-bold text-fg no-underline transition-colors hover:bg-surface-deep";

/** Üst menüdeki avatar düğmesi: açılınca ad, e-posta, Profil, (ekipteyse) Yönetim paneli ve Çıkış yap. */
export function AccountMenu({ name, email, emoji, admin = false }: { name: string; email: string; emoji: string; admin?: boolean }) {
  const t = getMessages().nav;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  // Dışarı tıklayınca (başka bir bağlantıya da) ya da Escape ile kapanır.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={t.accountMenu}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer rounded-full"
      >
        <UserAvatar emoji={emoji} ring className="size-10 text-[22px] lg:size-11 lg:text-2xl" />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute top-[calc(100%+10px)] right-0 z-50 w-[260px] rounded-2xl border border-line bg-surface p-2 shadow-floating anim-pop"
      >
        <div className="flex items-center gap-2.5 border-b border-card px-2 pt-1 pb-3">
          <UserAvatar emoji={emoji} className="size-10 text-[22px]" />
          <span className="flex min-w-0 flex-col">
            <b className="truncate text-[15px]">{name}</b>
            <span className="truncate text-xs text-fg-3">{email}</span>
          </span>
        </div>
        <div className="flex flex-col pt-1.5">
          <Link href={routes.profile} onClick={() => setOpen(false)} className={itemClass}>
            <User className="size-[18px] text-fg-3" strokeWidth={2} aria-hidden="true" />
            {t.links.profile}
          </Link>
          {admin ? (
            <Link href={paths.admin} onClick={() => setOpen(false)} className={itemClass}>
              <LayoutDashboard className="size-[18px] text-fg-3" strokeWidth={2} aria-hidden="true" />
              {t.adminPanel}
            </Link>
          ) : null}
          <form action={signOut}>
            <button type="submit" className={cn(itemClass, "text-danger-fg")}>
              <LogOut className="size-[18px]" strokeWidth={2} aria-hidden="true" />
              {t.signOut}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
