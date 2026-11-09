"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { setLabGate, type ActionError } from "@/lib/admin/lab-actions";
import type { AdminLab } from "@/lib/admin/lab-data";
import { format, getMessages } from "@/lib/i18n";

/**
 * Senaryo odasını açan eğitim (Lab.unlockedById). Taslaktan ayrıdır: seçilince hemen kaydedilir
 * ve yayın gerektirmez (sıra gibi). Yayın izni ister; izni olmayan yalnızca okur.
 */
export function GatePicker({
  labId,
  gate,
  canPublish,
  onSaved,
  onError,
}: {
  labId: string;
  gate: NonNullable<AdminLab["gate"]>;
  canPublish: boolean;
  onSaved: (message: string) => void;
  onError: (error: ActionError) => void;
}) {
  const g = getMessages().admin.editor.gate;
  const id = useId();
  const router = useRouter();
  const [current, setCurrent] = useState(gate.current);
  const [pending, startTransition] = useTransition();
  const basicId = gate.options[0]?.id ?? null;

  if (gate.options.length === 0) return <span className="text-[13px] text-fg-3">{g.none}</span>;

  function change(value: string) {
    const previous = current;
    setCurrent(value || basicId);
    startTransition(async () => {
      const result = await setLabGate(labId, value);
      if (!result.ok) {
        setCurrent(previous);
        if (result.error !== "unchanged") onError(result.error);
        return;
      }
      onSaved(format(g.saved, { name: gate.options.find((o) => o.id === (value || basicId))?.name ?? "" }));
      router.refresh();
    });
  }

  return (
    <span className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="text-[13px] font-bold text-fg-2">
          {g.label}
        </label>
        <select
          id={id}
          value={current === basicId ? "" : (current ?? "")}
          disabled={!canPublish || pending}
          onChange={(e) => change(e.target.value)}
          className="h-10 max-w-full min-w-0 rounded-[10px] border border-line bg-canvas px-2.5 text-sm text-fg disabled:opacity-70"
        >
          {gate.options.map((option, i) => (
            // Temel eğitim boş değerle gider: temel eğitim değişirse oda yeni temele bağlı kalır.
            <option key={option.id} value={i === 0 ? "" : option.id}>
              {i === 0 ? format(g.basic, { name: option.name }) : option.name}
            </option>
          ))}
        </select>
      </span>
      <span className="text-xs text-fg-4">{g.hint}</span>
    </span>
  );
}
