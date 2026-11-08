"use client";

import { Info } from "lucide-react";
import { startTransition, useActionState, useId, useState, type FormEvent } from "react";
import { Field, Notice, describedBy, inputClass } from "@/components/auth/fields";
import { idleState, type FormState } from "@/lib/account/shared";
import { format, getMessages } from "@/lib/i18n";
import { answerApplication } from "@/lib/teacher/application-actions";
import { applicationLimits, parseAnswer } from "@/lib/teacher/application-rules";
import { cn } from "@/lib/utils";
import { DocumentPicker } from "./DocumentPicker";
import { InfoBox, Panel, PanelTitle, PrimaryButton, SummaryList, WithdrawButton } from "./parts";
import type { PreparedDocument } from "./prepare-document";
import type { ApplicationSummary } from "./types";

/**
 * Yönetici bilgi istedi (Tur 4, 17 son hali; tahta: Ogretmenlik-Son-Bilgi): yöneticinin sorusu,
 * cevap kutusu ve isteğe bağlı belge. Cevap gidince talep yeniden "inceleniyor" olur ve yönetimde
 * "CEVAP GELDİ" etiketiyle görünür.
 */
export function InfoRequestForm({
  application,
  question,
  askedAt,
  onDone,
}: {
  application: ApplicationSummary;
  question: string;
  askedAt: string;
  onDone: (message: string) => void;
}) {
  const t = getMessages().teaching;
  const id = useId();
  const [answer, setAnswer] = useState("");
  const [attachment, setAttachment] = useState<PreparedDocument | null>(null);
  const [tried, setTried] = useState(false);
  const [state, dispatch, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await answerApplication(prev, form);
    if (result.status === "ok" && result.message) onDone(result.message);
    return result;
  }, idleState);
  const ready = parseAnswer(answer, !!attachment).ok;
  const answerError = (tried && !ready ? t.errors.answer : undefined) ?? state.fieldErrors?.answer;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    if (!ready) return;
    const form = new FormData(event.currentTarget);
    if (attachment) form.set("document", attachment.file, attachment.name);
    startTransition(() => dispatch(form));
  }

  return (
    <Panel tone="accent">
      <PanelTitle title={t.info.title} subtitle={format(t.info.subtitle, { when: askedAt })} />
      <InfoBox Icon={Info} deep>
        <b className="mr-1 text-fg">{t.info.question}</b>
        {question}
      </InfoBox>

      <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
        <Field id={`${id}-answer`} label={t.info.answer} error={answerError}>
          <textarea
            id={`${id}-answer`}
            name="answer"
            rows={3}
            maxLength={applicationLimits.answer.max}
            placeholder={t.info.answerPlaceholder}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className={cn(inputClass, "h-auto min-h-[88px] resize-y py-3 leading-normal")}
            {...describedBy(`${id}-answer`, { error: answerError })}
          />
        </Field>

        <DocumentPicker
          id={`${id}-document`}
          label={
            <span className="inline-flex flex-wrap gap-x-1">
              {t.info.document}
              <span className="font-medium text-fg-4">{t.info.documentOptional}</span>
            </span>
          }
          types={t.document.typesShort}
          value={attachment}
          onChange={setAttachment}
          error={state.fieldErrors?.document}
          compact
        />

        <SummaryList
          rows={[
            [t.summary.school, application.school],
            [t.summary.place, application.place],
            [t.summary.subject, application.subject],
          ]}
        />

        {state.status === "error" && state.message ? (
          <Notice tone={state.code === "rate_limited" ? "warn" : "bad"} live="assertive">
            {state.message}
          </Notice>
        ) : null}

        <div className="flex flex-wrap gap-2.5">
          <PrimaryButton ready={ready} pending={pending}>
            {t.info.submit}
          </PrimaryButton>
          <WithdrawButton onDone={onDone} />
        </div>
      </form>
    </Panel>
  );
}
