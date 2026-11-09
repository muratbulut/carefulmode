import { CreditCard, Eye, Flag, Globe, Hourglass, Lightbulb, MessageSquareLock, type LucideIcon } from "lucide-react";
import { getMessages } from "@/lib/i18n";
import { tipKind, type TipKind } from "@/lib/lab/tip-kind";
import { cn } from "@/lib/utils";

const kindStyle: Record<TipKind, { Icon: LucideIcon; band: string; icon: string }> = {
  address: { Icon: Eye, band: "bg-accent/12", icon: "bg-accent/18 text-accent-fg" },
  self: { Icon: Globe, band: "bg-success/12", icon: "bg-success/18 text-success-fg" },
  report: { Icon: Flag, band: "bg-danger/12", icon: "bg-danger/18 text-danger-fg" },
  code: { Icon: MessageSquareLock, band: "bg-purple/12", icon: "bg-purple/18 text-purple-fg" },
  hurry: { Icon: Hourglass, band: "bg-warning/12", icon: "bg-warning/18 text-warning-fg" },
  card: { Icon: CreditCard, band: "bg-orange/12", icon: "bg-orange/18 text-orange-fg" },
  tip: { Icon: Lightbulb, band: "bg-accent/10", icon: "bg-accent/16 text-accent-fg" },
};

/** "Bir dahaki sefere" (14. revize): kurallar açık kartlar, her birinin üstünde büyük bir simge ve kısa başlık. */
export function ReportTips({ tips }: { tips: string[] }) {
  const t = getMessages().lab.report.journey;
  return (
    <ol className={cn("grid gap-3", tips.length > 1 && "lg:grid-cols-3")}>
      {tips.map((tip, i) => {
        const kind = tipKind(tip);
        const { Icon, band, icon } = kindStyle[kind];
        return (
          <li key={tip} className="flex flex-col overflow-hidden rounded-[18px] border border-line bg-surface [animation:rise_.4s_ease-out_both]" style={{ animationDelay: `${i * 0.12}s` }}>
            <div aria-hidden="true" className={cn("flex h-24 items-center justify-center border-b border-line lg:h-28", band)}>
              <span className={cn("flex size-14 items-center justify-center rounded-2xl lg:size-16", icon)}>
                <Icon className="size-7 lg:size-8" strokeWidth={2} />
              </span>
            </div>
            <div className="flex flex-col gap-1.5 px-4 pt-3 pb-4">
              <b className="font-heading text-lg">{t.rules[kind]}</b>
              <span className="text-[15px] leading-normal text-fg-2">{tip}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
