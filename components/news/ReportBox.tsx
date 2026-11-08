import { Eye, Globe, Phone, Siren, Users, type LucideIcon } from "lucide-react";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const marks: { Icon: LucideIcon; box: string }[] = [
  { Icon: Users, box: "bg-success/16 text-success-fg" },
  { Icon: Globe, box: "bg-accent/16 text-accent-fg" },
  { Icon: Eye, box: "bg-purple/16 text-purple-fg" },
  { Icon: Phone, box: "bg-danger/16 text-danger-fg" },
];

/**
 * "Bir şey mi gördün? Nereye bildirilir" (4 Kasım, 15): önce aile ya da öğretmen, sahte site için
 * USOM, zararlı içerik için İhbar Web, para kaybı ya da tehdit için 112. Adresler bağlantı değil,
 * düz yazıdır (siteden çıkış penceresi gerekmesin; öğrenci adresi kendisi yazar).
 */
export function ReportBox({ className, headingLevel = 2 }: { className?: string; headingLevel?: 2 | 3 }) {
  const t = getMessages().news.report;
  const Heading = `h${headingLevel}` as const;
  return (
    <section className={cn("flex flex-col gap-3.5 rounded-[18px] border border-line bg-surface p-[18px]", className)}>
      <Heading className="m-0 flex items-center gap-2 text-base leading-snug font-bold">
        <Siren className="size-[18px] flex-none text-danger-fg" strokeWidth={2} aria-hidden="true" />
        {t.title}
      </Heading>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {t.items.map((item, i) => {
          const { Icon, box } = marks[i];
          return (
            <li key={item.title} className="flex gap-3">
              <span className={cn("flex size-8 flex-none items-center justify-center rounded-[10px]", box)}>
                <Icon className="size-4" strokeWidth={2.2} aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5 text-[13px] leading-normal text-fg-2">
                <b className="text-sm text-fg">{item.title}</b>
                <span>
                  {item.text}
                  {item.address ? (
                    <>
                      {" "}
                      <code className="rounded bg-surface-deep px-1.5 py-0.5 font-mono text-[12px] text-fg select-all">{item.address}</code>
                    </>
                  ) : null}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
