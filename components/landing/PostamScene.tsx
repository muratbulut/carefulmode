import { Check, Flag, Mail, TriangleAlert } from "lucide-react";
import { LogoMark } from "@/lib/brand";
import { getMessages, rich } from "@/lib/i18n";

/**
 * Tanıtım sayfasının sağındaki canlı sahne (Tema H): Postam'da sahte kargo maili,
 * şüpheli işaretler sırayla yanar, "Bildir" basılır, "Oltalama olarak bildirildi" çıkar.
 * Bütün hareket CSS ile; "hareketi azalt" açıksa durağan bir resim gibi kalır.
 * Süs ve anlatım içindir; ekran okuyucuya tek cümlelik bir açıklama verilir.
 */
export function PostamScene() {
  const t = getMessages().landing.scene;
  return (
    <figure className="relative m-0 mx-auto h-[320px] w-full max-w-[358px] lg:h-[440px] lg:max-w-[500px]">
      <figcaption className="sr-only">{t.caption}</figcaption>

      {/* Postam penceresi */}
      <div
        aria-hidden="true"
        className="anim-float-1 absolute top-[18px] left-0 w-[290px] overflow-hidden rounded-[18px] border border-line bg-surface shadow-card lg:top-5 lg:w-[400px] lg:rounded-[20px]"
      >
        <div className="flex items-center justify-between border-b border-card bg-surface-raised px-3.5 py-2.5 lg:px-4 lg:py-3">
          <div className="flex items-center gap-2 font-heading text-sm font-bold text-accent-fg lg:text-[15px] lg:text-fg">
            <Mail className="hidden size-[18px] text-accent lg:block" strokeWidth={2} />
            {t.mailApp}
          </div>
          <div className="text-[11px] text-fg-3 lg:text-xs">{t.inbox}</div>
        </div>
        <div className="relative flex flex-col gap-2.5 p-3.5 lg:gap-3 lg:p-[18px]">
          <div className="anim-scan absolute inset-x-0 h-0.5 bg-[linear-gradient(90deg,transparent,var(--accent),transparent)] shadow-[0_0_14px_var(--accent)]" />
          <div className="flex items-center gap-2.5 lg:gap-3">
            <div className="flex size-[34px] items-center justify-center rounded-full bg-scene-yellow text-sm font-bold text-on-accent lg:size-10 lg:text-base">
              {t.sender.charAt(0)}
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="text-sm font-bold lg:text-[15px]">{t.sender}</div>
              <div className="font-mono text-[11px] text-fg-3 lg:text-xs">
                {rich(t.senderAddress, {
                  flag: (chunk) => <span className="rounded px-1 py-px [animation:flag-1_10s_infinite]">{chunk}</span>,
                })}
              </div>
            </div>
          </div>
          <div className="font-heading text-base font-semibold lg:text-[19px]">{t.subject}</div>
          <div className="text-[13px] leading-normal text-fg-2 lg:text-sm lg:leading-[1.55]">
            {rich(t.body, {
              flag: (chunk) => <span className="rounded px-1 py-px [animation:flag-2_10s_infinite]">{chunk}</span>,
              desktop: (chunk) => <span className="hidden lg:inline">{chunk}</span>,
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:gap-2.5">
            <div className="flex h-8 items-center rounded-[9px] bg-scene-blue px-3 text-[13px] font-bold lg:h-9 lg:rounded-[10px] lg:px-3.5 lg:text-sm">
              <span className="rounded px-1 py-px text-white [animation:flag-3_10s_infinite]">{t.action}</span>
            </div>
            <div className="anim-press flex h-8 items-center gap-1.5 rounded-[9px] bg-danger px-3 text-[13px] font-bold text-on-danger lg:h-9 lg:rounded-[10px] lg:px-3.5 lg:text-sm">
              <Flag className="hidden size-[15px] lg:block" strokeWidth={2.4} />
              {t.report}
            </div>
          </div>
        </div>
        <div className="hidden flex-col gap-2 border-t border-card px-[18px] py-2.5 text-[13px] text-fg-4 lg:flex">
          {t.otherMails.map((mail) => (
            <div key={mail.from} className="flex justify-between">
              <span>{mail.from}</span>
              <span>{mail.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* "3 şüpheli işaret" etiketi */}
      <div
        aria-hidden="true"
        className="anim-label-pop absolute top-0 left-[150px] flex items-center gap-1.5 rounded-[9px] bg-danger px-2.5 py-1.5 text-xs font-bold text-on-danger shadow-[0_10px_24px_var(--shadow-color-soft)] lg:left-[230px] lg:rounded-[10px] lg:px-3 lg:py-2 lg:text-[13px]"
      >
        <TriangleAlert className="hidden size-[15px] lg:block" strokeWidth={2.4} />
        {t.flags}
      </div>

      {/* Doğrulayıcı kartı */}
      <div
        aria-hidden="true"
        className="anim-float-2 absolute right-0 bottom-[34px] flex w-[150px] flex-col gap-1.5 rounded-[14px] border border-line bg-card p-3 shadow-[0_24px_48px_var(--shadow-color)] lg:bottom-[30px] lg:w-[210px] lg:gap-2.5 lg:rounded-[18px] lg:p-4"
      >
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold tracking-[0.5px] text-fg-3 lg:text-xs">{t.authenticator}</div>
          <svg className="size-[18px] -rotate-90 lg:size-[22px]" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="18" fill="none" strokeWidth="4" style={{ stroke: "var(--line)" }} />
            <circle
              className="anim-ring"
              cx="20"
              cy="20"
              r="18"
              fill="none"
              strokeWidth="4"
              strokeDasharray="113"
              strokeLinecap="round"
              style={{ stroke: "var(--accent)" }}
            />
          </svg>
        </div>
        <div className="hidden text-[13px] text-fg-2 lg:block">{t.account}</div>
        <div className="font-mono text-[21px] tracking-[2px] text-accent-fg lg:text-[28px] lg:tracking-[3px]">{t.code}</div>
        <div className="hidden text-xs text-fg-3 lg:block">{t.codeWarning}</div>
      </div>

      {/* Parlayan maskot (sadece masaüstü) */}
      <div
        aria-hidden="true"
        className="anim-glow-pulse absolute top-[30px] right-[30px] hidden size-[76px] items-center justify-center rounded-[22px] border border-accent bg-surface lg:flex"
      >
        <LogoMark className="h-auto w-[52px]" />
      </div>

      {/* "Oltalama olarak bildirildi" */}
      <div
        aria-hidden="true"
        className="anim-toast-slide absolute bottom-0 left-3 flex items-center gap-2 rounded-[10px] border border-success bg-success-subtle px-3 py-2 text-[13px] font-bold text-success-subtle-fg shadow-[0_12px_28px_var(--shadow-color)] lg:left-6 lg:rounded-xl lg:px-3.5 lg:py-2.5 lg:text-sm"
      >
        <Check className="hidden size-4 text-success lg:block" strokeWidth={2.6} />
        {t.reported}
      </div>
    </figure>
  );
}
