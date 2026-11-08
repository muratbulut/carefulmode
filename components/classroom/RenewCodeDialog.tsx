"use client";

import { RefreshCw } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { renewJoinCode } from "@/lib/classroom/teacher-actions";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { errorText } from "./client";
import { Sheet } from "./Sheet";

/**
 * "Kodu yenile" onayı (sabah soruları 14): kod istenmeyen kişilere ulaştıysa öğretmen sınıfa yeni
 * bir kod verir. Eski kod ve bağlantısı hemen çalışmaz olur, öğrenciler sınıfta kalır. Başarılı
 * olunca sayfa sunucudan yeniden çizilir (yeni kod ve QR) ve pencere kapanır.
 */
export function RenewCodeDialog({
  open,
  classroomId,
  code,
  onClose,
  onDone,
}: {
  open: boolean;
  classroomId: string;
  code: string;
  onClose: () => void;
  onDone: (code: string) => void;
}) {
  const r = getMessages().classroom.detail.renew;
  const titleId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setError(null);
    onClose();
  }

  function renew() {
    setError(null);
    startTransition(async () => {
      const result = await renewJoinCode({ classroomId });
      if (result.ok) onDone(result.code);
      else setError(errorText(result.error));
    });
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      labelledBy={titleId}
      closeLabel={r.close}
      title={
        <h2 id={titleId} className="m-0 font-heading text-[22px] font-bold break-words">
          {r.title}
        </h2>
      }
    >
      <p className="m-0 text-sm leading-normal text-fg-2">{format(r.text, { code })}</p>
      <p className="m-0 text-[13px] leading-normal text-fg-3">{r.hint}</p>
      {error ? (
        <p role="alert" className="m-0 text-[13px] font-medium text-danger-fg">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={close} className="h-11 cursor-pointer rounded-xl border border-line bg-surface text-sm font-bold text-fg">
          {r.cancel}
        </button>
        <button
          type="button"
          onClick={renew}
          disabled={pending}
          className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-3 text-sm font-bold text-on-accent disabled:cursor-wait"
        >
          <RefreshCw className={cn("size-4 flex-none", pending && "motion-safe:animate-spin")} strokeWidth={2} aria-hidden="true" />
          {pending ? r.pending : r.confirm}
        </button>
      </div>
    </Sheet>
  );
}
