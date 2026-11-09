"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { brand, Wordmark } from "@/lib/brand";
import { projectionJoins } from "@/lib/classroom/teacher-actions";
import { format, getMessages, rich } from "@/lib/i18n";
import { QrCode } from "./QrCode";
import type { ProjectionTarget } from "./types";

/** Katılanlar bu aralıkla sorulur (yalnızca ekran açıkken). */
const pollMs = 4000;

/**
 * Tahtaya yansıt (Siniflarim-C4-Yansit, -Mobil): tam ekranda sınıf kodu, QR ve 3 adımlık tarif.
 * Açıkken katılan öğrencilerin adları ekrana düşer. Escape ya da "Kapat" sınıflara döndürür.
 */
export function ProjectionOverlay({ target, onClose }: { target: ProjectionTarget | null; onClose: () => void }) {
  const t = getMessages().classroom.projection;
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const joinedAny = useRef(false);
  const open = target !== null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      joinedAny.current = false;
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  function close() {
    onClose();
    // Ekran açıkken katılan olduysa sayfadaki sayılar da yenilensin.
    if (joinedAny.current) router.refresh();
  }

  return (
    <dialog
      ref={ref}
      aria-label={t.label}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-canvas p-0 text-fg backdrop:bg-canvas open:flex open:flex-col open:[animation:fade-in_.2s_ease-out_both]"
    >
      {target ? (
        <ProjectionBody
          key={target.id}
          target={target}
          onClose={close}
          onJoined={() => {
            joinedAny.current = true;
          }}
        />
      ) : null}
    </dialog>
  );
}

function ProjectionBody({ target, onClose, onJoined }: { target: ProjectionTarget; onClose: () => void; onJoined: () => void }) {
  const t = getMessages().classroom.projection;
  const [joined, setJoined] = useState<{ id: string; name: string }[]>([]);
  const notifyJoined = useEffectEvent(onJoined);

  // Ekran açıldıktan sonra katılanlar: ilk soru sunucunun saatini alır, sonrakiler o andan beri
  // katılanları getirir. Sekme arka plandayken sorulmaz.
  useEffect(() => {
    let since: string | null = null;
    let stopped = false;
    let timer: number | undefined;
    const tick = async () => {
      if (!document.hidden || since === null) {
        try {
          const result = await projectionJoins({ classroomId: target.id, since });
          if (stopped) return;
          if (result.ok) {
            since = result.since;
            setJoined(result.joined);
            if (result.joined.length > 0) notifyJoined();
          }
        } catch {
          // Bağlantı koptuysa sonraki turda yeniden denenir.
        }
      }
      if (!stopped) timer = window.setTimeout(tick, pollMs);
    };
    void tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [target.id]);

  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute top-[10%] left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative flex flex-none items-center justify-between gap-3 px-4 py-3 lg:px-7 lg:py-5">
        <span className="hidden items-center gap-2.5 lg:flex">
          <Wordmark labelled className="h-[18px] w-auto" />
        </span>
        <span className="text-[13px] leading-snug text-fg-4">{t.note}</span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-[42px] flex-none cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 text-sm font-bold text-fg"
        >
          <X className="size-4" strokeWidth={2} aria-hidden="true" />
          {t.close}
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col items-center gap-[22px] overflow-y-auto px-4 pt-2 pb-8 lg:justify-center lg:gap-10 lg:pt-5">
        <div className="flex flex-col items-center gap-4 text-center lg:gap-7">
          <h2 className="m-0 text-[13px] font-bold tracking-[1.5px] text-fg-3 lg:text-xl lg:tracking-[3px]">
            {format(t.join, { name: target.name.toLocaleUpperCase("tr") })}
          </h2>
          <div role="img" aria-label={format(t.code, { code: target.code })} data-testid="projection-code" className="flex gap-1.5 lg:gap-3.5">
            {[...target.code].map((ch, i) => (
              <span
                key={i}
                aria-hidden="true"
                style={{ animationDelay: `${i * 60}ms` }}
                className="flex h-14 w-10 items-center justify-center rounded-[10px] border border-line bg-surface font-mono text-[30px] font-bold text-accent-fg [animation:rise_.45s_cubic-bezier(.2,.8,.2,1)_both] lg:h-32 lg:w-24 lg:rounded-[18px] lg:text-[76px]"
              >
                {ch}
              </span>
            ))}
          </div>
          <div className="flex flex-col items-center gap-4 lg:flex-row lg:gap-10 lg:text-left">
            <QrCode qr={target.qr} label={t.qr} className="size-[176px] lg:size-[248px] lg:p-3.5" />
            <ol className="m-0 flex list-none flex-col gap-2 p-0 text-sm text-fg-2 lg:gap-3 lg:text-xl">
              {t.steps.map((step) => (
                <li key={step}>{rich(format(step, { brand: brand.name }), { b: (chunk) => <b className="text-fg">{chunk}</b> })}</li>
              ))}
            </ol>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3">
          <p aria-live="polite" className="m-0 inline-flex items-center gap-2.5 text-[15px] font-bold lg:text-lg">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-success [animation:breathe-dot_1.4s_ease-out_infinite]" />
            {joined.length === 0 ? t.waiting : format(t.joined, { count: joined.length })}
          </p>
          {joined.length > 0 ? (
            <ul className="m-0 flex max-w-[360px] list-none flex-wrap justify-center gap-2 p-0 lg:max-w-[900px]">
              {joined.map((j) => (
                <li
                  key={j.id}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface pr-3.5 pl-1.5 font-bold [animation:pop_.45s_cubic-bezier(.2,.8,.2,1)_both]"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-success/16">
                    <Check className="size-3.5 text-success-fg" strokeWidth={2.6} aria-hidden="true" />
                  </span>
                  {j.name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </>
  );
}
