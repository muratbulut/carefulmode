"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import { useTransition, type ReactNode } from "react";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { HandledRequest, SchoolRequest } from "./types";

const handledDot = { approved: "bg-success", endorsed: "bg-accent", notRecognized: "bg-warning" } as const;

function Flag({ on, children }: { on: boolean; children: ReactNode }) {
  const Icon = on ? Check : X;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className={cn("size-3.5", on ? "text-success-fg" : "text-fg-4")} strokeWidth={2.6} aria-hidden="true" />
      {children}
    </span>
  );
}

function RequestItem({
  request,
  coordinatorApproves,
  onEndorse,
  onNotRecognize,
}: {
  request: SchoolRequest;
  coordinatorApproves: boolean;
  onEndorse: (request: SchoolRequest) => Promise<void>;
  onNotRecognize: (request: SchoolRequest) => Promise<void>;
}) {
  const t = getMessages().school.requests;
  const [pending, startTransition] = useTransition();
  return (
    <li
      aria-label={request.name}
      className={cn("flex flex-col gap-3 rounded-2xl border border-line bg-surface-raised px-4 py-3.5 transition-opacity", pending && "opacity-60")}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-10 flex-none items-center justify-center rounded-full border border-line bg-card text-xl">
          {request.avatar}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <b className="text-[15px]">{request.name}</b>
          <span className="text-[13px] text-fg-3">{format(t.meta, { subject: request.subject, when: request.when })}</span>
        </span>
      </div>
      <span className="flex flex-wrap gap-3 text-[13px] text-fg-2">
        <Flag on={request.hasInstitutionalEmail}>{request.hasInstitutionalEmail ? t.institutionalEmail : t.noInstitutionalEmail}</Flag>
        <Flag on={request.hasDocument}>{request.hasDocument ? t.document : t.noDocument}</Flag>
      </span>
      {request.minor ? (
        <span className="flex items-start gap-1.5 text-[13px] leading-normal font-medium text-fg-2">
          <AlertTriangle className="mt-0.5 size-[15px] flex-none text-warning-fg" strokeWidth={2} aria-hidden="true" />
          {t.minor}
        </span>
      ) : null}
      <span className="text-[13px] leading-normal text-fg-3">{coordinatorApproves ? t.question : t.questionOpinion}</span>
      {/* Yan yana sığmazsa düğmeler alt alta geçer; yazı kırılmaz. */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => onNotRecognize(request))}
          className="h-11 flex-[1_0_auto] cursor-pointer rounded-xl border border-line bg-transparent px-4 font-[inherit] text-sm font-bold whitespace-nowrap text-fg-2 transition-colors hover:border-line-strong disabled:cursor-default"
        >
          {t.notRecognized}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => onEndorse(request))}
          className="inline-flex h-11 flex-[1_0_auto] cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-success px-3.5 font-[inherit] text-sm font-bold whitespace-nowrap text-on-accent transition-[filter] hover:brightness-110 disabled:cursor-default"
        >
          <Check className="size-4" strokeWidth={2.6} aria-hidden="true" />
          {t.endorse}
        </button>
      </div>
    </li>
  );
}

/**
 * "Okulundan gelen talepler": bu okulu seçen ve sorumlunun görüşünü bekleyen talepler. Başvuranın
 * e-postası, belgesi ve kurumsal e-posta adresi gösterilmez; yalnızca var olup olmadıkları.
 */
export function RequestsCard({
  requests,
  handled,
  coordinatorApproves,
  onEndorse,
  onNotRecognize,
}: {
  requests: SchoolRequest[];
  handled: HandledRequest[];
  coordinatorApproves: boolean;
  onEndorse: (request: SchoolRequest) => Promise<void>;
  onNotRecognize: (request: SchoolRequest) => Promise<void>;
}) {
  const t = getMessages().school.requests;
  return (
    <section
      aria-labelledby="school-requests"
      className="flex flex-col gap-3 rounded-[20px] border border-warning/30 bg-[radial-gradient(90%_120%_at_0%_0%,color-mix(in_srgb,var(--warning)_8%,transparent),transparent_60%)] bg-surface p-4 lg:p-5 print:hidden"
    >
      <span className="flex items-baseline justify-between gap-2">
        <h2 id="school-requests" className="m-0 text-base font-bold">
          {t.title}
        </h2>
        <span className="text-[13px] text-fg-3">{format(t.waiting, { n: requests.length })}</span>
      </span>
      {requests.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {requests.map((request) => (
            <RequestItem key={request.id} request={request} coordinatorApproves={coordinatorApproves} onEndorse={onEndorse} onNotRecognize={onNotRecognize} />
          ))}
        </ul>
      ) : (
        <span className="text-sm text-fg-3">{t.empty}</span>
      )}
      {handled.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {handled.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-[13px] text-fg-2">
              <span aria-hidden="true" className={cn("size-2 flex-none rounded-full", handledDot[item.kind])} />
              <span>
                <b>{item.name}</b> · {t.handled[item.kind]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <span className="text-xs text-fg-4">{t.footnote}</span>
    </section>
  );
}
