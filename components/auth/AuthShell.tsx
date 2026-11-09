import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FlowingThreads } from "@/components/background/FlowingThreads";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Wordmark, brand } from "@/lib/brand";
import { format, getMessages } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Hesap ekranlarının çerçevesi (Tur 1, B): solda logo, sağda "Ana sayfa" ve tema düğmesi,
 * arkada soluk akan iplikler. Menü yok; öğrenci formdan ayrılmadan işini bitirir.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = getMessages();
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-80">
        <FlowingThreads pattern="page" className="hidden md:block" />
        <FlowingThreads pattern="mobile" className="md:hidden" />
      </div>
      <header className="relative z-10 border-b border-card">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3.5 lg:px-6 lg:py-[18px]">
          <Link
            href={routes.home}
            className="-my-1.5 flex items-center gap-2.5 py-1.5 text-fg no-underline"
            aria-label={format(t.site.homeLink, { brand: brand.name })}
          >
            <Wordmark className="h-[15px] w-auto lg:h-[18px]" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={routes.home}
              className="hidden items-center gap-1.5 text-[15px] text-fg-2 no-underline hover:text-fg md:inline-flex"
            >
              <ArrowLeft className="size-4" strokeWidth={2.2} aria-hidden="true" />
              {t.auth.backHome}
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="content" className="relative flex-1">
        {children}
      </main>
    </div>
  );
}

/** Kayıt ve şifre sıfırlama: ortada tek kart (telefonda kartsız, tam genişlik). */
export function AuthCard({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div className="flex justify-center px-4 pt-6 pb-10 md:px-6 md:pt-10 md:pb-16">
      <div className={cn("flex w-full flex-col", narrow ? "max-w-[560px]" : "max-w-[640px]", " gap-5 md:gap-[22px] md:rounded-3xl md:border md:border-line md:bg-surface-translucent md:p-9 md:shadow-card md:backdrop-blur-sm")}>
        {children}
      </div>
    </div>
  );
}

/** Giriş ve doğrulama: solda form, sağda iplikli ipucu paneli; telefonda ipucu formun altında. */
export function AuthSplit({ form, panel }: { form: ReactNode; panel: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 pt-6 pb-10 md:px-6 md:pt-10 md:pb-14 lg:flex-row lg:items-stretch">
      <div className="flex flex-1 justify-center lg:basis-[460px] lg:items-start">
        <div className="flex w-full max-w-[500px] flex-col gap-5 md:gap-[22px] lg:pt-2">{form}</div>
      </div>
      <aside className="relative flex flex-1 items-center lg:min-h-[620px] lg:basis-[420px] lg:overflow-hidden lg:rounded-3xl lg:border lg:border-card lg:bg-surface-raised lg:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
          <FlowingThreads pattern="mobile" />
        </div>
        <div className="relative mx-auto w-full max-w-[440px]">{panel}</div>
      </aside>
    </div>
  );
}

export function AuthHeading({ title, lead }: { title: ReactNode; lead?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-heading text-[30px] leading-[1.1] font-bold tracking-[-0.5px] md:text-4xl">{title}</h1>
      {lead ? <p className="text-base leading-[1.55] text-fg-3">{lead}</p> : null}
    </div>
  );
}
