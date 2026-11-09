import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ShieldCheck, Users } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { PageBackground } from "@/components/background/PageBackground";
import { Loading } from "@/components/status/Loading";
import { withNext } from "@/lib/account/shared";
import { isJoinCode, normalizeJoinCode } from "@/lib/classroom/rules";
import { db } from "@/lib/db";
import { format, getMessages } from "@/lib/i18n";
import { paths, routes } from "@/lib/navigation";
import { getUser } from "@/lib/session";
import { JoinInvite } from "./JoinInvite";
import { primaryLinkClass, secondaryLinkClass } from "./styles";

export const metadata: Metadata = { title: getMessages().pages.join, robots: { index: false, follow: false } };

/**
 * Sınıf koduyla katılma bağlantısı (öğretmen paylaşır, tahtaya yansıtılan QR buraya gider).
 * Giriş yoksa giriş ve kayıt bağlantıları buraya döner; e-posta doğrulanmadıysa doğrulama
 * sayfasına gider. Sınıfın adı, ancak "Katıl"a basılıp sunucu katılmayı kabul edince görünür:
 * sayfa kod denemek için sınırsız bir kapı olmasın (sınır eylemde, lib/classroom/student-actions.ts).
 */
export default function JoinPage({ params }: PageProps<"/katil/[kod]">) {
  return (
    <>
      <PageBackground />
      <section className="relative mx-auto flex w-full max-w-[520px] flex-col px-4 pt-6 pb-16 lg:pt-16 lg:pb-24">
        <Suspense fallback={<Loading cardCount={1} />}>
          <JoinEntry params={params} />
        </Suspense>
      </section>
    </>
  );
}

async function JoinEntry({ params }: Pick<PageProps<"/katil/[kod]">, "params">) {
  const t = getMessages().studentClass.page;
  const { kod } = await params;
  const code = typeof kod === "string" && kod.length <= 32 ? normalizeJoinCode(kod) : "";

  if (!isJoinCode(code)) {
    return (
      <JoinFrame>
        <p role="alert" className="m-0 flex items-start gap-2.5 rounded-xl border border-warning/45 bg-warning/8 px-3.5 py-3 text-sm leading-normal text-warning-fg">
          <AlertTriangle className="mt-px size-[18px] flex-none" strokeWidth={2.2} aria-hidden="true" />
          {t.invalid}
        </p>
        <Link href={routes.home} className={secondaryLinkClass}>
          {t.home}
        </Link>
      </JoinFrame>
    );
  }

  const here = paths.join(code);
  const sessionUser = await getUser();
  if (!sessionUser) {
    return (
      <JoinFrame code={code}>
        <p className="m-0 text-[15px] leading-normal text-fg-2">{t.signedOut}</p>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Link href={withNext(routes.signIn, here)} className={primaryLinkClass}>
            {t.signIn}
          </Link>
          <Link href={withNext(routes.signUp, here)} className={secondaryLinkClass}>
            {t.signUp}
          </Link>
        </div>
      </JoinFrame>
    );
  }

  // Oturumdaki kopya yerine güncel satır: az önce doğrulayan kişi hemen katılabilsin.
  const user = await db.user.findUnique({ where: { id: sessionUser.id }, select: { emailVerified: true } });
  if (!user?.emailVerified) {
    return (
      <JoinFrame code={code}>
        <p className="m-0 text-[15px] leading-normal text-fg-2">{t.unverified}</p>
        <Link href={withNext(routes.verify, here)} className={primaryLinkClass}>
          {getMessages().studentClass.verify}
        </Link>
      </JoinFrame>
    );
  }

  return (
    <JoinFrame code={code}>
      <JoinInvite code={code} />
    </JoinFrame>
  );
}

/** Davet kartı: başlık, büyük harflerle kod, içerik ve gizlilik sözü. */
function JoinFrame({ code, children }: { code?: string; children: ReactNode }) {
  const m = getMessages().studentClass;
  const t = m.page;
  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-7">
      <div className="flex items-center gap-3.5">
        <span className="flex size-12 flex-none items-center justify-center rounded-[14px] bg-success/12">
          <Users className="size-[22px] text-success" strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold tracking-[2px] text-accent-light">{t.eyebrow}</span>
          <h1 className="m-0 font-heading text-[26px] leading-tight font-bold sm:text-[30px]">{t.title}</h1>
        </span>
      </div>
      {code ? (
        <div className="flex justify-center rounded-2xl border border-line bg-surface-deep px-3 py-5">
          <span className="sr-only">{format(t.codeLabel, { code })}</span>
          <span aria-hidden="true" className="flex gap-1.5 sm:gap-2">
            {[...code].map((ch, i) => (
              <span
                key={i}
                className="flex h-14 w-11 items-center justify-center rounded-xl border border-line bg-canvas font-mono text-[28px] font-bold text-fg sm:h-16 sm:w-12 sm:text-[32px]"
              >
                {ch}
              </span>
            ))}
          </span>
        </div>
      ) : null}
      {children}
      <p className="m-0 flex items-start gap-2 text-[13px] leading-normal text-fg-3">
        <ShieldCheck className="mt-px size-4 flex-none text-success" strokeWidth={2} aria-hidden="true" />
        {m.privacy}
      </p>
    </div>
  );
}
