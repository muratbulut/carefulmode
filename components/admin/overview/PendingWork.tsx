"use client";

import Link from "next/link";
import { AlarmClock, Check, ChevronRight } from "lucide-react";
import { createContext, use, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { PendingCard, PendingKey } from "@/lib/admin/overview-model";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { nextToast, UndoToast, type ToastData } from "../UndoToast";

// "Bugün değil": kart o gün bu kişi için saklanır. Seçim yalnızca bu tarayıcıda durur
// (localStorage); anahtar kişiye ve Türkiye gününe bağlıdır, ertesi gün kart kendiliğinden geri
// gelir. Tarayıcı depolamaya izin vermezse seçim sayfa açık kaldıkça bellekte durur.

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readStorage(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStorage(key: string, keys: PendingKey[]): boolean {
  try {
    if (keys.length) window.localStorage.setItem(key, JSON.stringify(keys));
    else window.localStorage.removeItem(key);
    listeners.forEach((listener) => listener());
    return true;
  } catch {
    return false;
  }
}

/** Önceki günlerin seçimlerini siler (anahtar: "<önek>.<gün>"). */
function forgetOldDays(key: string) {
  try {
    const prefix = key.slice(0, key.lastIndexOf(".") + 1);
    const storage = window.localStorage;
    for (let i = storage.length - 1; i >= 0; i--) {
      const name = storage.key(i);
      if (name && name !== key && name.startsWith(prefix)) storage.removeItem(name);
    }
  } catch {
    // Depolama kapalıysa silinecek bir şey de yok.
  }
}

function parse(value: string): PendingKey[] {
  try {
    const list: unknown = JSON.parse(value);
    return Array.isArray(list) ? list.filter((x): x is PendingKey => typeof x === "string") : [];
  } catch {
    return [];
  }
}

type Pending = { visible: PendingCard[]; snooze: (card: PendingCard) => void };

const PendingContext = createContext<Pending | null>(null);

function usePending(): Pending {
  const value = use(PendingContext);
  if (!value) throw new Error("PendingProvider missing");
  return value;
}

export function PendingProvider({ cards, storageKey, children }: { cards: PendingCard[]; storageKey: string; children: ReactNode }) {
  const t = getMessages().adminOverview;
  // Sunucuda ve ilk çizimde bütün kartlar görünür; tarayıcıdaki seçim hemen ardından uygulanır.
  const stored = useSyncExternalStore(subscribe, () => readStorage(storageKey), () => "");
  const [memory, setMemory] = useState<PendingKey[] | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const hidden = memory ?? parse(stored);

  useEffect(() => forgetOldDays(storageKey), [storageKey]);

  function setHidden(keys: PendingKey[]) {
    if (!writeStorage(storageKey, keys)) setMemory(keys);
  }

  function snooze(card: PendingCard) {
    const before = hidden;
    setHidden([...before.filter((k) => k !== card.key), card.key]);
    setToast(nextToast({ message: format(t.snoozed, { title: card.title }), undo: () => setHidden(before) }));
  }

  const visible = cards.filter((card) => !hidden.includes(card.key));
  return (
    <PendingContext value={{ visible, snooze }}>
      {children}
      <UndoToast toast={toast} onClose={() => setToast(null)} />
    </PendingContext>
  );
}

/** Başlığın altındaki cümle: "Seni bekleyen 3 iş var. Sayılar aşağıda." */
export function PendingHeadline() {
  const t = getMessages().adminOverview;
  const { visible } = usePending();
  return (
    <p className="m-0 max-w-[640px] text-sm leading-[1.55] text-fg-3 lg:text-[15px]">
      {visible.length ? format(t.todoHead, { n: visible.length }) : t.noTodoHead}
    </p>
  );
}

const tones: Record<PendingKey, string> = {
  applications: "bg-warning/12 text-warning-fg",
  news: "bg-accent/12 text-accent-fg",
  labs: "bg-purple/12 text-purple-fg",
  notes: "bg-pink/12 text-pink-fg",
};

/** Bekleyen iş kartları (Ozet-Son); hepsi bitince ya da saklanınca "Bugünlük bekleyen iş kalmadı." */
export function PendingCards() {
  const t = getMessages().adminOverview;
  const { visible, snooze } = usePending();

  if (visible.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-[18px] border border-dashed border-success/50 p-[18px] text-[15px] font-bold text-success-fg">
        <Check className="size-5 flex-none" strokeWidth={2.6} aria-hidden="true" />
        {t.allDone}
      </div>
    );
  }

  return (
    <section aria-label={t.pendingLabel}>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {visible.map((card) => (
          <li
            key={card.key}
            data-testid={`pending-${card.key}`}
            className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-4 motion-safe:[animation:fade-in_.25s_ease-out_both] lg:flex-row lg:items-center lg:gap-[18px] lg:p-5"
          >
            <span className="flex min-w-0 flex-1 items-start gap-3.5">
              <span
                aria-hidden="true"
                className={cn("flex size-11 flex-none items-center justify-center rounded-[14px] font-heading text-[22px] font-bold", tones[card.key])}
              >
                {card.count.toLocaleString("tr-TR")}
              </span>
              <span className="flex min-w-0 flex-col gap-[3px]">
                <b className="text-[15px] leading-snug lg:text-[17px]">{card.title}</b>
                <span className="text-[13px] leading-[1.45] text-fg-3">{card.sub}</span>
              </span>
            </span>
            <span className="flex flex-none gap-2">
              <button
                type="button"
                onClick={() => snooze(card)}
                aria-label={format(t.snoozeLabel, { title: card.title })}
                className="inline-flex h-[42px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-line bg-transparent px-3 text-sm font-bold text-fg-3 hover:text-fg lg:flex-none"
              >
                <AlarmClock className="size-4" strokeWidth={2} aria-hidden="true" />
                {t.snooze}
              </button>
              <Link
                href={card.href}
                className="inline-flex h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-card px-3.5 text-sm font-bold text-fg no-underline hover:border-line-strong lg:flex-none"
              >
                {card.go}
                <ChevronRight className="size-4" strokeWidth={2} aria-hidden="true" />
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
