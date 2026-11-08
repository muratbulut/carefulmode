"use client";

import { Check, Circle, Lock } from "lucide-react";
import { format, getMessages } from "@/lib/i18n";
import { crackTime, type PasswordCheck, type PasswordEvaluation } from "@/lib/password-strength";
import { cn } from "@/lib/utils";
import { Notice } from "./fields";

const checkOrder: PasswordCheck[] = ["length", "mix", "symbol", "safe"];

function crackText(seconds: number) {
  const t = getMessages().auth.strength.time;
  const { unit, amount } = crackTime(seconds);
  return format(t[unit], { n: amount });
}

/** Gösterge çubuğunun rengi: 4 madde yeşil, 3 camgöbeği, 2 sarı, daha azı kırmızı. */
function segmentColor(score: number) {
  if (score >= 4) return "bg-success";
  if (score === 3) return "bg-accent";
  if (score === 2) return "bg-warning";
  return "bg-danger";
}

/**
 * Canlı şifre gücü göstergesi (öğretici kısım): 4 parçalı çubuk, tek tek yeşile dönen
 * maddeler ve şifrenin ne kadar sürede kırılabileceğini söyleyen kutu.
 */
export function PasswordStrength({ password, evaluation, id }: { password: string; evaluation: PasswordEvaluation; id: string }) {
  const t = getMessages().auth.strength;
  const filled = password.length > 0;
  const lit = filled ? Math.max(evaluation.score, evaluation.common ? 1 : 0) : 0;

  let message: string = t.info;
  if (evaluation.common) message = t.common;
  else if (evaluation.guessable) message = t.guessable;
  else if (filled && evaluation.score >= 4) message = format(t.good, { time: crackText(evaluation.crackSeconds) });
  else if (filled) {
    const fix = t.fix[evaluation.missing ?? "digit"];
    message = format(t.weak, { time: crackText(evaluation.crackSeconds), fix });
  }

  return (
    <div id={id} className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-1.5" role="meter" aria-label={t.label} aria-valuemin={0} aria-valuemax={4} aria-valuenow={evaluation.score}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1.5 rounded-full transition-colors duration-300", i < lit ? segmentColor(evaluation.score) : "bg-card")} />
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-x-3.5 gap-y-1.5 sm:grid-cols-2">
        {checkOrder.map((key) => {
          const ok = evaluation.checks[key];
          return (
            <li key={key} className={cn("flex items-center gap-2 text-sm", ok ? "text-fg" : "text-fg-4")} data-ok={ok}>
              {ok ? (
                <Check className="size-4 flex-none text-success anim-pop" strokeWidth={2.6} aria-hidden="true" />
              ) : (
                <Circle className="size-4 flex-none text-fg-4" strokeWidth={2.4} aria-hidden="true" />
              )}
              {t.checks[key]}
            </li>
          );
        })}
      </ul>
      <Notice tone={evaluation.tone} icon={Lock}>
        {message}
      </Notice>
    </div>
  );
}
