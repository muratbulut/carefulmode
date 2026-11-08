import { Eye, EyeOff } from "lucide-react";
import { getMessages } from "@/lib/i18n";

/** "Ne görürsün, ne görmezsin" (Tur 4, 22c Okulum): sorumlunun neyi görüp neyi görmediği. */
export function PrivacyBox() {
  const t = getMessages().school.privacy;
  return (
    <section aria-labelledby="school-privacy" className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface-deep p-4 lg:p-5 print:hidden">
      <h2 id="school-privacy" className="m-0 text-base font-bold">
        {t.title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-success-fg">
            <Eye className="size-4" strokeWidth={2} aria-hidden="true" />
            {t.see}
          </span>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[13px] leading-normal text-fg-2 marker:text-success">
            {t.seeItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-fg-3">
            <EyeOff className="size-4" strokeWidth={2} aria-hidden="true" />
            {t.notSee}
          </span>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[13px] leading-normal text-fg-3 marker:text-fg-4">
            {t.notSeeItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
