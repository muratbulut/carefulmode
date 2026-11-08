"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Activity,
  FlaskConical,
  GraduationCap,
  LayoutGrid,
  Lightbulb,
  LogIn,
  Menu,
  Newspaper,
  ScrollText,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { activeMenuKey, adminMenu, type AdminMenuKey } from "@/lib/admin/menu";
import { Wordmark } from "@/lib/brand";
import { format, getMessages } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";

// Yönetim menüsü (Tur 5 kapanış sırası; izinler lib/admin/menu.ts). Sorumlu yalnızca izni olan
// sayfaları görür.
const icons: Record<AdminMenuKey, LucideIcon> = {
  overview: LayoutGrid,
  pulse: Activity,
  applications: GraduationCap,
  users: Users,
  labs: FlaskConical,
  tips: Lightbulb,
  news: Newspaper,
  audit: ScrollText,
};

export type AdminUser = { name: string; avatar: string; isAdmin: boolean };

/** Menüde görünen sayfalar ve sayı rozetleri (bekleyen öğretmen talebi). */
export type AdminNav = { items: AdminMenuKey[]; badges: Partial<Record<AdminMenuKey, number>> };

/**
 * Yönetim panelinin çerçevesi: masaüstünde solda menü, telefonda üst çubuk ve soldan açılan
 * menü (Lablar-Son-Mobil). Lab önizlemesi (/onizle) öğrencinin tam ekran oynatıcısıdır; çerçeve
 * çizilmez, erişim denetimi yine yerleşimde yapılır (app/yonetim/layout.tsx).
 */
export function AdminShell({ user, nav, children }: { user: AdminUser; nav: AdminNav; children: ReactNode }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  if (pathname.endsWith("/onizle")) return <>{children}</>;

  const t = getMessages().admin;
  const current = activeMenuKey(pathname) ?? "overview";
  const pending = Object.values(nav.badges).some((n) => n && n > 0);

  return (
    <div className="flex min-h-dvh bg-canvas text-fg">
      <aside className="sticky top-0 hidden h-dvh w-[248px] flex-none flex-col gap-1.5 overflow-y-auto border-r border-card bg-surface-deep px-3.5 py-5 lg:flex">
        <SidebarContent user={user} nav={nav} current={current} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-card bg-surface-deep px-3.5 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label={t.openMenu}
            aria-expanded={drawer}
            className="relative flex size-[42px] flex-none items-center justify-center rounded-xl border border-line bg-surface text-fg"
          >
            <Menu className="size-5" strokeWidth={2} aria-hidden="true" />
            {/* Bekleyen iş varsa amber nokta (Ozet-Son-Mobil). */}
            {pending ? <span aria-hidden="true" className="absolute top-2 right-2 size-2 rounded-full bg-warning" /> : null}
          </button>
          <span className="flex min-w-0 flex-col">
            <span className="text-[11px] font-bold tracking-[1.5px] text-warning-fg">{t.kicker}</span>
            <span className="truncate text-[17px] font-bold">{t.menu[current]}</span>
          </span>
          <UserAvatar emoji={user.avatar} className="ml-auto size-9 text-lg" />
        </header>
        {children}
      </div>

      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Perdeye dokunmak menüyü kapatır; klavyede kapatma düğmesi ve Escape var. */}
          <div aria-hidden="true" onClick={() => setDrawer(false)} className="absolute inset-0 bg-scrim [animation:fade-in_.2s_ease-out_both]" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.menuLabel}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDrawer(false);
            }}
            className="absolute inset-y-0 left-0 flex w-[min(300px,86vw)] flex-col gap-1.5 overflow-y-auto border-r border-card bg-surface-deep px-3.5 py-5 shadow-floating [animation:admin-drawer-in_.3s_cubic-bezier(.2,.8,.2,1)_both]"
          >
            <button
              type="button"
              onClick={() => setDrawer(false)}
              aria-label={t.closeMenu}
              autoFocus
              className="absolute top-4 right-3 flex size-9 items-center justify-center rounded-xl text-fg-3 hover:text-fg"
            >
              <X className="size-5" strokeWidth={2} aria-hidden="true" />
            </button>
            <SidebarContent user={user} nav={nav} current={current} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SidebarContent({
  user,
  nav,
  current,
  onNavigate,
}: {
  user: AdminUser;
  nav: AdminNav;
  current: AdminMenuKey;
  onNavigate?: () => void;
}) {
  const t = getMessages().admin;
  return (
    <>
      <div className="flex items-center gap-2.5 px-2 pb-[18px]">
        <span className="flex flex-col gap-1.5">
          <Wordmark labelled className="h-[15px] w-auto" />
          <span className="text-[11px] font-bold tracking-[1.5px] text-warning-fg">{t.kicker}</span>
        </span>
      </div>
      <nav aria-label={t.menuLabel} className="flex flex-col gap-0.5">
        {adminMenu
          .filter((m) => nav.items.includes(m.key))
          .map(({ key, href }) => {
            const Icon = icons[key];
            const label = t.menu[key];
            const active = key === current;
            const badge = nav.badges[key] ?? 0;
            return (
              <Link
                key={key}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                aria-label={badge > 0 ? format(t.menuBadgeLabel, { page: label, count: badge }) : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] no-underline transition-colors",
                  active ? "bg-card font-bold text-fg shadow-[inset_3px_0_0_var(--accent)]" : "font-medium text-fg-2 hover:bg-surface",
                )}
              >
                <Icon className={cn("size-[18px] flex-none", active && "text-accent-fg")} strokeWidth={2} aria-hidden="true" />
                <span className="flex-1">{label}</span>
                {badge > 0 ? (
                  <span aria-hidden="true" className="min-w-6 rounded-full bg-warning px-1.5 py-0.5 text-center text-xs font-bold text-on-warning">
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
      </nav>
      <div className="mt-auto flex flex-col gap-2.5 border-t border-card px-2 pt-3.5">
        <span className="flex items-center gap-2.5">
          <UserAvatar emoji={user.avatar} className="size-9 text-lg" />
          <span className="flex min-w-0 flex-col">
            <b className="truncate text-sm">{user.name}</b>
            <span className="text-xs text-fg-3">{user.isAdmin ? t.roles.admin : t.roles.team}</span>
          </span>
        </span>
        <Link
          href={routes.home}
          className="-my-2.5 inline-flex min-h-10 items-center gap-2 text-[13px] text-fg-3 no-underline hover:text-fg"
        >
          <LogIn className="size-4 rotate-180" strokeWidth={2} aria-hidden="true" />
          {t.backToSite}
        </Link>
      </div>
    </>
  );
}
