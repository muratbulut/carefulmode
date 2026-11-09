"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Spinner } from "@/components/status/Spinner";
import { createLab, type CreateLabState } from "@/lib/admin/lab-actions";
import { format, getMessages } from "@/lib/i18n";
import { templates, type Template } from "@/lib/lab/content";
import { paths } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { neighborhoodColor } from "../colors";

/** trainings: mahallenin eğitim odaları sırayla (taslaklar dahil); ilki temel eğitim. */
export type NewLabNeighborhood = { slug: string; name: string; color: string; trainings: { id: string; name: string }[]; scenarios: number };

// Şablonların formdaki sırası (Lablar-Son "Yeni oda": önce senaryo şablonları).
const order: Template[] = ["INBOX", "MESSAGING", "TRAINING"];

export function NewLabForm({ neighborhoods, initialNeighborhood }: { neighborhoods: NewLabNeighborhood[]; initialNeighborhood: string }) {
  const t = getMessages().admin.newLab;
  const [state, action, pending] = useActionState<CreateLabState, FormData>(createLab, {});
  const [neighborhood, setNeighborhood] = useState(state.values?.neighborhood ?? initialNeighborhood);
  const [template, setTemplate] = useState<Template>(
    templates.includes(state.values?.template as Template) ? (state.values!.template as Template) : "INBOX",
  );
  const [name, setName] = useState(state.values?.name ?? "");
  const [gate, setGate] = useState(state.values?.gate ?? "");
  const [tried, setTried] = useState(false);

  const selected = neighborhoods.find((n) => n.slug === neighborhood) ?? neighborhoods[0];
  const chosen = template;
  const trainings = selected?.trainings ?? [];
  // Seçili eğitim başka mahalleninse (mahalle değişti) temel eğitime döner.
  const gateValue = trainings.some((x) => x.id === gate) ? gate : "";
  const nameError = tried && name.trim().length < 4;
  const serverError = state.error && state.error !== "name" ? t.errors[state.error] : null;

  return (
    <main className="flex flex-col gap-[22px] px-4 pt-6 pb-16 lg:px-9 lg:pt-8 lg:pb-[72px]">
      <Link
        href={paths.adminLabs}
        className="inline-flex h-[38px] items-center gap-1 self-start rounded-[10px] border border-line bg-surface pr-3 pl-1.5 text-sm font-bold text-fg no-underline"
      >
        <ArrowLeft className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
        {t.back}
      </Link>

      <form
        action={action}
        noValidate
        onSubmit={(e) => {
          if (name.trim().length < 4) {
            e.preventDefault();
            setTried(true);
          }
        }}
        aria-labelledby="admin-new-lab-title"
        className="flex w-full max-w-[560px] flex-col gap-[18px] rounded-3xl border border-line bg-surface p-5 lg:p-[26px]"
      >
        <h1 id="admin-new-lab-title" className="m-0 font-heading text-[22px] font-bold">
          {t.title}
        </h1>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-sm font-bold text-fg-2">{t.neighborhood}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {neighborhoods.map((n) => {
              const on = n.slug === neighborhood;
              const color = neighborhoodColor(n.color);
              return (
                <label
                  key={n.slug}
                  className={cn(
                    "flex h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-bold text-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                    on ? cn("bg-card", color.border) : "border-line bg-surface-deep",
                  )}
                >
                  <input
                    type="radio"
                    name="neighborhood"
                    value={n.slug}
                    checked={on}
                    onChange={() => {
                      setNeighborhood(n.slug);
                      setGate("");
                    }}
                    className="sr-only"
                  />
                  <span aria-hidden="true" className={cn("size-2.5 flex-none rounded-[3px]", color.dot)} />
                  {n.name}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-sm font-bold text-fg-2">{t.template}</legend>
          <span className="-mt-0.5 mb-1 text-xs text-fg-4">{t.templateHint}</span>
          <div className="flex flex-col gap-2">
            {order.map((key) => {
              const on = key === chosen;
              return (
                <label
                  key={key}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border bg-surface-deep p-3 text-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                    on ? "border-accent" : "border-line",
                    "cursor-pointer",
                  )}
                >
                  <input
                    type="radio"
                    name="template"
                    value={key}
                    checked={on}
                    onChange={() => setTemplate(key)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 flex size-5 flex-none items-center justify-center rounded-full border-2",
                      on ? "border-accent" : "border-line-strong",
                    )}
                  >
                    <span className={cn("size-2.5 rounded-full", on ? "bg-accent" : "bg-transparent")} />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <b className="text-sm">{t.templates[key].title}</b>
                    <span className="text-xs leading-[1.4] text-fg-3">{t.templates[key].text}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {chosen !== "TRAINING" ? (
          <label className="flex flex-col gap-2 text-sm font-bold text-fg-2">
            {t.gate}
            <span className="-mt-1 text-xs font-medium text-fg-4">{trainings.length > 0 ? t.gateHint : t.gateNone}</span>
            {trainings.length > 0 ? (
              <select
                name="gate"
                value={gateValue}
                onChange={(e) => setGate(e.target.value)}
                className="h-12 w-full rounded-xl border border-line bg-canvas px-3 text-base font-normal text-fg"
              >
                {trainings.map((x, i) => (
                  // Temel eğitim boş değerle gider: temel eğitim değişirse oda yeni temele bağlı kalır.
                  <option key={x.id} value={i === 0 ? "" : x.id}>
                    {i === 0 ? format(t.gateBasic, { name: x.name }) : x.name}
                  </option>
                ))}
              </select>
            ) : null}
          </label>
        ) : null}

        <label className="flex flex-col gap-2 text-sm font-bold text-fg-2">
          {t.name}
          <input
            type="text"
            name="name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.namePlaceholder}
            aria-invalid={nameError || state.error === "name"}
            aria-describedby={nameError || state.error === "name" ? "admin-new-lab-name-error" : undefined}
            className={cn(
              "h-12 w-full rounded-xl border bg-canvas px-3.5 text-base font-normal text-fg placeholder:text-fg-4",
              nameError || state.error === "name" ? "border-danger" : "border-line",
            )}
          />
        </label>
        {nameError || state.error === "name" ? (
          <span id="admin-new-lab-name-error" className="-mt-3 text-[13px] text-danger-fg">
            {t.nameError}
          </span>
        ) : null}

        <label className="flex cursor-pointer items-start gap-3 text-sm text-fg-2">
          <input type="checkbox" name="example" defaultChecked={state.values?.example ?? false} className="mt-0.5 size-[18px] flex-none accent-accent" />
          <span className="flex flex-col gap-0.5">
            <b className="text-fg">{t.example}</b>
            <span className="text-xs text-fg-3">{t.exampleHint}</span>
          </span>
        </label>

        {selected ? (
          <span className="text-[13px] text-fg-3">
            {chosen === "TRAINING"
              ? format(trainings.length > 0 ? t.whereAdvanced : t.whereTraining, { neighborhood: selected.name })
              : format(t.where, { neighborhood: selected.name, n: selected.scenarios + 1 })}
          </span>
        ) : null}

        {serverError ? (
          <p role="alert" className="m-0 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger-fg">
            {serverError}
          </p>
        ) : null}

        <div className="flex gap-2.5">
          <Link
            href={paths.adminLabs}
            className="flex h-12 flex-1 items-center justify-center rounded-xl border border-line bg-surface-raised text-[15px] font-bold text-fg no-underline"
          >
            {t.cancel}
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-bold text-on-accent disabled:opacity-70"
          >
            {pending ? <Spinner tone="onAccent" /> : null}
            {pending ? t.creating : t.create}
          </button>
        </div>
      </form>
    </main>
  );
}
