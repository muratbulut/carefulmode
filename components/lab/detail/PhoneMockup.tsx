import { MessageCircle } from "lucide-react";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { LabDetailData } from "./types";

/** Kurgusal uygulamanın küçük ikonu: Postam (turuncu zarf) ya da Mesajlar. */
export function AppIcon({ template, className }: { template: LabDetailData["template"]; className?: string }) {
  if (template === "MESSAGING") {
    return (
      <span aria-hidden="true" className={cn("flex size-[18px] flex-none items-center justify-center rounded-[5px] bg-scene-green", className)}>
        <MessageCircle className="size-[70%] text-scene-white" strokeWidth={2.6} />
      </span>
    );
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-[18px] flex-none", className)}>
      <rect width="32" height="32" rx="9" className="fill-scene-orange" />
      <rect x="6.5" y="9.5" width="19" height="14" rx="3" fill="none" strokeWidth="2.4" className="stroke-scene-white" />
      <path d="M7.5 11l8.5 6.2 8.5-6.2" fill="none" strokeWidth="2.4" strokeLinejoin="round" className="stroke-scene-white" />
      <circle cx="24.5" cy="9" r="4.2" strokeWidth="1.6" className="fill-scene-yellow stroke-scene-orange" />
    </svg>
  );
}

/** "Postam ile" etiketi. */
export function AppPill({ template, className }: { template: LabDetailData["template"]; className?: string }) {
  const t = getMessages().lab.detail;
  return (
    <span
      className={cn(
        "inline-flex h-[34px] items-center gap-1.5 rounded-full bg-scene-white/95 px-3 text-sm font-bold text-scene-ink shadow-floating",
        className,
      )}
    >
      <AppIcon template={template} className="size-5" />
      {t.phoneWith[template]}
    </span>
  );
}

/**
 * Lab detayının sağındaki telefon (Lab-Detay): kilit ekranı ve labdaki ilk iki bildirim. Yalnızca
 * gönderen ve konu görünür; hangisinin sahte olduğu bilgisi buraya hiç gelmez.
 */
export function PhoneMockup({ data, pill = true, className }: { data: LabDetailData; pill?: boolean; className?: string }) {
  const t = getMessages().lab.detail;
  const [first, second] = data.phone.notifications;
  return (
    <div className={cn("relative", className)}>
      <div
        role="img"
        aria-label={format(t.phoneLabel, { app: t.phoneApp[data.template] })}
        className="relative h-[430px] w-[230px] -rotate-2 overflow-hidden rounded-[36px] border-[7px] border-scene-phone-edge bg-scene-ink shadow-card anim-buzz"
      >
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_30%_0%,var(--scene-lock-1)_0%,var(--scene-lock-2)_55%,var(--scene-lock-3)_100%)]" />
        <div className="absolute top-2.5 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-scene-ink" />
        <div className="relative flex flex-col items-center gap-0.5 px-3 pt-[46px] text-scene-white">
          <span className="text-[13px] opacity-85">{data.phone.date}</span>
          <span className="text-[54px] leading-none font-bold tracking-[-1px]">{data.phone.time}</span>
        </div>
        <div className="absolute inset-x-2.5 top-[150px] flex flex-col gap-2">
          {first ? (
            <div className="rounded-2xl bg-scene-white/92 p-2.5 text-scene-ink shadow-floating anim-notification">
              <div className="flex items-center gap-1.5 text-[11px] text-scene-ink-muted">
                <AppIcon template={data.template} />
                <b className="text-scene-ink">{t.phoneApp[data.template]}</b>
                <span className="ml-auto">{t.now}</span>
              </div>
              <div className="mt-1 text-[13px] font-bold">{first.sender}</div>
              <div className="line-clamp-2 text-xs leading-[1.35] text-scene-ink-2">{first.text}</div>
            </div>
          ) : null}
          {second ? (
            <div className="rounded-[14px] bg-scene-white/55 px-2.5 py-[9px] text-[11px] text-scene-ink-2">
              <div className="flex items-center gap-1.5">
                <AppIcon template={data.template} className="size-3.5" />
                <b>{t.phoneApp[data.template]}</b>
                {second.time ? <span className="ml-auto">{second.time}</span> : null}
              </div>
              <div className="mt-0.5 truncate">{format(t.notificationLine, { sender: second.sender, text: second.text })}</div>
            </div>
          ) : null}
        </div>
      </div>
      {pill ? <AppPill template={data.template} className="absolute top-[26px] -right-[34px] rotate-3" /> : null}
    </div>
  );
}
