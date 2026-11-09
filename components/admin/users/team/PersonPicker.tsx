"use client";

import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { Spinner } from "@/components/status/Spinner";
import type { PersonKind } from "@/lib/admin/team-rules";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type PickablePerson = { id: string; name: string; email: string; avatar: string; kind: PersonKind };

// Kişinin türünün rengi (Kullanicilar-Son: öğrenci pembe, öğretmen camgöbeği, yönetici sarı, üye gri).
const kindColor: Record<PersonKind, string> = {
  student: "text-danger-fg",
  teacher: "text-accent-fg",
  admin: "text-warning-fg",
  member: "text-fg-3",
};

/**
 * Kişi seçimi: arama kutusu ve sonuçlar (radyo düğmeleri). Seçili kişiye yeniden dokunmak
 * seçimi kaldırır. Arama ve sonuçlar usePersonSearch'ten gelir.
 */
export function PersonPicker<P extends PickablePerson>({
  label,
  inputId,
  query,
  onQuery,
  people,
  loading,
  pickedId,
  onPick,
  hint,
  empty,
  note,
}: {
  label: ReactNode;
  inputId: string;
  query: string;
  onQuery: (value: string) => void;
  people: P[] | null;
  loading: boolean;
  pickedId: string | null;
  onPick: (person: P | null) => void;
  /** Arama yapılmadan önceki açıklama (en az 3 harf). */
  hint: string;
  /** Sonuç yoksa. */
  empty: string;
  /** Kişinin satırına eklenecek kısa not (ör. "Şu anki sorumlu"). */
  note?: (person: P) => string | null;
}) {
  const t = getMessages().adminTeam;
  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={inputId} className="text-sm font-bold text-fg-2">
        {label}
      </label>
      <span className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-fg-4" strokeWidth={2} aria-hidden="true" />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t.search.placeholder}
          autoComplete="off"
          spellCheck={false}
          maxLength={80}
          data-autofocus
          className="h-[46px] w-full rounded-xl border border-line bg-canvas pr-3.5 pl-[42px] text-[15px] text-fg placeholder:text-fg-4"
        />
      </span>
      {loading ? (
        <span role="status" className="inline-flex items-center gap-2 text-[13px] text-fg-3">
          <Spinner />
          {t.search.searching}
        </span>
      ) : people === null ? (
        <span className="text-[13px] text-fg-3">{hint}</span>
      ) : people.length === 0 ? (
        <span className="text-[13px] text-fg-3">{empty}</span>
      ) : (
        <div role="radiogroup" aria-label={t.search.results} className="flex flex-col gap-2">
          {people.map((person) => {
            const on = person.id === pickedId;
            const extra = note?.(person);
            return (
              <button
                key={person.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onPick(on ? null : person)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-fg transition-colors",
                  on ? "border-accent bg-card" : "border-line bg-surface-deep hover:border-line-strong",
                )}
              >
                <span aria-hidden="true" className="flex size-[34px] flex-none items-center justify-center rounded-full border border-line bg-card text-[17px]">
                  {person.avatar}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <b className="text-sm">{person.name}</b>
                  <span className="text-xs [overflow-wrap:anywhere] text-fg-4">{person.email}</span>
                </span>
                <span className="flex flex-none flex-col items-end gap-0.5">
                  <span className={cn("text-xs font-bold", kindColor[person.kind])}>{t.kinds[person.kind]}</span>
                  {extra ? <span className="text-[11px] text-fg-4">{extra}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
