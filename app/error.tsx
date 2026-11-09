"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { StatusCard } from "@/components/status/StatusCard";
import { RetryButton } from "@/components/status/RetryButton";
import { errorCode } from "@/lib/errors";
import { format, getMessages } from "@/lib/i18n";

/** Sunucu hatası: suçlamayan dil ve destek için kısa bir kod. Teknik ayrıntı gösterilmez. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = getMessages();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-[560px] items-center px-4 py-16">
      <StatusCard
        role="alert"
        Icon={TriangleAlert}
        tone="danger"
        title={t.errors.title}
        className="w-full"
        action={<RetryButton onRetry={() => retry()} doneLabel={t.errors.reloading} />}
      >
        {t.errors.text}
        <code className="mt-2 block w-fit rounded-md border border-line bg-canvas px-2 py-1 font-mono text-xs text-fg-3">
          {format(t.errors.code, { code: errorCode(error.digest) ?? t.errors.noCode })}
        </code>
      </StatusCard>
    </div>
  );
}
