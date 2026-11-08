"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { useRevealSelected } from "@/components/common/ScrollStrip";
import { applicationTabs, applicationsHref, matchesSearch, type ApplicationActionError } from "@/lib/admin/application-rules";
import { undoApplicationDecision } from "@/lib/admin/application-actions";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { nextToast, UndoToast, type ToastData } from "../UndoToast";
import { ApplicationDetailView, type Decision } from "./ApplicationDetail";
import { ApplicationList } from "./ApplicationList";
import type { ApplicationsBoard } from "./types";

const desktopQuery = "(min-width: 1024px)";

/**
 * Talepler-Son: sekmeler (Bekleyen / Bilgi istendi / Onaylanan / Reddedilen), arama, liste ve
 * seçili talebin ayrıntısı. Sekme ve seçili talep adreste durur; seçim değişince sayfanın verisi
 * sunucudan yeniden gelir (istemcideki durum, ör. arama, kalır). Masaüstünde ayrıntı sağda;
 * telefonda adreste talep varsa sağdan kayan tam sayfa olarak açılır. Her karardan sonra
 * 5 saniyelik "Geri al".
 */
export function ApplicationsScreen({ board }: { board: ApplicationsBoard }) {
  const t = getMessages().adminApplications;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<ToastData | null>(null);
  const tabStrip = useRevealSelected<HTMLDivElement>(board.tab);
  const [, startTransition] = useTransition();

  const rows = board.rows.filter((row) => matchesSearch(row, query));
  const selected = board.selected;

  const say = (message: string, undo?: () => void) => setToast(nextToast({ message, undo }));
  const fail = (error: ApplicationActionError) => setToast(nextToast({ message: t.errors[error], tone: "error" }));

  /**
   * Karar verildi: talep bu sekmeden çıkar. Masaüstünde sıradaki talep açılır, telefonda listeye
   * dönülür. "Geri al" talebi önceki sekmesinde yeniden açar.
   */
  function decided(decision: Decision, message: string) {
    const fromTab = board.tab;
    const ids = board.rows.map((r) => r.id);
    const at = ids.indexOf(decision.id);
    const rest = [...ids.slice(at + 1), ...ids.slice(0, Math.max(0, at))].filter((id) => id !== decision.id);
    const desktop = window.matchMedia(desktopQuery).matches;
    router.replace(applicationsHref(fromTab, desktop ? (rest[0] ?? null) : null), { scroll: false });
    say(message, () =>
      startTransition(async () => {
        try {
          const result = await undoApplicationDecision(decision.id);
          if (!result.ok) return fail(result.error);
          say(decision.kind === "info" ? t.toasts.undoneInfo : t.toasts.undone);
          router.replace(applicationsHref(fromTab, decision.id), { scroll: false });
        } catch {
          fail("failed");
        }
      }),
    );
  }

  return (
    <main className="flex flex-col gap-4 px-4 pt-6 pb-16 lg:gap-[22px] lg:px-9 lg:pt-8 lg:pb-[72px]">
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 font-heading text-[26px] leading-[1.1] font-bold lg:text-[34px]">{t.title}</h1>
        <p className="m-0 max-w-[640px] text-sm leading-[1.55] text-fg-3 lg:text-[15px]">{t.intro}</p>
      </div>

      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div ref={tabStrip} role="tablist" aria-label={t.tabsLabel} className="flex flex-none gap-2 overflow-x-auto border-b border-line lg:gap-3">
          {applicationTabs.map((tab) => {
            const on = tab === board.tab;
            const count = board.counts[tab];
            return (
              <Link
                key={tab}
                role="tab"
                aria-selected={on}
                href={applicationsHref(tab)}
                scroll={false}
                prefetch={false}
                className={cn(
                  "inline-flex h-11 flex-none items-center gap-2 border-b-2 px-1.5 text-sm font-bold no-underline transition-colors lg:px-3.5 lg:text-[15px]",
                  on ? "border-accent text-fg" : "border-transparent text-fg-3 hover:text-fg",
                )}
              >
                {t.tabs[tab]}
                <span
                  className={cn(
                    "inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs",
                    tab === "pending" && !on && count > 0 ? "bg-warning text-on-warning" : "bg-card text-fg-2",
                  )}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </div>
        <label className="relative block lg:max-w-[360px] lg:flex-[1_1_240px]">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[17px] -translate-y-1/2 text-fg-4" strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t.search}
            placeholder={t.searchPlaceholder}
            className="h-11 w-full rounded-xl border border-line bg-canvas pr-3.5 pl-10 text-base text-fg placeholder:text-fg-4"
          />
        </label>
      </div>

      {/* Telefonda tek sütun minmax(0,1fr): kısaltılan uzun adlar sütunu genişletmesin. */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
        <ApplicationList
          tab={board.tab}
          rows={rows}
          selectedId={selected?.id ?? null}
          searching={query.trim().length > 0}
          limit={board.limit}
        />
        {selected ? (
          <DetailPane board={board} onBack={() => router.push(applicationsHref(board.tab), { scroll: false })}>
            <ApplicationDetailView key={selected.id} app={selected} onDecided={decided} onToast={say} onError={fail} />
          </DetailPane>
        ) : (
          <div className="hidden rounded-[20px] border border-line bg-surface px-4 py-10 text-center text-[15px] text-fg-3 lg:block">{t.pickOne}</div>
        )}
      </div>

      <UndoToast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}

/**
 * Ayrıntının çerçevesi: masaüstünde sağdaki yapışkan kutu; telefonda adreste talep varsa tam
 * sayfa (üstte "Talepler" ile listeye dönüş ve durum), yoksa gizli.
 */
function DetailPane({ board, onBack, children }: { board: ApplicationsBoard; onBack: () => void; children: ReactNode }) {
  const t = getMessages().adminApplications;
  const selected = board.selected!;
  const back = useRef<HTMLAnchorElement>(null);
  const page = board.explicit;

  // Telefonda sayfa açılınca odak "Talepler" düğmesine gelir.
  useEffect(() => {
    if (page && !window.matchMedia(desktopQuery).matches) back.current?.focus({ preventScroll: true });
  }, [page, selected.id]);

  return (
    <section
      aria-label={format(t.detailLabel, { name: selected.name })}
      onKeyDown={(e) => {
        if (e.key === "Escape" && page && !window.matchMedia(desktopQuery).matches) onBack();
      }}
      className={cn(
        "lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-32px)] lg:overflow-y-auto lg:rounded-[20px] lg:border lg:border-line lg:bg-surface lg:p-6",
        page
          ? "max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:flex max-lg:flex-col max-lg:bg-canvas max-lg:[animation:slide-in-page_.3s_cubic-bezier(.2,.8,.2,1)_both]"
          : "max-lg:hidden",
      )}
    >
      <div className="flex flex-none items-center gap-2 border-b border-card p-3 lg:hidden">
        <Link
          ref={back}
          href={applicationsHref(board.tab)}
          scroll={false}
          prefetch={false}
          className="inline-flex h-10 items-center gap-1 rounded-xl border border-line bg-surface pr-3 pl-1.5 text-sm font-bold text-fg no-underline"
        >
          <ChevronLeft className="size-[18px]" strokeWidth={2} aria-hidden="true" />
          {t.back}
        </Link>
        <span className="ml-auto text-xs font-bold text-fg-3">{t.status[selected.status]}</span>
      </div>
      <div className="max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-y-auto max-lg:px-4 max-lg:pt-[18px] max-lg:pb-8">{children}</div>
    </section>
  );
}
