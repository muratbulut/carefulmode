import { AlertTriangle, Lightbulb } from "lucide-react";
import { brand } from "@/lib/brand";
import { format, getMessages } from "@/lib/i18n";

/** Doğrulama ekranının ipucu: kodu isteyen sahte "destek" mesajı (Doğrulayıcı labıyla bağlantılı). */
export function VerifyTip() {
  const t = getMessages().auth;
  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface-translucent p-[18px] backdrop-blur-sm lg:gap-5 lg:p-6">
      <div className="flex items-center gap-2 text-xs font-bold tracking-[0.8px] text-warning">
        <Lightbulb className="size-4" strokeWidth={2} aria-hidden="true" />
        {t.tipLabel}
      </div>
      <p className="text-base leading-normal text-fg lg:mt-auto">{format(t.verify.tip, { brand: brand.name })}</p>
      <div className="flex flex-col gap-2">
        <div className="max-w-[85%] self-start rounded-[14px] rounded-bl-[4px] bg-card px-3 py-2.5 text-sm leading-[1.45] text-fg">
          <div className="mb-1 text-[11px] font-bold text-fg-3">{format(t.verify.tipSender, { brand: brand.name })}</div>
          {t.verify.tipMessage}
        </div>
        <div className="flex items-center gap-1.5 self-end rounded-xl border border-danger/50 bg-danger/12 px-3 py-2 text-[13px] font-bold text-danger-fg">
          <AlertTriangle className="size-4" strokeWidth={2.2} aria-hidden="true" />
          {t.verify.tipScam}
        </div>
      </div>
      <div aria-hidden="true" className="hidden lg:mt-auto lg:block" />
    </div>
  );
}
