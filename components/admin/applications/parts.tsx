import type { ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import type { SignalLevel } from "@/lib/admin/application-rules";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** "Bilgi: Güçlü / Orta / Zayıf" rengi (Talepler-Son: yeşil, mavi, sarı). */
export const levelChip: Record<SignalLevel, string> = {
  strong: "bg-success/12 text-success-fg",
  medium: "bg-accent/12 text-accent-fg",
  weak: "bg-warning/12 text-warning-fg",
};

/** YENİ OKUL, CEVAP GELDİ, 18 YAŞ ALTI etiketleri. */
export function Tag({ tone, children }: { tone: "warning" | "success"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] flex-none items-center rounded-md px-2 text-[11px] font-extrabold tracking-[.5px]",
        tone === "warning" ? "bg-warning/14 text-warning-fg" : "bg-success/14 text-success-fg",
      )}
    >
      {children}
    </span>
  );
}

/** Ayrıntıdaki bilgi satırı: ikon, küçük başlık, değer ve isteğe bağlı düğme. */
export function FieldRow({ Icon, label, children, action }: { Icon: LucideIcon; label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-card py-3">
      <Icon className="mt-px size-[17px] flex-none text-fg-4" strokeWidth={2} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs text-fg-3">{label}</span>
        <div className="text-[15px] font-bold [overflow-wrap:anywhere]">{children}</div>
      </div>
      {action ? <div className="flex-none self-center">{action}</div> : null}
    </div>
  );
}

/** Pencere başlığı ve kapatma düğmesi. */
export function DialogHead({ id, title, onClose, icon }: { id: string; title: string; onClose: () => void; icon?: ReactNode }) {
  const t = getMessages().adminApplications;
  return (
    <div className="flex items-start justify-between gap-2.5">
      <h2 id={id} className="m-0 flex min-w-0 items-center gap-2 font-heading text-[19px] leading-[1.25] font-bold [overflow-wrap:anywhere] lg:text-[21px]">
        {icon}
        {title}
      </h2>
      <button type="button" onClick={onClose} aria-label={t.close} className="flex size-10 flex-none items-center justify-center rounded-xl text-fg-3 hover:text-fg">
        <X className="size-5" strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Pencere telefonda alttan açılan sayfa, masaüstünde ortada (Talepler-Son-Mobil). */
export const sheetClass =
  "max-lg:mb-0 max-lg:w-full max-lg:max-w-full max-lg:rounded-b-none max-lg:open:[animation:slide-up_.28s_cubic-bezier(.2,.8,.2,1)_both]";

/** Hazır seçenek çipi (ret nedeni, hazır soru). */
export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "h-9 rounded-full border px-3 text-[13px] font-bold transition-colors",
        on ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-fg-2 hover:border-line-strong",
      )}
    >
      {children}
    </button>
  );
}
