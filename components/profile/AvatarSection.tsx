"use client";

import { User } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { setAvatar } from "@/lib/account/profile-actions";
import { avatars, type AvatarCode } from "@/lib/avatars";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SectionCard } from "./SectionCard";
import { UserAvatar } from "./UserAvatar";

/** Avatar seçimi: 12 hazır avatar, dokununca hemen kaydedilir. */
export function AvatarSection({ current, onDone }: { current: AvatarCode; onDone: (message: string) => void }) {
  const t = getMessages().profile.avatar;
  const [shown, setShown] = useOptimistic(current);
  const [, startTransition] = useTransition();
  const active = avatars.find((a) => a.code === shown) ?? avatars[0];

  function choose(code: AvatarCode) {
    if (code === shown) return;
    startTransition(async () => {
      setShown(code);
      const result = await setAvatar(code);
      if (result.message) onDone(result.message);
    });
  }

  return (
    <SectionCard Icon={User} title={t.title} lead={t.lead}>
      <div className="flex items-center gap-3.5">
        <UserAvatar key={active.code} emoji={active.emoji} ring className="size-16 text-[34px] anim-pop" />
        <div className="flex flex-col gap-0.5">
          <b className="text-base">{format(t.current, { name: t.names[active.code] })}</b>
          <span className="text-[13px] text-fg-3">{t.currentHint}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
        {avatars.map((avatar) => {
          const on = avatar.code === shown;
          return (
            <button
              key={avatar.code}
              type="button"
              aria-pressed={on}
              onClick={() => choose(avatar.code)}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 rounded-[14px] border-2 py-3 transition-[border-color,background-color,transform] duration-200",
                on ? "border-accent bg-accent/14 motion-safe:scale-[1.04]" : "border-line bg-surface-deep hover:border-line-strong",
              )}
            >
              <span aria-hidden="true" className="text-[34px] leading-none">
                {avatar.emoji}
              </span>
              <span className={cn("text-[13px] font-bold", on ? "text-fg" : "text-fg-3")}>{t.names[avatar.code]}</span>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
