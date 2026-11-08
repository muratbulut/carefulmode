"use client";

import { Award, ChevronLeft, ChevronRight, KeyRound, Moon, Pencil, Trash2, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Toast } from "@/components/status/Toast";
import { avatars } from "@/lib/avatars";
import { brand } from "@/lib/brand";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AccountSection } from "./AccountSection";
import { AppearanceSection } from "./AppearanceSection";
import { AvatarSection } from "./AvatarSection";
import { BadgesSection } from "./BadgesSection";
import { DeleteSection } from "./DeleteSection";
import { LevelBar, LevelPill, PointsPill } from "./LevelSummary";
import { SecuritySection } from "./SecuritySection";
import { sectionKeys, type ProfileProgress, type ProfileSession, type ProfileUser, type SectionKey } from "./types";
import { UserAvatar } from "./UserAvatar";

const menuIcons = {
  account: Pencil,
  badges: Award,
  avatar: User,
  appearance: Moon,
  security: KeyRound,
  delete: Trash2,
} as const;

const DESKTOP = "(min-width: 1024px)";

/**
 * Profil (Tur 2, ekran 16, P2 ayarlar menüsü; tahta: Profil-P2-Son, Profil-P2-Son-Mobil).
 * Masaüstünde solda menü, sağda seçili bölüm. Telefonda liste; dokununca bölüm sağdan kayan
 * bir sayfada açılır, tarayıcının geri tuşu listeye döner.
 */
export function ProfileView({
  user,
  progress,
  sessions,
  initialSection,
  openSection = false,
  notice,
}: {
  user: ProfileUser;
  progress: ProfileProgress;
  sessions: ProfileSession[];
  initialSection: SectionKey;
  /** Adreste bölüm istendiyse (/profil?bolum=...) telefonda da o bölümün sayfası açık gelir. */
  openSection?: boolean;
  notice: string | null;
}) {
  const t = getMessages().profile;
  const m = getMessages().progress;
  const earnedCount = progress.badges.filter((b) => b.earned).length;
  const [section, setSection] = useState<SectionKey>(initialSection);
  // Telefonda açık olan bölüm sayfası.
  const [page, setPage] = useState<SectionKey | null>(null);
  const [toast, setToast] = useState<string | null>(notice);
  const backButton = useRef<HTMLButtonElement>(null);
  const avatar = avatars.find((a) => a.code === user.avatar) ?? avatars[0];
  const subtitle = user.gradeLevel ? format(t.subtitle, { grade: user.gradeLevel, since: user.memberSince }) : user.memberSince;

  // Bölüm sayfası açılınca odak "Profil" (geri) düğmesine gelir.
  useEffect(() => {
    if (page) backButton.current?.focus();
  }, [page]);

  // Telefonda açılan bölüm geçmişe yazılır; geri tuşu sayfayı kapatır, siteden çıkarmaz.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => setPage((e.state as { profilePage?: SectionKey } | null)?.profilePage ?? null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Bağlantıyla gelinen bölüm telefonda doğrudan açılır (geri tuşu listeye döner).
  useEffect(() => {
    if (!openSection || window.matchMedia(DESKTOP).matches) return;
    const frame = requestAnimationFrame(() => {
      window.history.pushState({ profilePage: initialSection }, "");
      setPage(initialSection);
    });
    return () => cancelAnimationFrame(frame);
  }, [openSection, initialSection]);

  // Telefon düzeninden masaüstüne geçilirse (pencere büyütülünce) açık sayfa sağ sütuna taşınır.
  useEffect(() => {
    const query = window.matchMedia(DESKTOP);
    const onChange = () => {
      if (!query.matches) return;
      setPage((open) => {
        if (open) setSection(open);
        return null;
      });
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  function openPage(key: SectionKey) {
    if (window.matchMedia(DESKTOP).matches) {
      setSection(key);
      return;
    }
    window.history.pushState({ profilePage: key }, "");
    setPage(key);
  }

  function closePage() {
    if ((window.history.state as { profilePage?: SectionKey } | null)?.profilePage) window.history.back();
    else setPage(null);
  }

  function renderSection(key: SectionKey) {
    switch (key) {
      case "account":
        return <AccountSection user={user} onDone={setToast} />;
      case "badges":
        return <BadgesSection badges={progress.badges} showcase={progress.showcase} onDone={setToast} />;
      case "avatar":
        return <AvatarSection current={user.avatar} onDone={setToast} />;
      case "appearance":
        return <AppearanceSection onDone={setToast} />;
      case "security":
        return <SecuritySection name={user.name} email={user.email} sessions={sessions} onDone={setToast} />;
      case "delete":
        return <DeleteSection deletionOn={user.deletionOn} onDone={setToast} />;
    }
  }

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 pt-4 pb-28 lg:gap-5 lg:px-6 lg:pt-8 lg:pb-16">
      {/* Profil kartı */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface-raised p-4 lg:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgb(34_211_238/0.10),transparent_60%)]" />
        <div className="relative flex items-center gap-4 lg:gap-6">
          <div className="relative flex-none">
            <UserAvatar emoji={avatar.emoji} ring className="size-[84px] text-[44px] lg:size-[110px] lg:text-[58px]" />
            {/* Kalem rozeti 32 px görünür; ::after dokunma alanını 40 px'e çıkarır. */}
            <button
              type="button"
              onClick={() => openPage("avatar")}
              aria-label={t.editAvatar}
              className="absolute -right-0.5 -bottom-0.5 flex size-8 cursor-pointer items-center justify-center rounded-full border-[3px] border-surface-raised bg-accent text-on-accent after:absolute after:-inset-[7px] after:rounded-full"
            >
              <Pencil className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[11px] font-bold tracking-[1.2px] text-accent-fg">{format(t.eyebrow, { brand: brand.name.toLocaleUpperCase("tr") })}</p>
            <h1 className="font-heading text-[26px] leading-tight font-bold break-words lg:text-4xl">{user.name}</h1>
            <p className="text-sm text-fg-2 lg:text-[15px]">{subtitle}</p>
            <div className="mt-1 hidden flex-wrap gap-2 sm:flex">
              <LevelPill level={progress.level.level} />
              <PointsPill points={progress.level.points} />
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2 sm:hidden">
          <LevelPill level={progress.level.level} />
          <PointsPill points={progress.level.points} />
        </div>
        <LevelBar level={progress.level} className="relative mt-4" />
        <ul aria-label={getMessages().home.statsLabel} className="relative mt-4 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 lg:gap-x-9">
          {(["labsDone", "cardsRead", "reports"] as const).map((key) => (
            <li key={key} className="flex flex-col">
              <span className="font-heading text-lg font-bold lg:text-[22px]">{progress.stats[key]}</span>
              <span className="text-xs text-fg-3">{m.stats[key]}</span>
            </li>
          ))}
          <li className="flex flex-col">
            <span className="font-heading text-lg font-bold lg:text-[22px]">{format(m.badgesCount, { n: earnedCount, total: progress.badges.length })}</span>
            <span className="text-xs text-fg-3">{m.stats.badges}</span>
          </li>
        </ul>
      </section>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
        {/* Masaüstü menüsü */}
        <nav aria-label={t.sectionsLabel} className="hidden w-[280px] flex-none flex-col gap-1 rounded-[20px] border border-line bg-surface p-3.5 lg:flex">
          <div className="mb-2 flex items-center gap-3 border-b border-card px-1 pb-3.5">
            <UserAvatar emoji={avatar.emoji} ring className="size-12 text-2xl" />
            <span className="flex min-w-0 flex-col">
              <b className="truncate text-base">{user.name}</b>
              <span className="truncate text-xs text-fg-3">{user.email}</span>
            </span>
          </div>
          {sectionKeys.map((key) => {
            const Icon = menuIcons[key];
            const on = key === section;
            return (
              <button
                key={key}
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => setSection(key)}
                className={cn(
                  "flex h-11 cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-left text-[15px] font-bold transition-colors",
                  on ? "bg-card text-fg" : "text-fg-2 hover:bg-surface-deep",
                  key === "delete" && "text-danger-fg",
                )}
              >
                <Icon className="size-[17px]" strokeWidth={2} aria-hidden="true" />
                {t.sections[key]}
              </button>
            );
          })}
        </nav>

        {/* Telefon listesi */}
        <nav aria-label={t.sectionsLabel} className="overflow-hidden rounded-[20px] border border-line bg-surface lg:hidden">
          <ul className="divide-y divide-card">
            {sectionKeys.map((key) => {
              const Icon = menuIcons[key];
              const scheduled = key === "delete" && user.deletionOn;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => openPage(key)}
                    className={cn(
                      "flex min-h-[54px] w-full cursor-pointer items-center gap-3 px-3.5 py-2 text-left",
                      key === "delete" ? "text-danger-fg" : "text-fg",
                    )}
                  >
                    <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-surface-deep">
                      <Icon className="size-[18px]" strokeWidth={2} aria-hidden="true" />
                    </span>
                    <span className="flex flex-1 flex-col">
                      <b className="text-base">{t.sections[key]}</b>
                      {scheduled ? <span className="text-xs font-medium text-fg-3">{format(t.delete.scheduledShort, { date: scheduled })}</span> : null}
                    </span>
                    <ChevronRight className="size-[18px] text-fg-4" strokeWidth={2} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Masaüstünde seçili bölüm. Telefonda bölüm sayfası açıkken çizilmez (aynı alan iki kez olmasın). */}
        <div className="hidden min-w-0 flex-1 lg:block">{page ? null : <div key={section}>{renderSection(section)}</div>}</div>
      </div>

      {page ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas motion-safe:[animation:slide-in-page_.28s_cubic-bezier(.2,.8,.2,1)_both] lg:hidden">
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-card bg-canvas-translucent px-4 py-3 backdrop-blur-[10px]">
            <button
              ref={backButton}
              type="button"
              onClick={closePage}
              className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-xl border border-line bg-surface pr-3 pl-2 text-sm font-bold text-fg"
            >
              <ChevronLeft className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
              {t.back}
            </button>
            <b className="text-[17px]">{t.sections[page]}</b>
          </div>
          <div className="px-4 pt-4 pb-10">{renderSection(page)}</div>
        </div>
      ) : null}

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
