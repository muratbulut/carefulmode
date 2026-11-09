"use client";

import { Check, RotateCw } from "lucide-react";
import { useState } from "react";
import { getMessages } from "@/lib/i18n";
import { Spinner } from "./Spinner";

type State = "idle" | "trying" | "done";

/**
 * "Tekrar dene" düğmesi: basınca "Deniyor…" olur; deneme başarılıysa "Bağlandı" yazar.
 * `onRetry` başarısız olursa (false ya da hata) düğme geri gelir.
 */
export function RetryButton({
  onRetry,
  label,
  doneLabel,
}: {
  onRetry: () => Promise<boolean | void> | boolean | void;
  label?: string;
  doneLabel?: string;
}) {
  const t = getMessages();
  const [state, setState] = useState<State>("idle");

  async function handleClick() {
    setState("trying");
    try {
      const result = await onRetry();
      setState(result === false ? "idle" : "done");
    } catch {
      setState("idle");
    }
  }

  if (state === "trying") {
    return (
      <span role="status" className="inline-flex h-10 items-center gap-2 text-sm text-fg-3">
        <Spinner />
        {t.status.trying}
      </span>
    );
  }
  if (state === "done") {
    return (
      <span role="status" className="inline-flex h-10 items-center gap-2 text-sm font-bold text-success-fg">
        <Check className="size-4" strokeWidth={2.6} aria-hidden="true" />
        {doneLabel ?? t.status.connected}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-accent px-3.5 text-sm font-bold text-on-accent"
    >
      <RotateCw className="size-4" strokeWidth={2} aria-hidden="true" />
      {label ?? t.status.retry}
    </button>
  );
}
