"use client";

import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Lock, Play, Slash, Users, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DifficultyTag, DurationTag, KindTag } from "@/components/lab/LabTags";
import { RoomArt } from "@/components/lab/RoomArt";
import { EmptyState } from "@/components/status/EmptyState";
import { format, getMessages } from "@/lib/i18n";
import {
  defaultSelection,
  districtRing,
  goHref,
  goKind,
  isBasicTraining,
  labHref,
  railParts,
  routeOf,
  scoreTone,
  type DistrictView,
  type LabView,
  type RailPart,
} from "@/lib/lab/route";
import { roomArtOf } from "@/lib/lab/art";
import { routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { BottomSheet } from "./BottomSheet";
import { DistrictGlyph, NeighborhoodIcon, toneOf, type Tone } from "./NeighborhoodIcon";
import { ProgressBar } from "./ProgressRing";
import { SignUpDialog, type SignUpTarget } from "./SignUpDialog";

const DESKTOP = "(min-width: 1024px)";

/**
 * Mahalle sayfası (İ4-A; tahtalar: Mahalle-I4A-Rota, -Mobil, Yol-Haritasi-Ziyaretci). Solda
 * girişteki eğitimden başlayan rota, sağda seçili labın önizlemesi; telefonda önizleme alttan
 * açılır. Ziyaretçide ilerleme yok, düğme "Kayıt ol ve başla".
 */
export function NeighborhoodView({ district, member }: { district: DistrictView; member: boolean }) {
  const t = getMessages();
  const r = t.roadmap;
  const route = routeOf(district);
  const [selected, setSelected] = useState<string | null>(() => defaultSelection(route));
  const [sheet, setSheet] = useState(false);
  const [signUp, setSignUp] = useState<SignUpTarget | null>(null);
  const tone = toneOf(district.color);
  const ring = districtRing(district);
  const rails = railParts(route.map((l) => l.state));
  const current = route.find((l) => l.slug === selected) ?? route[0] ?? null;

  function pick(slug: string) {
    setSelected(slug);
    if (!window.matchMedia(DESKTOP).matches) setSheet(true);
  }

  function askSignUp(lab: LabView) {
    setSheet(false);
    // Kayıttan sonra doğrudan bu laba döner (kilitliyse lab kapağı nedenini söyler).
    setSignUp({ name: lab.name, href: labHref(lab), icon: district.icon, color: district.color });
  }

  return (
    <div className="relative mx-auto flex max-w-[1200px] flex-col gap-4 px-4 pt-5 pb-10 lg:gap-5 lg:px-6 lg:pt-8 lg:pb-[72px]">
      <nav aria-label={r.crumbLabel} className="flex items-center gap-3">
        <Link
          href={routes.roadmap}
          className="inline-flex h-10 flex-none items-center gap-1 rounded-xl border border-line bg-surface pr-3 pl-2 text-sm font-bold text-fg no-underline hover:border-line-strong"
        >
          <ChevronLeft className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
          <span className="lg:hidden">{r.backShort}</span>
          <span className="hidden lg:inline">{r.back}</span>
        </Link>
        <span className="hidden items-center gap-1.5 text-sm text-fg-3 lg:flex">
          {r.crumb}
          <Slash className="size-3" strokeWidth={2} aria-hidden="true" />
          <b className={tone.text} aria-current="page">
            {district.name}
          </b>
        </span>
      </nav>

      <header className="relative flex flex-col gap-3 overflow-hidden rounded-[18px] border border-line bg-surface p-4 lg:flex-row lg:items-center lg:gap-6 lg:rounded-[22px] lg:p-6">
        <span aria-hidden="true" className={cn("pointer-events-none absolute -top-24 -left-24 size-64 rounded-full blur-3xl", tone.glow)} />
        <div className="relative flex min-w-0 flex-1 items-center gap-3 lg:gap-4">
          <NeighborhoodIcon icon={district.icon} color={district.color} className="size-[46px] lg:size-[52px]" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="m-0 font-heading text-[21px] leading-tight font-bold lg:text-[26px]">{district.name}</h1>
            <p className="m-0 text-[13px] text-fg-3 lg:text-sm">{format(district.trainings.length > 0 ? r.districtLabs : r.districtLabsNoTraining, {
                topic: district.topic,
                trainings: district.trainings.length,
                n: district.scenarios.length,
              })}</p>
          </div>
        </div>
        {member && ring.total > 0 ? (
          <div className="relative flex flex-col gap-1.5 lg:w-[280px]">
            <span className="hidden justify-between text-[13px] lg:flex">
              <span className="text-fg-3">{r.districtProgress}</span>
              <b className={tone.text}>{format(r.ring, ring)}</b>
            </span>
            <span className="flex items-center gap-2.5">
              <ProgressBar value={ring.done / ring.total} fillClass={tone.fill} className="h-1.5 flex-1" />
              <b className={cn("text-[13px] lg:hidden", tone.text)}>{format(r.ring, ring)}</b>
            </span>
          </div>
        ) : null}
      </header>

      {route.length === 0 ? (
        <EmptyState Icon={Lock} tone="warning" title={r.empty.title} className="bg-surface-deep py-8">
          {r.empty.text}
        </EmptyState>
      ) : (
        <>
          <p className="m-0 text-sm text-fg-3">
            {member ? (
              r.route
            ) : (
              <>
                <span className="lg:hidden">{r.routeVisitorMobile}</span>
                <span className="hidden lg:inline">{r.routeVisitor}</span>
              </>
            )}
          </p>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <ol aria-label={format(r.routeLabel, { name: district.name })} className="m-0 flex list-none flex-col p-0 lg:flex-[0_1_470px]">
              {route.map((lab, i) => (
                <li key={lab.slug}>
                  <RouteRow
                    lab={lab}
                    basic={isBasicTraining(district, lab)}
                    tone={tone}
                    rail={rails[i]}
                    member={member}
                    selected={lab.slug === current?.slug}
                    onPick={() => pick(lab.slug)}
                  />
                </li>
              ))}
            </ol>

            {current ? (
              <section
                aria-label={r.preview.label}
                className={cn(
                  "sticky top-4 hidden flex-[1_1_420px] flex-col gap-4 rounded-[22px] border bg-surface p-6 lg:flex",
                  member && current.state === "next" ? "border-accent" : "border-line",
                )}
              >
                <Preview key={current.slug} lab={current} tone={tone} member={member} onSignUp={askSignUp} />
              </section>
            ) : null}
          </div>
        </>
      )}

      {current ? (
        <BottomSheet
          open={sheet}
          onClose={() => setSheet(false)}
          label={current.name}
          closeLabel={r.preview.close}
          className="lg:hidden"
          title={<PreviewChips lab={current} tone={tone} member={member} />}
        >
          <Preview lab={current} tone={tone} member={member} onSignUp={askSignUp} compact />
        </BottomSheet>
      ) : null}

      <SignUpDialog target={signUp} onClose={() => setSignUp(null)} />
    </div>
  );
}

const railClass = (part: RailPart, tone: Tone) => (part === "done" ? tone.fill : part === "todo" ? "bg-line" : "bg-transparent");

function nodeNumber(lab: LabView) {
  return lab.type === "TRAINING" ? getMessages().roadmap.gateNode : String(lab.order).padStart(2, "0");
}

function RouteRow({
  lab,
  basic,
  tone,
  rail,
  member,
  selected,
  onPick,
}: {
  lab: LabView;
  /** Temel eğitim mi (mahallenin girişi); diğer eğitimler ileri eğitimdir. */
  basic: boolean;
  tone: Tone;
  rail: { top: RailPart; bottom: RailPart };
  member: boolean;
  selected: boolean;
  onPick: () => void;
}) {
  const t = getMessages();
  const r = t.roadmap;
  const training = lab.type === "TRAINING";
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className="flex w-full cursor-pointer items-stretch gap-2.5 border-0 bg-transparent p-0 text-left font-[inherit] text-fg lg:gap-3"
    >
      <span aria-hidden="true" className="relative flex w-9 flex-none items-center justify-center lg:w-10">
        <span className={cn("absolute top-0 left-1/2 h-1/2 w-[3px] -translate-x-1/2", railClass(rail.top, tone))} />
        <span className={cn("absolute top-1/2 bottom-0 left-1/2 w-[3px] -translate-x-1/2", railClass(rail.bottom, tone))} />
        <Node lab={lab} tone={tone} member={member} />
      </span>
      <span
        className={cn(
          "my-[5px] flex min-w-0 flex-1 items-center gap-3 rounded-[14px] border p-3 transition-colors lg:p-3.5",
          selected ? "border-accent bg-card" : "border-line bg-surface hover:border-line-strong",
          member && lab.state === "locked" && "opacity-60",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {training ? <span className="text-[10px] font-bold tracking-[0.5px] text-warning-fg">{basic ? r.gate : r.advancedGate}</span> : null}
          <span className="truncate text-[15px] font-bold">{lab.name}</span>
          <span className="text-xs text-fg-3">{labMeta(lab)}</span>
        </span>
        <RowStatus lab={lab} member={member} />
        <ChevronRight className="size-4 flex-none text-fg-4 lg:hidden" strokeWidth={2} aria-hidden="true" />
      </span>
    </button>
  );
}

export function labMeta(lab: LabView) {
  const t = getMessages();
  return lab.cards !== null
    ? format(t.roadmap.cardsMeta, { n: lab.cards, minutes: lab.durationMin })
    : format(t.roadmap.labMeta, { difficulty: t.lab.difficulty[lab.difficulty], minutes: lab.durationMin });
}

function Node({ lab, tone, member }: { lab: LabView; tone: Tone; member: boolean }) {
  const state = member ? lab.state : lab.state === "locked" ? "locked" : "open";
  const dashed = lab.type === "TRAINING" && state !== "done";
  return (
    <span
      className={cn(
        "relative flex size-7 flex-none items-center justify-center rounded-full border-2 lg:size-8",
        state === "done" && cn(tone.fill, tone.border),
        state === "next" && "border-accent-light bg-accent anim-node-glow",
        state === "open" && cn("bg-surface", tone.border),
        state === "locked" && "border-line bg-surface",
        dashed && cn("outline-2 outline-offset-[3px] outline-dashed", tone.outline),
      )}
    >
      {state === "done" ? <Check className="size-3.5 text-on-accent" strokeWidth={3} /> : null}
      {state === "next" ? <Play className="ml-0.5 size-3 fill-current text-on-accent" strokeWidth={2.4} /> : null}
      {state === "locked" ? <Lock className="size-3 text-fg-4" strokeWidth={2.4} /> : null}
      {state === "open" ? <span className={cn("font-mono text-[11px] font-bold", tone.text)}>{nodeNumber(lab)}</span> : null}
    </span>
  );
}

function RowStatus({ lab, member }: { lab: LabView; member: boolean }) {
  const t = getMessages();
  const r = t.roadmap;
  if (!member) return <span className="flex-none text-xs font-bold text-fg-3">{format(t.lab.durationShort, { n: lab.durationMin })}</span>;
  if (lab.state === "done" && lab.best !== null) {
    return (
      <span className={cn("flex-none text-sm font-bold", scoreTone(lab.best) === "good" ? "text-success-fg" : "text-warning-fg")}>
        {format(r.score, { n: lab.best })}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex-none text-xs font-bold",
        lab.state === "done" && "text-success-fg",
        lab.state === "next" && "text-accent-fg",
        lab.state === "open" && "text-fg-2",
        lab.state === "locked" && "text-fg-4",
      )}
    >
      {r.states[lab.state]}
    </span>
  );
}

function stateChip(lab: LabView, member: boolean) {
  const r = getMessages().roadmap;
  if (!member) return lab.state === "locked" ? { text: r.states.locked, cls: "text-fg-3" } : null;
  if (lab.state === "done" && lab.best !== null) {
    return { text: format(r.score, { n: lab.best }), cls: scoreTone(lab.best) === "good" ? "text-success-fg" : "text-warning-fg" };
  }
  const cls = { done: "text-success-fg", next: "text-accent-fg", open: "text-fg-2", locked: "text-fg-3" }[lab.state];
  return { text: r.states[lab.state], cls };
}

function PreviewChips({ lab, tone, member }: { lab: LabView; tone: Tone; member: boolean }) {
  const chip = stateChip(lab, member);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className={cn("rounded-full bg-card px-2.5 py-1 text-xs font-bold", tone.text)}>{lab.district.topic}</span>
      {chip ? <span className={cn("rounded-full bg-card px-2.5 py-1 text-xs font-bold", chip.cls)}>{chip.text}</span> : null}
    </span>
  );
}

function Preview({
  lab,
  tone,
  member,
  onSignUp,
  compact = false,
}: {
  lab: LabView;
  tone: Tone;
  member: boolean;
  onSignUp: (lab: LabView) => void;
  compact?: boolean;
}) {
  const t = getMessages();
  const r = t.roadmap;
  const chip = stateChip(lab, member);
  const go = goKind(lab);
  const training = lab.type === "TRAINING";
  const art = roomArtOf(lab.slug);
  return (
    <>
      {compact ? null : (
        <div className="relative flex h-[190px] items-center justify-center overflow-hidden rounded-2xl bg-surface-deep">
          <span aria-hidden="true" className={cn("pointer-events-none absolute top-0 left-0 size-56 rounded-full blur-3xl", tone.glow)} />
          {art ? (
            // 7.1. revize: odanın kendi çizimi.
            <RoomArt src={art} className="absolute inset-0 size-full" />
          ) : training ? (
            <DistrictGlyph icon={lab.district.icon} className={cn("relative size-24 opacity-30", tone.text)} strokeWidth={1.4} aria-hidden="true" />
          ) : (
            <span aria-hidden="true" className={cn("relative font-mono text-[96px] font-bold opacity-25", tone.text)}>
              {nodeNumber(lab)}
            </span>
          )}
          <span className={cn("absolute top-3 left-3.5 rounded-full bg-canvas/70 px-2.5 py-1 text-xs font-bold", tone.text)}>{lab.district.topic}</span>
          {chip ? <span className={cn("absolute top-3 right-3.5 rounded-full bg-canvas/70 px-2.5 py-1 text-xs font-bold", chip.cls)}>{chip.text}</span> : null}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <span className={cn("text-[11px] font-bold tracking-[0.5px]", training ? "text-warning-fg" : "text-fg-3")}>{t.lab.kindsUpper[lab.type]}</span>
        <h2 className="m-0 font-heading text-[23px] leading-[1.15] font-bold lg:text-[28px]">{lab.name}</h2>
        {lab.summary ? <p className="m-0 text-[15px] leading-[1.6] text-fg-2 lg:text-base">{lab.summary}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {/* 15. revize A: renkli çerçeveli etiketler. */}
        {training ? <KindTag type="TRAINING" /> : <DifficultyTag difficulty={lab.difficulty} />}
        <DurationTag minutes={lab.durationMin} />
        <Chip Icon={Users}>{format(r.preview.finished, { n: lab.completions })}</Chip>
      </div>
      {!member ? (
        <>
          <button
            type="button"
            onClick={() => onSignUp(lab)}
            className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-accent text-[17px] font-bold text-on-accent transition-[filter] hover:brightness-110"
          >
            <Lock className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
            {r.preview.visitorGo}
          </button>
          <p className="m-0 text-center text-[13px] text-fg-3">{r.preview.visitorNote}</p>
        </>
      ) : go ? (
        <Link
          href={goHref(lab)}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-accent text-[17px] font-bold text-on-accent no-underline transition-[filter] hover:brightness-110"
        >
          {r.preview.go[go]}
        </Link>
      ) : (
        <p className="m-0 flex items-center gap-2 rounded-xl bg-surface-raised p-3.5 text-sm text-fg-3">
          <Lock className="size-4 flex-none text-fg-4" strokeWidth={2} aria-hidden="true" />
          {lab.lockedBy ? format(r.preview.locked, { name: lab.lockedBy }) : r.preview.lockedNoName}
        </p>
      )}
    </>
  );
}

function Chip({ Icon, children }: { Icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-card px-2.5 text-[13px] text-fg-2">
      <Icon className="size-3.5 text-fg-3" strokeWidth={2} aria-hidden="true" />
      {children}
    </span>
  );
}
