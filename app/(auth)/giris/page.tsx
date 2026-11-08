import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthSplit } from "@/components/auth/AuthShell";
import { FormSkeleton } from "@/components/auth/FormSkeleton";
import { SignInForm } from "@/components/auth/SignInForm";
import { SignInTips } from "@/components/auth/SignInTips";
import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { safeNext } from "@/lib/account/shared";
import { getUser } from "@/lib/session";

const t = getMessages();

export const metadata: Metadata = { title: t.pages.signIn };

export default function SignInPage({ searchParams }: PageProps<"/giris">) {
  return (
    <AuthSplit
      form={
        <Suspense fallback={<FormSkeleton rows={2} />}>
          <SignInEntry searchParams={searchParams} />
        </Suspense>
      }
      panel={<SignInTips />}
    />
  );
}

async function SignInEntry({ searchParams }: Pick<PageProps<"/giris">, "searchParams">) {
  const next = safeNext((await searchParams).sonra, "");
  if (await getUser()) redirect(next || routes.home);
  return <SignInForm next={next || undefined} />;
}
