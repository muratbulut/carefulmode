import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthSplit } from "@/components/auth/AuthShell";
import { FormSkeleton } from "@/components/auth/FormSkeleton";
import { VerifyForm } from "@/components/auth/VerifyForm";
import { VerifyTip } from "@/components/auth/VerifyTip";
import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { rateLimit, rateRules } from "@/lib/rate-limit";
import { safeNext, withNext } from "@/lib/account/shared";
import { getUser } from "@/lib/session";

const t = getMessages();

export const metadata: Metadata = { title: t.pages.verify, robots: { index: false } };

export default function VerifyPage({ searchParams }: PageProps<"/dogrula">) {
  return (
    <AuthSplit
      form={
        <Suspense fallback={<FormSkeleton rows={1} />}>
          <VerifyEntry searchParams={searchParams} />
        </Suspense>
      }
      panel={<VerifyTip />}
    />
  );
}

async function VerifyEntry({ searchParams }: Pick<PageProps<"/dogrula">, "searchParams">) {
  const next = safeNext((await searchParams).sonra, "");
  const user = await getUser();
  if (!user) redirect(withNext(routes.signIn, next ? withNext(routes.verify, next) : routes.verify));
  if (user.emailVerified) redirect(next || routes.home);
  // Kayıtla giden kodun "tekrar gönder" beklemesi sürüyorsa sayaç oradan devam eder.
  const cooldown = await rateLimit.check(rateRules.codeSendCooldown, user.email);
  return <VerifyForm email={user.email} next={next || undefined} cooldownSec={cooldown.retryAfterSec} />;
}
