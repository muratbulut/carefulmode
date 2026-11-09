"use client";

import { Fragment, useEffect, useRef, type FocusEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { lookAt } from "@/components/mascot/RoomMascot";
import { cn } from "@/lib/utils";

// Lab sahnelerinin (Postam, Mesajlar, sahte sayfa) ortak parçaları. Sahnedeki uygulamalar
// kurgusaldır ve kendi açık renkleriyle çizilir (--scene-* değişkenleri, temayla değişmez).

/** Gönderenin harfli yuvarlağı; renk öğenin sırasından gelir (içerik sahte/gerçek söylemez). */
const avatarColors = ["bg-scene-amber", "bg-scene-blue", "bg-scene-green", "bg-scene-violet", "bg-scene-orange", "bg-scene-red"];

export function SenderAvatar({ name, index, className }: { name: string; index: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex flex-none items-center justify-center rounded-full font-bold text-scene-white",
        avatarColors[index % avatarColors.length],
        className,
      )}
    >
      {name.trim().charAt(0).toLocaleUpperCase("tr")}
    </span>
  );
}

/** İçerikteki **kalın** parçaları <b> yapar (lab metni veritabanından gelir). */
export function RichLine({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <span key={i}>{part}</span>,
      )}
    </>
  );
}

/** Sahnedeki kısa bildirim (uygulamanın içinde, altta ortada). */
export function SceneToast({ message, onClose }: { message: string | null; onClose: () => void }) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => close.current(), 2600);
    return () => window.clearTimeout(timer);
  }, [message]);
  return (
    <div role="status" className="pointer-events-none absolute inset-x-3 bottom-5 z-20 flex justify-center">
      {message ? (
        <span
          key={message}
          className="rounded-[10px] bg-scene-ink px-4 py-2.5 text-center text-sm font-bold text-scene-white shadow-[0_10px_24px_var(--scene-shadow)] [animation:pop_.25s_ease-out_both]"
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}

/** Sahnedeki onay penceresi (uygulamanın kendi açık penceresi). */
export function SceneConfirm({
  open,
  title,
  text,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-scene-scrim p-4 [animation:fade-in_.15s_ease-out_both]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="scene-confirm-title"
        aria-describedby="scene-confirm-text"
        className="flex w-full max-w-[360px] flex-col gap-3 rounded-2xl bg-scene-white p-5 text-scene-ink shadow-[0_20px_50px_var(--scene-shadow)] [animation:pop_.2s_ease-out_both]"
      >
        <h2 id="scene-confirm-title" className="text-[17px] font-bold">
          {title}
        </h2>
        <p id="scene-confirm-text" className="text-sm leading-normal text-scene-ink-3">
          {text}
        </p>
        <div className="flex justify-end gap-2">
          <button
            ref={cancel}
            type="button"
            onClick={onCancel}
            className="h-10 cursor-pointer rounded-[10px] border border-scene-line-strong bg-scene-white px-4 font-bold text-scene-ink-2"
          >
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className="h-10 cursor-pointer rounded-[10px] bg-scene-orange px-4 font-bold text-scene-white">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Spam / çöp klasöründeki öğenin üstündeki sarı uyarı. */
export function FolderBanner({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-[10px] border border-scene-amber-line bg-scene-amber-soft px-3 py-2.5 text-[13px] leading-normal text-scene-amber-ink">
      {icon}
      <span>{children}</span>
    </div>
  );
}

/**
 * Bağlantının gittiği adresi tıklamadan göstermek: bilgisayarda üzerine gelince, telefonda basılı
 * tutunca (Lab-Cerceve: "Linke tıklamadan önce adresine bak"). Basılı tutmanın ardından gelen
 * tıklama yok sayılır.
 */
export function useLinkPeek(onPeek: (show: boolean) => void) {
  const timer = useRef<number | null>(null);
  const pressed = useRef(false);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const handlers = {
    // Şeritteki maskot da bağlantıya bakar (RoomMascot); her bağlantıya aynı bakar.
    onMouseEnter: (e: MouseEvent<HTMLElement>) => {
      onPeek(true);
      lookAt(e.currentTarget);
    },
    onMouseLeave: () => {
      onPeek(false);
      lookAt(null);
    },
    onFocus: (e: FocusEvent<HTMLElement>) => {
      onPeek(true);
      lookAt(e.currentTarget);
    },
    onBlur: () => {
      onPeek(false);
      lookAt(null);
    },
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      pressed.current = false;
      clear();
      timer.current = window.setTimeout(() => {
        pressed.current = true;
        onPeek(true);
      }, 450);
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  };
  return {
    /** Bağlantı düğmesine verilecek olaylar. */
    handlers,
    /** Tıklama gerçekten tıklama mı (basılı tutma değil mi)? */
    consumePress: () => {
      const was = pressed.current;
      pressed.current = false;
      return !was;
    },
  };
}

/**
 * Adresi ya da bağlantıyı doğal yerlerinden (@ ve / sonrası, nokta, tire, ? = & öncesi) bölünebilir yapar;
 * dar ekranda "kargo-teslimat-tr.x / yz" gibi kelime ortasından bölünmesin. Yine sığmazsa kapsayan
 * öğedeki [overflow-wrap:anywhere] son çare olarak böler.
 */
export function Breakable({ text }: { text: string }) {
  const parts = text.split(/(?<=[@/])|(?=[.\-?=&])/);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? <wbr /> : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}
