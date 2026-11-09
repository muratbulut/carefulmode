import Link from "next/link";
import { ChevronRight, Lock, Users } from "lucide-react";
import { DifficultyTag, DurationTag, KindTag } from "@/components/lab/LabTags";
import { RoomArt } from "@/components/lab/RoomArt";
import { DistrictGlyph, NeighborhoodIcon, toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { format, getMessages } from "@/lib/i18n";
import { roomArtOf } from "@/lib/lab/art";
import { labHref, scoreTone, type LabView } from "@/lib/lab/route";
import { cn } from "@/lib/utils";

type Status = { text: string; cls: string; locked?: boolean } | null;

/** Kartın sağ üstündeki durum: "Bitti · 80/100", "Kaldığın yer", "Kilitli"; ziyaretçide "Kayıtla açılır". */
export function labStatus(lab: LabView, member: boolean, here: boolean): Status {
  const t = getMessages().catalog.status;
  if (!member) return { text: t.visitor, cls: "text-fg-2", locked: true };
  if (lab.state === "done") {
    if (lab.best === null) return { text: t.done, cls: "text-success-fg" };
    return { text: format(t.doneScore, { n: lab.best }), cls: scoreTone(lab.best) === "good" ? "text-success-fg" : "text-warning-fg" };
  }
  if (here) return { text: t.here, cls: "text-accent-fg" };
  if (lab.state === "locked") return { text: t.locked, cls: "text-fg-3", locked: true };
  return null;
}

/**
 * Katalog kartı (Lablar-F1-Dugme). Giriş yapmışta bağlantıdır (eğitim labı oynatıcıya, senaryo
 * labı detay sayfasına); ziyaretçide düğmedir ve kayıt penceresini açar.
 */
export function LabCard({ lab, member, here, onVisitor }: { lab: LabView; member: boolean; here: boolean; onVisitor: (lab: LabView) => void }) {
  const tone = toneOf(lab.district.color);
  const status = labStatus(lab, member, here);
  const locked = member && lab.state === "locked";
  const className = cn(
    "flex h-full w-full flex-col overflow-hidden rounded-[20px] border bg-surface text-left font-[inherit] text-fg no-underline transition-[transform,border-color] hover:-translate-y-0.5",
    here ? "border-accent" : "border-line hover:border-line-strong",
    locked && "opacity-[0.72]",
  );
  const art = roomArtOf(lab.slug);
  const body = (
    <>
      <span
        className={cn(
          "relative flex w-full items-center justify-center overflow-hidden border-b border-card bg-surface-deep",
          art ? "aspect-[2/1] max-w-full" : "h-[110px]",
        )}
      >
        {art ? (
          // 7.1. revize: odanın kendi çizimi; çizimi olmayan odada mahallenin ikonu.
          <RoomArt src={art} className="size-full" />
        ) : (
          <>
            <span aria-hidden="true" className={cn("pointer-events-none absolute -top-16 right-6 size-44 rounded-full blur-3xl", tone.glow)} />
            <DistrictGlyph icon={lab.district.icon} className={cn("relative size-10", tone.text)} strokeWidth={1.8} aria-hidden="true" />
          </>
        )}
        {lab.isNew ? <NewBadge className="absolute top-3 left-3" /> : null}
        {status ? <StatusChip status={status} className="absolute top-3 right-3" /> : null}
      </span>
      <span className="flex flex-1 flex-col gap-2 p-4">
        <span className={cn("text-[11px] font-bold tracking-[0.4px]", tone.text)}>
          {lab.district.topic}
        </span>
        <span className="font-heading text-lg leading-tight font-bold">{lab.name}</span>
        {lab.summary ? <span className="line-clamp-2 text-sm leading-normal text-fg-2">{lab.summary}</span> : null}
        {/* 15. revize A: tür, zorluk ve süre renkli çerçeveli etiketlerde. */}
        <span className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
          <KindTag type={lab.type} size="sm" />
          <DifficultyTag difficulty={lab.difficulty} size="sm" />
          <DurationTag minutes={lab.durationMin} size="sm" />
        </span>
        <Completions n={lab.completions} />
        {locked ? <LockedLine lab={lab} /> : null}
      </span>
    </>
  );
  if (!member) {
    return (
      <button type="button" onClick={() => onVisitor(lab)} className={cn(className, "cursor-pointer p-0")}>
        {body}
      </button>
    );
  }
  return (
    <Link href={labHref(lab)} className={className}>
      {body}
    </Link>
  );
}

/** Telefondaki satır (Lablar-F1-Dugme-Mobil). */
export function LabRow({ lab, member, here, onVisitor }: { lab: LabView; member: boolean; here: boolean; onVisitor: (lab: LabView) => void }) {
  const tone = toneOf(lab.district.color);
  const status = labStatus(lab, member, here);
  const locked = member && lab.state === "locked";
  const className = cn(
    "flex w-full items-center gap-3 rounded-2xl border bg-surface p-3 text-left font-[inherit] text-fg no-underline",
    here ? "border-accent" : "border-line",
    locked && "opacity-[0.72]",
  );
  const art = roomArtOf(lab.slug);
  const body = (
    <>
      {art ? (
        <RoomArt src={art} className="h-14 w-[84px] flex-none rounded-[14px] border border-card bg-surface-deep" />
      ) : (
        <NeighborhoodIcon icon={lab.district.icon} color={lab.district.color} className="size-12 rounded-[14px]" iconClassName="size-[22px]" />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-bold">{lab.name}</span>
          {lab.isNew ? <NewBadge /> : null}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-fg-3">
          <span aria-hidden="true" className={cn("size-2 flex-none rounded-full", tone.fill)} />
          <span className="truncate">{lab.district.topic}</span>
        </span>
        <span className="flex flex-wrap gap-1">
          <DifficultyTag difficulty={lab.difficulty} size="sm" />
          <DurationTag minutes={lab.durationMin} size="sm" />
        </span>
        {status ? (
          <span className={cn("inline-flex items-center gap-1 text-xs font-bold", status.cls)}>
            {status.locked ? <Lock className="size-3" strokeWidth={2.4} aria-hidden="true" /> : null}
            {status.text}
          </span>
        ) : null}
      </span>
      <ChevronRight className="size-[18px] flex-none text-fg-4" strokeWidth={2} aria-hidden="true" />
    </>
  );
  if (!member) {
    return (
      <button type="button" onClick={() => onVisitor(lab)} className={cn(className, "cursor-pointer")}>
        {body}
      </button>
    );
  }
  return (
    <Link href={labHref(lab)} className={className}>
      {body}
    </Link>
  );
}

function LockedLine({ lab }: { lab: LabView }) {
  const t = getMessages().catalog;
  return (
    <span className="flex items-center gap-1.5 text-xs text-fg-3">
      <Lock className="size-3.5 flex-none text-fg-4" strokeWidth={2.2} aria-hidden="true" />
      {lab.lockedBy ? format(t.lockedBy, { name: lab.lockedBy }) : t.lockedByTraining}
    </span>
  );
}

/** "Yeni" rozeti hafifçe yanıp söner (4 Kasım, Murat); "Hareketi azalt" açıksa durur (globals.css). */
export function NewBadge({ className }: { className?: string }) {
  return (
    <span className={cn("new-badge flex-none rounded-full bg-success px-[7px] py-0.5 text-[10px] font-bold text-on-accent", className)}>
      {getMessages().catalog.new}
    </span>
  );
}

function StatusChip({ status, className }: { status: NonNullable<Status>; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center gap-1.5 rounded-full border border-line bg-canvas/80 px-[9px] text-xs font-bold",
        status.cls,
        className,
      )}
    >
      {status.locked ? <Lock className="size-3 text-fg-3" strokeWidth={2.2} aria-hidden="true" /> : null}
      {status.text}
    </span>
  );
}

/**
 * Kaç kişi bitirdi: renkli ve hafif hareketli (4 Kasım, Murat). Bitiren varsa yanındaki nokta
 * nabız gibi atar; "Hareketi azalt" açıksa durur.
 */
function Completions({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-pink/12 py-[3px] pr-2.5 pl-2 text-xs font-bold text-pink-fg">
      <Users className="size-[13px]" strokeWidth={2.2} aria-hidden="true" />
      {format(getMessages().catalog.people, { n })}
      {n > 0 ? <span aria-hidden="true" className="completions-pulse size-1.5 rounded-full bg-pink" /> : null}
    </span>
  );
}
