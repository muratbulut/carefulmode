import Link from "next/link";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { getAdminAccess } from "@/lib/admin/access";
import { avatarOf } from "@/lib/avatars";
import { Wordmark, brand } from "@/lib/brand";
import { format, getMessages } from "@/lib/i18n";
import { memberNav, routes, visitorNav, type NavKey } from "@/lib/navigation";
import { getUser } from "@/lib/session";
import { getTeacherAccess } from "@/lib/teacher/access";
import { AccountMenu } from "./AccountMenu";

const linkClass =
  "inline-flex h-10 items-center rounded-[10px] px-2.5 text-base font-medium text-fg-2 no-underline transition-colors hover:bg-surface hover:text-fg xl:px-3";

/**
 * Üst menü. Ziyaretçide masaüstünde (lg ve üstü) bütün menü, telefonda ve tablette sadece logo,
 * "Giriş yap" ve tema düğmesi; menünün geri kalanı alttaki M2 menüsünde. Giriş yapmış
 * kullanıcıda masaüstünde Ana sayfa, Yol haritası, Lablar, Gündem (öğretmende Sınıflarım, okul
 * sorumlusunda Okulum da); her boyutta avatar ve tema düğmesi.
 */
export function TopNav() {
  const t = getMessages();
  return (
    <header className="relative z-30 border-b border-card bg-canvas-translucent print:hidden">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3.5 lg:px-6 lg:py-4">
        <Link href={routes.home} className="-my-1.5 flex items-center gap-2 py-1.5 text-fg no-underline lg:gap-2.5" aria-label={format(t.site.homeLink, { brand: brand.name })}>
          <Wordmark className="h-[15px] w-auto lg:h-[18px]" />
        </Link>
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Oturum isteğe göre okunur; o gelene kadar (ve ziyaretçide) ziyaretçi menüsü görünür. */}
          <Suspense fallback={<VisitorActions />}>
            <AccountActions />
          </Suspense>
          {/* Tema düğmesi oturumdan bağımsızdır: statik kabukta durur, sayfa açılır açılmaz çalışır. */}
          <ThemeToggle className="size-10 lg:size-11" />
        </div>
      </div>
    </header>
  );
}

async function AccountActions() {
  const user = await getUser();
  if (!user) return <VisitorActions />;
  const t = getMessages();
  // Öğretmende Sınıflarım, okul sorumlusunda ayrıca Okulum (rol veritabanından okunur).
  const [teacher, admin] = await Promise.all([user.role === "STUDENT" ? null : getTeacherAccess(), getAdminAccess()]);
  const keys = teacher?.coordinatedSchoolId ? memberNav.coordinator : teacher ? memberNav.teacher : memberNav.top;
  return (
    <>
      <NavLinks keys={keys} label={t.nav.main} />
      {/* Telefonda avatar tema düğmesinin sağında, masaüstünde solunda. */}
      <div className="max-lg:order-last">
        <AccountMenu name={user.name} email={user.email} emoji={avatarOf({ id: user.id, avatar: user.image }).emoji} admin={admin !== null} />
      </div>
    </>
  );
}

function NavLinks({ keys, label }: { keys: readonly NavKey[]; label: string }) {
  const t = getMessages();
  return (
    <nav aria-label={label} className="mr-2 hidden items-center gap-0.5 lg:flex">
      {keys.map((key) => (
        <Link key={key} href={routes[key]} className={linkClass}>
          {t.nav.links[key]}
        </Link>
      ))}
    </nav>
  );
}

function VisitorActions() {
  const t = getMessages();
  return (
    <>
      <div className="hidden items-center gap-3 lg:flex">
        <NavLinks keys={visitorNav.top} label={t.nav.main} />
        <Link href={routes.signIn} className="px-2 text-base font-bold text-fg no-underline hover:text-accent-fg">
          {t.nav.links.signIn}
        </Link>
        <Link
          href={routes.signUp}
          className="inline-flex h-11 items-center rounded-xl bg-accent px-5 font-bold text-on-accent no-underline transition-[filter] hover:brightness-110"
        >
          {t.nav.links.signUp}
        </Link>
      </div>

      <Link
        href={routes.signIn}
        className="inline-flex h-10 items-center rounded-xl border border-line bg-card px-3.5 text-sm font-bold text-fg no-underline lg:hidden"
      >
        {t.nav.links.signIn}
      </Link>
    </>
  );
}
