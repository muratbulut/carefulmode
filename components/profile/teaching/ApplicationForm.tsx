"use client";

import { Info, Lock } from "lucide-react";
import { startTransition, useActionState, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Field, Notice, describedBy, inputClass, selectClass } from "@/components/auth/fields";
import { idleState, type FormState } from "@/lib/account/shared";
import { format, getMessages } from "@/lib/i18n";
import { districtsOf, provinceNames } from "@/lib/school/places";
import { schoolNameLimits } from "@/lib/school/names";
import { submitApplication } from "@/lib/teacher/application-actions";
import { applicationLimits, newSchoolChoice, parseApplication, type ApplicationField } from "@/lib/teacher/application-rules";
import { cn } from "@/lib/utils";
import { DocumentPicker } from "./DocumentPicker";
import { InfoBox, PrimaryButton, secondaryButton } from "./parts";
import type { PreparedDocument } from "./prepare-document";
import type { ApplicationDraft } from "./types";

type FieldName = ApplicationField | "document";

/**
 * Öğretmenlik talep formu (Tur 4, 17 son hali; tahta: Ogretmenlik-Son). Öğretmen il ve ilçeyi
 * seçip okulunun adını yazar; okul listesi gösterilmez (sabah soruları 26b: kimse ilçedeki
 * okulları göremez). Yazılan ad sistemdeki bir okulla aynıysa sunucu talebi ona bağlar, değilse
 * yönetici eşler ya da adı düzeltip ekler. Davet bağlantısından ya da önceki talebinden gelen
 * okul seçili gelir; "Başka bir okul" ile ad yazılabilir. Branş zorunlu, kurumsal e-posta ve
 * belge isteğe bağlı.
 */
export function ApplicationForm({
  draft,
  autoFocus = false,
  onCancel,
  onDone,
}: {
  draft: ApplicationDraft | null;
  autoFocus?: boolean;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const m = getMessages();
  const t = m.teaching;
  const f = t.form;
  const id = useId();
  const firstField = useRef<HTMLSelectElement>(null);

  const [province, setProvince] = useState(draft?.province ?? "");
  const [district, setDistrict] = useState(draft?.district ?? "");
  // Bilinen okul (davet ya da önceki talep) yalnızca kendi il ve ilçesinde seçilebilir.
  const [known, setKnown] = useState(draft?.school ?? null);
  const [school, setSchool] = useState(draft?.school && !draft.newSchoolName ? draft.school.id : newSchoolChoice);
  const [newSchoolName, setNewSchoolName] = useState(draft?.newSchoolName ?? "");
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [email, setEmail] = useState(draft?.institutionalEmail ?? "");
  const [attachment, setAttachment] = useState<PreparedDocument | null>(null);
  // Gönder'e bir kez basılınca eksikler alanların altında yazar ve düzeltildikçe kalkar.
  const [tried, setTried] = useState(false);
  // Sunucunun alan hataları; alan değişince kalkar.
  const [serverErrors, setServerErrors] = useState<Partial<Record<FieldName, string>>>({});

  const typing = school === newSchoolChoice;

  useEffect(() => {
    if (autoFocus) firstField.current?.focus();
  }, [autoFocus]);

  const values = { province, district, school, newSchoolName, subject, institutionalEmail: email };
  const check = parseApplication(values);
  const clientErrors = new Set<ApplicationField>(check.ok ? [] : check.errors);
  const errorOf = (name: FieldName): string | undefined =>
    (tried && name !== "document" && clientErrors.has(name) ? t.errors[name] : undefined) ?? serverErrors[name];

  /** Alanı değiştirir ve o alanların sunucu hatasını kaldırır. */
  function edit<T>(setter: (value: T) => void, ...fields: FieldName[]) {
    return (value: T) => {
      setter(value);
      if (!fields.some((name) => serverErrors[name])) return;
      setServerErrors((current) => {
        const next = { ...current };
        for (const name of fields) delete next[name];
        return next;
      });
    };
  }

  const [state, dispatch, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await submitApplication(prev, form);
    setServerErrors((result.fieldErrors ?? {}) as Partial<Record<FieldName, string>>);
    if (result.status === "ok" && result.message) onDone(result.message);
    return result;
  }, idleState);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setTried(true);
    if (!check.ok) {
      // Hatalar çizildikten sonra ilk eksik alana gidilir.
      requestAnimationFrame(() => formElement.querySelector<HTMLElement>("[aria-invalid=true], [data-invalid]")?.focus());
      return;
    }
    // Form kendiliğinden sıfırlanmasın diye eylem form niteliğiyle değil, elle çağrılır.
    const form = new FormData(formElement);
    if (attachment) form.set("document", attachment.file, attachment.name);
    startTransition(() => dispatch(form));
  }

  const districts = province ? districtsOf(province) : [];
  const placeError = errorOf("place");
  const schoolError = errorOf("school");
  const nameError = errorOf("newSchoolName");
  const subjectError = errorOf("subject");
  const emailError = errorOf("institutionalEmail");
  const optional = <span className="font-medium text-fg-4">{f.optional}</span>;

  return (
    <form onSubmit={submit} aria-label={f.label} className="flex flex-col gap-3.5 anim-slide-in" noValidate>
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${id}-province`} label={f.province}>
            <select
              ref={firstField}
              id={`${id}-province`}
              name="province"
              value={province}
              onChange={(e) => {
                edit(setProvince, "place", "school")(e.target.value);
                setDistrict("");
                setKnown(null);
                setSchool(newSchoolChoice);
              }}
              className={selectClass}
              {...describedBy(`${id}-place`, { error: placeError && !province ? placeError : undefined })}
            >
              <option value="">{f.chooseProvince}</option>
              {provinceNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-district`} label={f.district}>
            <select
              id={`${id}-district`}
              name="district"
              value={district}
              disabled={!province}
              onChange={(e) => {
                edit(setDistrict, "place", "school")(e.target.value);
                setKnown(null);
                setSchool(newSchoolChoice);
              }}
              className={cn(selectClass, "disabled:cursor-not-allowed disabled:opacity-60")}
              {...describedBy(`${id}-place`, { error: placeError && province ? placeError : undefined })}
            >
              <option value="">{province ? f.chooseDistrict : f.provinceFirst}</option>
              {districts.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {placeError ? <ErrorLine id={`${id}-place-error`}>{placeError}</ErrorLine> : null}
      </div>

      {known ? (
        <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={schoolError ? `${id}-school-error` : undefined}>
          <legend className="mb-2 text-sm font-bold text-fg-2">{f.school}</legend>
          <SchoolRadio
            name="school"
            value={known.id}
            checked={school === known.id}
            onChange={edit(setSchool, "school")}
            title={known.name}
            subtitle={format(t.place, { province, district })}
            invalid={!!schoolError}
          />
          <SchoolRadio
            name="school"
            value={newSchoolChoice}
            checked={typing}
            onChange={edit(setSchool, "school")}
            title={f.otherSchool}
            subtitle={f.otherSchoolHint}
            invalid={!!schoolError}
            dashed
          />
          {schoolError ? <ErrorLine id={`${id}-school-error`}>{schoolError}</ErrorLine> : null}
        </fieldset>
      ) : (
        <input type="hidden" name="school" value={newSchoolChoice} />
      )}

      {typing ? (
        <div className="flex flex-col gap-3">
          <Field id={`${id}-new-school`} label={f.newSchoolName} hint={f.newSchoolHint} error={nameError}>
            <input
              id={`${id}-new-school`}
              name="newSchoolName"
              autoComplete="off"
              maxLength={schoolNameLimits.max}
              placeholder={f.newSchoolPlaceholder}
              value={newSchoolName}
              onChange={(e) => edit(setNewSchoolName, "newSchoolName")(e.target.value)}
              className={inputClass}
              {...describedBy(`${id}-new-school`, { hint: f.newSchoolHint, error: nameError })}
            />
          </Field>
          <InfoBox Icon={Info}>{f.newSchoolNote}</InfoBox>
        </div>
      ) : null}

      <Field id={`${id}-subject`} label={f.subject} error={subjectError}>
        <input
          id={`${id}-subject`}
          name="subject"
          autoComplete="off"
          maxLength={applicationLimits.subject.max}
          placeholder={f.subjectPlaceholder}
          value={subject}
          onChange={(e) => edit(setSubject, "subject")(e.target.value)}
          className={inputClass}
          {...describedBy(`${id}-subject`, { error: subjectError })}
        />
      </Field>

      <Field
        id={`${id}-email`}
        label={
          <span className="inline-flex flex-wrap gap-x-1">
            {f.email}
            {optional}
          </span>
        }
        hint={f.emailHint}
        error={emailError}
      >
        <input
          id={`${id}-email`}
          name="institutionalEmail"
          type="email"
          inputMode="email"
          autoComplete="off"
          maxLength={applicationLimits.email}
          placeholder={f.emailPlaceholder}
          value={email}
          onChange={(e) => edit(setEmail, "institutionalEmail")(e.target.value)}
          className={inputClass}
          {...describedBy(`${id}-email`, { hint: f.emailHint, error: emailError })}
        />
      </Field>

      <DocumentPicker
        id={`${id}-document`}
        label={
          <span className="inline-flex flex-wrap gap-x-1">
            {f.document}
            {optional}
          </span>
        }
        types={t.document.types}
        hint={f.documentHint}
        value={attachment}
        onChange={edit(setAttachment, "document")}
        error={serverErrors.document}
      />

      <InfoBox Icon={Lock}>{f.privacy}</InfoBox>

      {state.status === "error" && state.message ? (
        <Notice tone={state.code === "rate_limited" ? "warn" : "bad"} live="assertive">
          {state.message}
        </Notice>
      ) : null}

      <div className="flex flex-wrap gap-2.5">
        <PrimaryButton ready={check.ok} pending={pending}>
          {f.submit}
        </PrimaryButton>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          {f.cancel}
        </button>
      </div>
    </form>
  );
}

function ErrorLine({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="text-[13px] leading-[1.45] text-danger-fg">
      {children}
    </p>
  );
}

/** Okul listesindeki seçenek: kart gibi görünen radyo düğmesi. */
function SchoolRadio({
  name,
  value,
  checked,
  onChange,
  title,
  subtitle,
  invalid,
  dashed = false,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  subtitle: string;
  invalid: boolean;
  dashed?: boolean;
}) {
  const on = dashed ? "border-warning bg-warning/6" : "border-accent bg-card";
  const off = dashed ? "border-line-strong bg-transparent" : "border-line bg-surface-deep";
  const dot = dashed ? "border-warning" : "border-accent";
  return (
    <label
      className={cn(
        "relative flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
        dashed && "border-dashed",
        checked ? on : cn(off, "hover:border-line-strong"),
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        data-invalid={invalid || undefined}
        // Görünmez ama bütün kartı kaplar: karta dokunmak seçer, odak çerçevesi kartta görünür.
        className="absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-xl opacity-0"
      />
      <span
        aria-hidden="true"
        className={cn("flex size-5 flex-none items-center justify-center rounded-full border-2", checked ? dot : "border-line-strong")}
      >
        <span className={cn("size-2.5 rounded-full", checked ? (dashed ? "bg-warning" : "bg-accent") : "bg-transparent")} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <b className="text-[15px] break-words">{title}</b>
        <span className="text-xs text-fg-3">{subtitle}</span>
      </span>
    </label>
  );
}
