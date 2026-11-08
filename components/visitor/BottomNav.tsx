"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ChevronRight, CircleHelp, Ellipsis, GraduationCap, House, Mail, Map as MapIcon, Newspaper, Play, Plus, User, Users, X } from "lucide-react";
import { getMessages } from "@/lib/i18n";
import { routes, visitorNav } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const icons = { labs: Mail, teachers: GraduationCap, faq: CircleHelp } as const;

const navClass =
  "fixed inset-x-3 bottom-3.5 z-40 flex items-center rounded-[22px] border border-line bg-surface-translucent px-2 py-1 shadow-floating backdrop-blur-[10px] lg:hidden print:hidden";

const centerClass =
  "-mt-[26px] flex size-[58px] flex-none items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_10px_24px_rgb(34_211_238/0.35),0_0_0_6px_var(--canvas)]";

const tabClass =
  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold no-underline cursor-pointer bg-transparent border-0 font-[inherit]";

type TabProps = { href: string; label: string; Icon: typeof House; match: (path: string) => boolean };

function TabLink({ href, label, Icon, active }: Omit<TabProps, "match"> & { active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn(tabClass, active ? "text-accent-fg" : "text-fg-3")}>
      <Icon className="size-5" strokeWidth={1.9} aria-hidden="true" />
      {label}
    </Link>
  );
}

function ActiveTab({ match, ...props }: TabProps) {
  return <TabLink {...props} active={match(usePathname())} />;
}

/**
 * Sekme. Seçili olup olmadığı adrese bağlıdır; adres bazı sayfalarda (/oda/[oda]) istek anında
 * belli olur. Bu yüzden yalnızca sekmenin kendisi beklenir, menünün geri kalanı hemen çalışır.
 */
function Tab(props: TabProps) {
  return (
    <Suspense fallback={<TabLink {...props} active={false} />}>
      <ActiveTab {...props} />
    </Suspense>
  );
}

const isHome = (path: string) => path === routes.home;
const under = (route: string) => (path: string) => path.startsWith(route);

/**
 * Giriş yapmış kullanıcının alt menüsü (Tur 2 öğrenci menüsü): Ana sayfa, Yol haritası, ortada
 * "Kaldığın yerden devam et" (adresi sunucu verir: BottomNavSlot), Lablar, Profil. Öğretmende
 * (Tur 3): Ana sayfa, Lablar, ortada devam, Sınıflar, Profil; yol haritası ana sayfadan açılır.
 * Yalnızca bağlantıdır; sayfa yüklenirken de çalışır.
 * Gelince aynı çerçevedeki ziyaretçi menüsünü gizler (app/globals.css, data-bottom-nav).
 */
export function MemberBottomNav({ continueHref, teacher = false }: { continueHref: string; teacher?: boolean }) {
  const t = getMessages();
  return (
    <nav aria-label={t.nav.bottom} data-bottom-nav="member" className={navClass}>
      <Tab href={routes.home} label={t.nav.links.home} Icon={House} match={isHome} />
      {teacher ? (
        <Tab href={routes.labs} label={t.nav.links.labs} Icon={Mail} match={under(routes.labs)} />
      ) : (
        <Tab href={routes.roadmap} label={t.nav.links.roadmap} Icon={MapIcon} match={under(routes.roadmap)} />
      )}
      {/* Öğrencinin kaldığı lab (lib/lab/data.ts continueTarget); yoksa yol haritası. */}
      <Link href={continueHref} aria-label={t.nav.continue} className={centerClass}>
        <Play className="ml-1 size-[26px] fill-current" strokeWidth={2.2} aria-hidden="true" />
      </Link>
      {teacher ? (
        <Tab href={routes.classes} label={t.nav.classesShort} Icon={Users} match={under(routes.classes)} />
      ) : (
        <Tab href={routes.labs} label={t.nav.links.labs} Icon={Mail} match={under(routes.labs)} />
      )}
      <Tab href={routes.profile} label={t.nav.links.profile} Icon={User} match={under(routes.profile)} />
    </nav>
  );
}

/**
 * Ziyaretçi alt menüsü (Tur 5, M2), telefon ve tablet için: Ana sayfa, Yol haritası, ortada
 * Kayıt ol, Gündem ve "Daha fazla" (alttan açılan pencere). Oturuma bakmadan sayfanın statik
 * kabuğunda durur, böylece "Daha fazla" sayfa açılır açılmaz çalışır. Giriş yapmış kullanıcıda
 * yerini MemberBottomNav alır.
 */
export function BottomNav() {
  const t = getMessages();
  const dialog = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);

  // Tarayıcının geri tuşuyla başka sayfaya geçilince pencere açık kalmasın.
  useEffect(() => {
    const close = () => dialog.current?.close();
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, []);

  function openMenu() {
    setClosing(false);
    dialog.current?.showModal();
  }

  function closeMenu() {
    const d = dialog.current;
    if (!d?.open) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      d.close();
      return;
    }
    setClosing(true);
    window.setTimeout(() => {
      d.close();
      setClosing(false);
    }, 200);
  }

  return (
    <>
      <nav aria-label={t.nav.bottom} data-bottom-nav="visitor" className={navClass}>
        <Tab href={routes.home} label={t.nav.links.home} Icon={House} match={isHome} />
        <Tab href={routes.roadmap} label={t.nav.links.roadmap} Icon={MapIcon} match={under(routes.roadmap)} />
        <Link href={routes.signUp} aria-label={t.nav.links.signUp} className={centerClass}>
          <Plus className="size-[26px]" strokeWidth={2.4} aria-hidden="true" />
        </Link>
        <Tab href={routes.news} label={t.nav.links.news} Icon={Newspaper} match={under(routes.news)} />
        <button type="button" onClick={openMenu} aria-haspopup="dialog" className={cn(tabClass, "text-fg-3")}>
          <Ellipsis className="size-5" strokeWidth={1.9} aria-hidden="true" />
          {t.nav.more}
        </button>
      </nav>

      <dialog
        ref={dialog}
        aria-label={t.nav.more}
        onCancel={(e) => {
          e.preventDefault();
          closeMenu();
        }}
        onClick={(e) => {
          // Pencerenin dışına (perdeye) dokununca kapanır.
          if (e.target === e.currentTarget) closeMenu();
        }}
        className={cn(
          "m-0 mt-auto w-full max-w-full rounded-t-3xl border-0 border-t border-line bg-surface-deep p-0 text-fg backdrop:bg-scrim lg:hidden",
          closing
            ? "[animation:slide-up_.2s_ease-in_reverse_both] backdrop:[animation:fade-in_.2s_ease-in_reverse_both]"
            : "open:[animation:slide-up_.28s_cubic-bezier(.2,.8,.2,1)_both] backdrop:[animation:fade-in_.2s_ease-out_both]",
        )}
      >
        <div className="flex flex-col gap-3 px-4 pt-3.5 pb-[22px]">
          <span aria-hidden="true" className="h-[5px] w-10 self-center rounded-full bg-line-strong" />
          <div className="flex items-center justify-between">
            <b className="text-[17px]">{t.nav.more}</b>
            <button
              type="button"
              onClick={closeMenu}
              aria-label={t.nav.closeMenu}
              className="flex size-10 flex-none cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-fg"
            >
              <X className="size-5" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          {visitorNav.more.map((key) => {
            const Icon = icons[key];
            return (
              <Link
                key={key}
                href={routes[key]}
                onClick={closeMenu}
                className="flex items-center gap-3 rounded-[14px] border border-line bg-surface p-3 text-fg no-underline"
              >
                <Icon className="size-5 text-accent-fg" strokeWidth={2} aria-hidden="true" />
                <span className="flex flex-1 flex-col gap-0.5">
                  <b className="text-[15px]">{t.nav.links[key]}</b>
                  <span className="text-xs text-fg-3">{t.nav.hints[key]}</span>
                </span>
                <ChevronRight className="size-4 text-fg-4" strokeWidth={2} aria-hidden="true" />
              </Link>
            );
          })}
          <Link
            href={routes.signIn}
            onClick={closeMenu}
            className="flex h-12 items-center justify-center rounded-xl border border-line text-[15px] font-bold text-fg no-underline"
          >
            {t.nav.links.signIn}
          </Link>
          {/* Bağlantılar 40 px yüksek: parmakla dokunulabilsin. */}
          <span className="flex flex-wrap gap-x-3.5 text-[13px]">
            {visitorNav.legal.map((key) => (
              <Link key={key} href={routes[key]} onClick={closeMenu} className="inline-flex min-h-10 items-center text-fg-4 no-underline">
                {t.nav.links[key]}
              </Link>
            ))}
          </span>
        </div>
      </dialog>
    </>
  );
}
