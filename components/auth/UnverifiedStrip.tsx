import { Mail } from "lucide-react";
import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { getUser } from "@/lib/session";
import { RememberDevice } from "./RememberDevice";

/**
 * Doğrulanmamış hesapla girilince sayfanın üstündeki uyarı (Tur 1, ekran 7; tahta:
 * Dogrulanmamis-Serit). Oturum okuduğu için <Suspense> içinde kullanılır.
 */
export async function UnverifiedStrip() {
  const user = await getUser();
  if (!user) return null;
  if (user.emailVerified) return <RememberDevice />;
  const t = getMessages().auth.unverified;
  return (
    <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 pt-4 lg:px-6">
      <RememberDevice />
      <div
        role="status"
        className="flex flex-col gap-2.5 rounded-2xl border border-warning/45 bg-warning/8 p-3.5 md:flex-row md:items-center md:justify-between md:gap-6 md:px-5"
      >
        <div className="flex items-start gap-2.5">
          <Mail className="size-5 flex-none text-warning" strokeWidth={2} aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <p className="font-bold text-warning-fg">{t.title}</p>
            <p className="text-sm leading-normal text-fg-2">{t.text}</p>
          </div>
        </div>
        <Link
          href={routes.verify}
          className="flex h-11 flex-none items-center justify-center rounded-xl bg-warning px-5 font-bold text-on-warning no-underline hover:brightness-110"
        >
          {t.action}
        </Link>
      </div>
    </div>
  );
}
