"use client";

import { useState } from "react";
import { asksDepartment, educationLevels, type EducationStatus } from "@/lib/account/shared";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Field, inputClass, selectClass } from "./fields";

const educationOptions = ["STUDYING", "GRADUATED", "NONE"] as const;

/**
 * İsteğe bağlı eğitim durumu (kayıt ve profil): Okuyorum / Mezunum / Belirtmeyeyim, sonra
 * kademe ve ön lisanstan itibaren bölüm. Forma "education", "level", "department" alanlarıyla gider.
 */
export function EducationFields({
  initial,
  error,
}: {
  initial?: { status: EducationStatus | ""; level: string; department: string };
  error?: string;
}) {
  const m = getMessages().auth.signUp;
  const [education, setEducation] = useState<EducationStatus | "NONE" | "">(initial?.status ?? "");
  const [level, setLevel] = useState(initial?.level ?? "");
  const [department, setDepartment] = useState(initial?.department ?? "");
  const status = education === "STUDYING" || education === "GRADUATED" ? education : "";
  const levels = status ? educationLevels(status) : [];

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-bold text-fg-2">
        {m.education} <span className="font-medium text-fg-4">{m.optional}</span>
      </legend>
      <input type="hidden" name="education" value={status} />
      <div className="grid grid-cols-3 gap-2">
        {educationOptions.map((option) => {
          const on = education === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() => {
                // Seçili düğmeye tekrar basınca seçim kalkar.
                setEducation(on ? "" : option);
                setLevel("");
                setDepartment("");
              }}
              className={cn(
                "h-11 cursor-pointer rounded-xl border px-1 text-[13px] leading-tight font-bold transition-colors min-[400px]:text-sm",
                on ? "border-accent bg-accent/14 text-accent-light" : "border-line bg-canvas text-fg-2 hover:border-line-strong",
              )}
            >
              {m.educationOptions[option]}
            </button>
          );
        })}
      </div>
      {levels.length > 0 ? (
        <div className="mt-1 grid grid-cols-1 gap-2.5 anim-pop sm:grid-cols-2">
          <Field id="level" label={status === "GRADUATED" ? m.levelGraduated : m.levelStudying}>
            <select id="level" name="level" value={level} onChange={(e) => setLevel(e.target.value)} className={selectClass}>
              <option value="">{m.levelPlaceholder}</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          {asksDepartment(status, level) ? (
            <Field id="department" label={m.department} error={error}>
              <input
                id="department"
                name="department"
                placeholder={m.departmentPlaceholder}
                maxLength={60}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={inputClass}
              />
            </Field>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}
