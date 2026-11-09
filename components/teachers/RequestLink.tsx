import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Suspense } from "react";
import { withNext } from "@/lib/account/shared";
import { getMessages } from "@/lib/i18n";
import { paths, routes } from "@/lib/navigation";
import { getUser } from "@/lib/session";
import { getTeacherAccess } from "@/lib/teacher/access";
import { cn } from "@/lib/utils";

export const primaryClass =
  "inline-flex h-[50px] items-center justify-center gap-2 rounded-xl bg-accent px-6 text-[17px] font-bold text-on-accent no-underline transition-[filter] hover:brightness-110 lg:h-[52px]";

/** Ziyaretçi kayıt olur, kayıttan sonra profildeki Öğretmenlik bölümüne döner (talep orada). */
export const signUpForTeachers = withNext(routes.signUp, paths.profileSection("teaching"));

function CtaLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link href={href} className={cn(primaryClass, className)}>
      {label}
      <ArrowRight className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
    </Link>
  );
}

/**
 * Ana çağrı "Öğretmen hesabı iste". Sayfa statik kalır; oturum istek anında okunur: ziyaretçi
 * kayda, giriş yapmış kişi profildeki Öğretmenlik bölümüne, zaten öğretmen olan Sınıflarım'a gider.
 */
export function RequestLink({ className }: { className?: string }) {
  const t = getMessages().teachersPage;
  return (
    <Suspense fallback={<CtaLink href={signUpForTeachers} label={t.request} className={className} />}>
      <ViewerRequestLink className={className} />
    </Suspense>
  );
}

async function ViewerRequestLink({ className }: { className?: string }) {
  const t = getMessages().teachersPage;
  const user = await getUser();
  if (!user) return <CtaLink href={signUpForTeachers} label={t.request} className={className} />;
  const teacher = user.role === "STUDENT" ? null : await getTeacherAccess();
  return teacher ? (
    <CtaLink href={routes.classes} label={t.toClasses} className={className} />
  ) : (
    <CtaLink href={paths.profileSection("teaching")} label={t.request} className={className} />
  );
}
