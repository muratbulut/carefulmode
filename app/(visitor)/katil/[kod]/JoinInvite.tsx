"use client";

import Link from "next/link";
import { AlertTriangle, Check } from "lucide-react";
import { useState, useTransition } from "react";
import { Spinner } from "@/components/status/Spinner";
import { joinClassroom, type JoinResult } from "@/lib/classroom/student-actions";
import { format, getMessages } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { primaryLinkClass } from "./styles";

/**
 * Doğrulanmış öğrencinin "Katıl" düğmesi. Sınıfın adı ve öğretmeni yalnızca katılma başarılı
 * olunca (sunucunun cevabıyla) görünür. Yanlış kodda, sınırda ya da hatada mesaj çıkar ve
 * yeniden denenebilir; zaten üyeyse ana sayfaya bağlantı verilir.
 */
export function JoinInvite({ code }: { code: string }) {
  const m = getMessages().studentClass;
  const [result, setResult] = useState<JoinResult | null>(null);
  const [pending, startJoin] = useTransition();

  function join() {
    startJoin(async () => {
      try {
        setResult(await joinClassroom(code));
      } catch {
        setResult({ status: "error", code: "generic", message: m.errors.generic });
      }
    });
  }

  if (result?.status === "ok") {
    const c = result.classroom;
    return (
      <>
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-success/40 bg-success/8 px-4 py-3.5 motion-safe:anim-pop">
          <Check className="mt-0.5 size-5 flex-none text-success" strokeWidth={2.6} aria-hidden="true" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <b className="text-base break-words">{result.message}</b>
            <span className="text-[13px] text-fg-3">
              {c.school ? format(m.classAndSchool, { name: format(m.teacher, { name: c.teacher }), school: c.school }) : format(m.teacher, { name: c.teacher })}
            </span>
          </span>
        </div>
        <p className="m-0 text-[15px] leading-normal text-fg-2">{m.page.afterJoin}</p>
        <Link href={routes.home} className={primaryLinkClass}>
          {m.page.home}
        </Link>
      </>
    );
  }

  const member = result?.status === "error" && result.code === "member";
  return (
    <>
      {result?.status === "error" ? (
        <p
          role="alert"
          className={cn(
            "m-0 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-normal",
            member ? "border-accent/45 bg-accent/10 text-accent-light" : "border-danger/55 bg-danger/10 text-danger-fg",
          )}
        >
          <AlertTriangle className="mt-px size-[18px] flex-none" strokeWidth={2.2} aria-hidden="true" />
          {result.message}
        </p>
      ) : (
        <p className="m-0 text-[15px] leading-normal text-fg-2">{m.page.ready}</p>
      )}
      {member ? (
        <Link href={routes.home} className={primaryLinkClass}>
          {m.page.home}
        </Link>
      ) : (
        <button type="button" onClick={join} disabled={pending} aria-busy={pending} className={primaryLinkClass}>
          {pending ? <Spinner tone="onAccent" /> : null}
          {m.code.join}
        </button>
      )}
    </>
  );
}
