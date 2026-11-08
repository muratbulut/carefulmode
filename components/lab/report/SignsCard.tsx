import type { ReactNode } from "react";
import type { ScenarioTemplate } from "@/lib/lab/content";
import type { ReportView, SignView } from "@/lib/lab/report";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Breakable, SenderAvatar } from "../scene/parts";

const mark = "rounded bg-scene-amber-soft outline-2 outline-offset-2 outline-scene-amber-line";

function Badge({ n, className }: { n: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-6 flex-none items-center justify-center rounded-full bg-warning align-middle text-xs font-extrabold text-on-warning shadow-[0_0_0_4px_color-mix(in_srgb,var(--warning)_25%,transparent)] [animation:pop_.3s_ease-out_both]",
        className,
      )}
    >
      {n}
    </span>
  );
}

/** Paragraftaki alıntıyı işaretler; alıntı yoksa ya da bulunamazsa düz metin. */
function Quoted({ text, sign }: { text: string; sign: SignView | undefined }) {
  if (!sign?.quote) return <>{text}</>;
  let at = text.indexOf(sign.quote);
  if (at < 0) at = text.toLocaleLowerCase("tr").indexOf(sign.quote.toLocaleLowerCase("tr"));
  if (at < 0) return <>{text}</>;
  const end = at + sign.quote.length;
  return (
    <>
      {text.slice(0, at)}
      <span className={mark}>{text.slice(at, end)}</span>
      {text.slice(end)}
    </>
  );
}

function findQuote(paragraph: string, list: SignView[]) {
  return list.find(
    (s) => (s.at === "text" || s.at === "ask") && s.quote && paragraph.toLocaleLowerCase("tr").includes(s.quote.toLocaleLowerCase("tr")),
  );
}

/**
 * Raporda sahte öğenin resmi ve işaretleri (Rapor-Son): gönderen, metindeki alıntı ve bağlantı
 * numaralı sarı halkayla gösterilir, yanında her işaretin açıklaması.
 */
export function SignsCard({ template, signs }: { template: ScenarioTemplate; signs: NonNullable<ReportView["signs"]> }) {
  const t = getMessages().lab;
  const { item, list } = signs;
  const sender = list.find((s) => s.at === "sender");
  const link = list.find((s) => s.at === "link");

  const picture: ReactNode = (
    <div className="flex flex-col gap-2.5 overflow-hidden rounded-2xl border border-scene-line-strong bg-scene-white p-[18px] font-sans text-[13px] text-scene-ink">
      <div className="flex items-center gap-2.5">
        <SenderAvatar name={item.sender} index={0} className="size-8 text-sm" />
        <div className="flex min-w-0 flex-col gap-px">
          <b className="text-sm">{item.sender}</b>
          <span className="flex items-center gap-2 text-scene-ink-3">
            <span className={sender ? `[overflow-wrap:anywhere] ${mark}` : "[overflow-wrap:anywhere]"}>
              <Breakable text={item.address} />
            </span>
            {sender ? <Badge n={sender.n} /> : null}
          </span>
        </div>
      </div>
      {template === "INBOX" && item.subject ? <b className="text-[15px]">{item.subject}</b> : null}
      {item.paragraphs.map((p, i) => {
        const sign = findQuote(p, list);
        return (
          <p
            key={i}
            className={template === "MESSAGING" ? "self-start rounded-2xl rounded-tl-md bg-scene-bubble px-3 py-2 leading-normal" : "leading-relaxed text-scene-body"}
          >
            <Quoted text={p} sign={sign} />
            {sign ? <Badge n={sign.n} className="ml-1.5" /> : null}
          </p>
        );
      })}
      {item.link ? (
        <div className="flex flex-col items-start gap-1.5">
          {template === "INBOX" ? (
            <span className="flex items-center gap-2.5">
              <span
                className={
                  link
                    ? "inline-flex h-9 items-center rounded-lg bg-scene-blue px-4 font-bold text-scene-white outline-2 outline-offset-[3px] outline-scene-amber-line"
                    : "inline-flex h-9 items-center rounded-lg bg-scene-blue px-4 font-bold text-scene-white"
                }
              >
                {item.link.text}
              </span>
              {link ? <Badge n={link.n} /> : null}
            </span>
          ) : null}
          <span className="flex items-center gap-2">
            <span className="rounded-md border border-scene-line-strong bg-scene-paper px-1.5 py-0.5 font-mono text-[11px] [overflow-wrap:anywhere] text-scene-ink-2">
              <Breakable text={item.link.url} />
            </span>
            {link && template !== "INBOX" ? <Badge n={link.n} /> : null}
          </span>
        </div>
      ) : null}
    </div>
  );

  return (
    <section aria-labelledby="report-signs" className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-5 lg:p-6">
      <h2 id="report-signs" tabIndex={-1} className="font-heading text-xl font-bold outline-none lg:text-[22px]">
        {signs.heading}
      </h2>
      <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_1fr]">
        {picture}
        <ol className="flex flex-col gap-3.5">
          {list.map((s) => (
            <li key={s.n} className="flex items-start gap-3">
              <span aria-hidden="true" className="flex size-[26px] flex-none items-center justify-center rounded-full bg-warning text-[13px] font-extrabold text-on-warning">
                {s.n}
              </span>
              <span className="flex flex-col gap-0.5">
                <b className="text-[15px]">
                  <span className="sr-only">{format(t.training.spotFound, { n: s.n })}</span>
                  {s.title}
                </b>
                <span className="text-sm leading-normal text-fg-3">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
