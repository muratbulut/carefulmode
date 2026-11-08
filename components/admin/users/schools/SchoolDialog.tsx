"use client";

import { Check, TriangleAlert } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { Sheet } from "@/components/classroom/Sheet";
import { PersonPicker } from "@/components/admin/users/team/PersonPicker";
import { usePersonSearch } from "@/components/admin/users/team/usePersonSearch";
import { Spinner } from "@/components/status/Spinner";
import {
  createSchool,
  districtSchools,
  removeSchoolCoordinator,
  searchCoordinators,
  setSchoolCoordinator,
  type SchoolActionError,
} from "@/lib/admin/school-admin-actions";
import type { CoordinatorCandidate } from "@/lib/admin/schools";
import { checkSchoolName } from "@/lib/admin/team-rules";
import { format, getMessages } from "@/lib/i18n";
import { districtsOf, provinceNames } from "@/lib/school/places";
import { cn } from "@/lib/utils";

export type SchoolDialogMode =
  | { kind: "new" }
  | {
      kind: "coordinator";
      schoolId: string;
      schoolName: string;
      coordinator: { id: string; name: string; isTeacher: boolean } | null;
      coordinatorApproves: boolean;
    };

/** Pencerenin sonucu: bildirim ve (değiştiyse) geri alınacak işlem. */
export type SchoolDialogDone = { message: string; undo?: { schoolId: string; op: string } };

/**
 * Okul penceresi (Kullanicilar-Son-Okullar): "Okul ekle" (il, ilçe, ad, isteğe bağlı sorumlu) ve
 * okul sorumlusu ("Sorumlu ata" / "Değiştir", "Sorumluyu kaldır"). Benzer ad uyarısı yazarken çıkar,
 * birebir aynı ad eklenmez; sunucu hepsini yeniden denetler. Masaüstünde ortada, telefonda alttan.
 */
export function SchoolDialog({
  mode,
  open,
  onClose,
  onDone,
}: {
  mode: SchoolDialogMode;
  open: boolean;
  onClose: () => void;
  onDone: (done: SchoolDialogDone) => void;
}) {
  const t = getMessages().adminSchools;
  const d = t.dialog;
  const ids = useId();
  const isNew = mode.kind === "new";
  const schoolId = mode.kind === "coordinator" ? mode.schoolId : null;
  const current = mode.kind === "coordinator" ? mode.coordinator : null;

  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [name, setName] = useState("");
  // İlçedeki okulların adları (benzer ad uyarısı); null: henüz gelmedi.
  const [districtNames, setDistrictNames] = useState<string[] | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(current?.id ?? null);
  const [pickedRefusal, setPickedRefusal] = useState<CoordinatorCandidate["refusal"]>(null);
  const [approves, setApproves] = useState(mode.kind === "coordinator" ? mode.coordinatorApproves : true);
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSimilar, setServerSimilar] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();

  const search = usePersonSearch((query: string) => searchCoordinators({ schoolId, query }), { allowEmpty: !isNew, initial: !isNew });

  const check = checkSchoolName(name, districtNames ?? []);
  const similar = check.status === "similar" ? check.names : (serverSimilar ?? []);
  const refusalText = pickedRefusal === "studentAccount" ? d.studentRefused : pickedRefusal === "notTeacher" ? d.memberRefused : null;

  const localError = (() => {
    if (refusalText) return refusalText;
    if (isNew) {
      if (!province || !district) return d.pickPlace;
      if (check.status === "invalid") return d.nameMissing;
      if (check.status === "duplicate") return d.duplicate;
      return null;
    }
    return pickedId ? null : d.pickPerson;
  })();
  // Aynı ad ve öğrenci seçimi hemen görünür; diğerleri ilk denemeden sonra.
  const shownError = (check.status === "duplicate" && isNew) || refusalText ? localError : tried ? (localError ?? serverError) : serverError;
  const ready = localError === null;

  function chooseProvince(value: string) {
    setProvince(value);
    setDistrict("");
    setDistrictNames(null);
    setServerSimilar(null);
    setServerError(null);
  }

  function chooseDistrict(value: string) {
    setDistrict(value);
    setDistrictNames(null);
    setServerSimilar(null);
    setServerError(null);
    if (!value) return;
    const chosen = province;
    districtSchools(chosen, value)
      .then((result) => {
        if (result.ok) setDistrictNames(result.names);
      })
      .catch(() => undefined);
  }

  function pick(person: CoordinatorCandidate | null) {
    setPickedId(person?.id ?? null);
    setPickedRefusal(person?.refusal ?? null);
    setServerError(null);
  }

  function fail(error: SchoolActionError, names?: string[]) {
    if (error === "similar" && names) {
      setServerSimilar(names);
      setServerError(null);
      return;
    }
    setServerError(t.errors[error]);
  }

  function act(work: () => Promise<void>) {
    startTransition(async () => {
      try {
        await work();
      } catch {
        setServerError(t.errors.failed);
      }
    });
  }

  function submit() {
    setTried(true);
    if (!ready) return;
    if (isNew) {
      act(async () => {
        const result = await createSchool({
          name,
          province,
          district,
          coordinatorId: pickedId,
          coordinatorApproves: approves,
          confirmSimilar: similar.length > 0,
        });
        if (!result.ok) return fail(result.error, result.similar);
        onDone({
          message: result.coordinatorName
            ? format(t.toasts.createdWith, { school: result.schoolName, name: result.coordinatorName })
            : format(t.toasts.created, { school: result.schoolName }),
          undo: { schoolId: result.schoolId, op: result.op },
        });
      });
      return;
    }
    if (!schoolId || !pickedId) return;
    act(async () => {
      const result = await setSchoolCoordinator({ schoolId, userId: pickedId, coordinatorApproves: approves });
      if (!result.ok) return fail(result.error);
      if (!result.changed || !result.op) return onDone({ message: t.toasts.unchanged });
      const message =
        result.kind === "set"
          ? format(t.toasts.set, { name: result.name, school: result.schoolName })
          : format(result.coordinatorApproves ? t.toasts.approvesOn : t.toasts.approvesOff, { school: result.schoolName });
      onDone({ message, undo: { schoolId, op: result.op } });
    });
  }

  function removeCoordinator() {
    if (!schoolId) return;
    act(async () => {
      const result = await removeSchoolCoordinator(schoolId);
      if (!result.ok) return fail(result.error);
      onDone({ message: format(t.toasts.removed, { school: result.schoolName }), undo: { schoolId, op: result.op } });
    });
  }

  const titleId = `${ids}-title`;
  const field = "h-[46px] w-full rounded-xl border border-line bg-canvas px-3.5 text-[15px] text-fg";
  const fieldLabel = "flex min-w-0 flex-col gap-2 text-sm font-bold text-fg-2";
  const submitLabel = isNew ? (similar.length > 0 ? d.createAnyway : d.create) : pickedId && pickedId === current?.id ? d.save : d.assign;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      closeLabel={getMessages().admin.close}
      className="lg:max-w-[520px]"
      title={
        <h2 id={titleId} className="m-0 font-heading text-[22px] font-bold">
          {mode.kind === "coordinator" ? format(d.coordinatorTitle, { school: mode.schoolName }) : d.newTitle}
        </h2>
      }
    >
      {isNew ? (
        <>
          <div className="flex flex-wrap gap-3">
            <div className={cn(fieldLabel, "flex-[1_1_160px]")}>
              <label htmlFor={`${ids}-province`}>{d.province}</label>
              <select
                id={`${ids}-province`}
                value={province}
                onChange={(e) => chooseProvince(e.target.value)}
                data-autofocus
                className={field}
              >
                <option value="">{d.pickProvince}</option>
                {provinceNames.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className={cn(fieldLabel, "flex-[1_1_160px]")}>
              <label htmlFor={`${ids}-district`}>{d.district}</label>
              <select
                id={`${ids}-district`}
                value={district}
                onChange={(e) => chooseDistrict(e.target.value)}
                disabled={!province}
                className={cn(field, "disabled:opacity-60")}
              >
                <option value="">{province ? d.pickDistrict : d.provinceFirst}</option>
                {districtsOf(province).map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={fieldLabel}>
            <label htmlFor={`${ids}-name`}>{d.name}</label>
            <input
              id={`${ids}-name`}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setServerSimilar(null);
                setServerError(null);
              }}
              maxLength={90}
              placeholder={d.namePlaceholder}
              autoComplete="off"
              aria-describedby={`${ids}-name-hint`}
              className={cn(field, "placeholder:text-fg-4")}
            />
            <span id={`${ids}-name-hint`} className="text-xs leading-[1.45] font-medium text-fg-4">
              {d.nameHint}
            </span>
          </div>
          {similar.length > 0 ? (
            <div role="note" className="flex gap-2.5 rounded-xl border border-warning/35 bg-warning/8 p-3 text-[13px] leading-normal text-fg [animation:fade-up_.25s_ease-out_both]">
              <TriangleAlert className="mt-px size-4 flex-none text-warning-fg" strokeWidth={2.2} aria-hidden="true" />
              <span>
                <b>{d.similarTitle}</b> {format(d.similarText, { names: similar.join(", ") })}
              </span>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="flex flex-col gap-2">
        <PersonPicker
          label={
            <>
              {d.coordinator} {isNew ? <span className="font-medium text-fg-4">{d.optional}</span> : null}
            </>
          }
          inputId={`${ids}-person`}
          query={search.query}
          onQuery={search.change}
          people={search.people}
          loading={search.loading}
          pickedId={pickedId}
          onPick={pick}
          hint={getMessages().adminTeam.search.hint}
          empty={search.query.trim() ? d.none : d.noTeachers}
          note={(person) => (person.current ? d.current : null)}
        />
        <span className="text-xs leading-[1.45] text-fg-4">{!isNew && !search.query.trim() && search.people?.length ? d.teachersHint : d.coordinatorHint}</span>
      </div>

      {refusalText ? (
        <div role="alert" className="flex gap-2.5 rounded-xl border border-danger/35 bg-danger/10 p-3 text-[13px] text-danger-fg">
          <TriangleAlert className="mt-px size-4 flex-none" strokeWidth={2.2} aria-hidden="true" />
          {refusalText}
        </div>
      ) : null}

      <button
        type="button"
        role="checkbox"
        aria-checked={approves}
        onClick={() => setApproves((on) => !on)}
        className="flex items-start gap-3 rounded-xl border border-line bg-surface-deep p-3 text-left text-fg"
      >
        <span
          aria-hidden="true"
          className={cn(
            "mt-px flex size-[22px] flex-none items-center justify-center rounded-[7px] border-2",
            approves ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-transparent",
          )}
        >
          {approves ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
        <span className="flex flex-col gap-0.5">
          <b className="text-sm">{d.approves}</b>
          <span className="text-xs leading-[1.45] text-fg-4">{d.approvesHint}</span>
        </span>
      </button>

      {shownError && shownError !== refusalText ? (
        <p role="alert" className="m-0 text-[13px] text-danger-fg">
          {shownError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        {current ? (
          <button type="button" onClick={removeCoordinator} disabled={pending} className="h-12 px-1 text-sm font-bold text-danger-fg">
            {d.remove}
          </button>
        ) : null}
        <span className="flex-1" />
        <button type="button" onClick={onClose} className="h-12 rounded-xl border border-line bg-surface-raised px-4 text-sm font-bold text-fg">
          {d.cancel}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className={cn(
            "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-bold transition-colors",
            ready ? "bg-accent text-on-accent" : "bg-card text-fg-4",
          )}
        >
          {pending ? <Spinner className="border-on-accent/30 border-t-on-accent" /> : null}
          {pending ? d.working : submitLabel}
        </button>
      </div>
    </Sheet>
  );
}
