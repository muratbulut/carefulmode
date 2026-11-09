import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard, AuthHeading } from "@/components/auth/AuthShell";
import { FormSkeleton } from "@/components/auth/FormSkeleton";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { safeNext } from "@/lib/account/shared";
import { getUser } from "@/lib/session";

const t = getMessages();

export const metadata: Metadata = { title: t.pages.signUp };

export default function SignUpPage({ searchParams }: PageProps<"/kayit">) {
  return (
    <AuthCard>
      <AuthHeading title={t.auth.signUp.title} lead={t.auth.signUp.lead} />
      <Suspense fallback={<FormSkeleton rows={4} />}>
        <SignUpEntry searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

/** Giriş yapmış kullanıcı kayıt formunu görmez. */
async function SignUpEntry({ searchParams }: Pick<PageProps<"/kayit">, "searchParams">) {
  const next = safeNext((await searchParams).sonra, "");
  if (await getUser()) redirect(next || routes.home);
  return <SignUpForm next={next || undefined} />;
}
