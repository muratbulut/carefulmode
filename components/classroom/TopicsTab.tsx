import { toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ClassroomDetailData } from "./types";

/**
 * Sınıf detayı > Konular (D2): mahalleler ve sınıfın bitirme oranı, "Ödev ver" (açık ödevde
 * "Tarihi değiştir") ve geçmiş ödevler. Aynı anda tek ödev.
 */
export function TopicsTab({ data, onGive }: { data: ClassroomDetailData; onGive: (hoodId: string) => void }) {
  const t = getMessages().classroom;
  const tp = t.detail.topics;
  return (
    <div className="flex max-w-[760px] flex-col gap-3">
      <p className="m-0 text-[13px] text-fg-3">{tp.note}</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {data.hoods.map((hood) => {
          const tone = toneOf(hood.color);
          return (
            <li key={hood.id} className="flex items-center gap-3.5 rounded-[20px] border border-line bg-surface px-4 py-3.5">
              <span className={cn("flex size-11 flex-none items-center justify-center rounded-xl text-[13px] font-bold", tone.soft, tone.text)}>
                {format(t.pct, { pct: hood.pct })}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <b className="text-[15px]">{hood.name}</b>
                  <span className="text-xs text-fg-3">{hood.labCount > 0 ? format(tp.labs, { count: hood.labCount }) : tp.noLabs}</span>
                  {hood.current ? (
                    <span className="rounded-full bg-accent px-[7px] py-0.5 text-[10px] font-bold text-on-accent">{tp.current}</span>
                  ) : null}
                </span>
                <span aria-hidden="true" className="block h-[5px] overflow-hidden rounded-full bg-card">
                  <span className={cn("block h-full rounded-full", tone.fill)} style={{ width: `${hood.pct}%` }} />
                </span>
              </span>
              {hood.labCount > 0 ? (
                hood.current ? (
                  <button
                    type="button"
                    onClick={() => onGive(hood.id)}
                    className="h-9 flex-none cursor-pointer rounded-[10px] px-3 text-[13px] font-bold text-accent-fg hover:bg-card"
                  >
                    {tp.changeDate}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onGive(hood.id)}
                    aria-label={format(tp.giveOf, { name: hood.name })}
                    className="h-9 flex-none cursor-pointer rounded-[10px] border border-line px-3 text-[13px] font-bold text-fg hover:border-accent"
                  >
                    {tp.give}
                  </button>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
      {data.past.length > 0 ? (
        <p className="m-0 flex flex-wrap gap-x-2 gap-y-1 text-[13px] text-fg-3">
          <span>{tp.past}</span>
          {data.past.map((p) => (
            <b key={p.id} className={toneOf(p.color).text}>
              {format(tp.pastItem, { name: p.name, pct: p.pct })}
            </b>
          ))}
        </p>
      ) : null}
    </div>
  );
}
