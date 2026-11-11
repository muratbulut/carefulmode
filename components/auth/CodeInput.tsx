"use client";

import { Clock } from "lucide-react";
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { codeLength, codeValidMinutes } from "@/lib/account/shared";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type CodeState = "idle" | "ok" | "bad";

/**
 * 6 kutulu kod girişi (Tur 1, ekran 7). Her rakamdan sonra imleç sonraki kutuya geçer,
 * kodun tamamı tek seferde yapıştırılabilir, telefonda klavye mailden gelen kodu önerir.
 * Değer formda "code" adlı gizli alanla gönderilir. Altında kodun kaç dakika geçerli olduğu yazar.
 */
export function CodeInput({
  label,
  state = "idle",
  onChange,
  name = "code",
}: {
  label: string;
  state?: CodeState;
  onChange?: (code: string) => void;
  name?: string;
}) {
  const t = getMessages().auth.code;
  const [digits, setDigits] = useState<string[]>(() => Array(codeLength).fill(""));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const firstEmpty = digits.indexOf("");

  function update(next: string[]) {
    setDigits(next);
    onChange?.(next.join(""));
  }

  /** `start` kutusundan başlayarak rakamları yerleştirir; son dolan kutuya odaklanır. */
  function fill(start: number, text: string) {
    const incoming = text.replace(/\D/g, "").split("");
    if (incoming.length === 0) return;
    const next = [...digits];
    let i = start;
    for (const ch of incoming) {
      if (i >= codeLength) break;
      next[i] = ch;
      i++;
    }
    update(next);
    inputs.current[Math.min(i, codeLength - 1)]?.focus();
  }

  function onInput(i: number, value: string) {
    const raw = value.replace(/\D/g, "");
    if (raw.length > 1) return fill(i, raw);
    const next = [...digits];
    next[i] = raw;
    update(next);
    if (raw && i < codeLength - 1) inputs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[i] && i > 0) {
      event.preventDefault();
      const next = [...digits];
      next[i - 1] = "";
      update(next);
      inputs.current[i - 1]?.focus();
    } else if (event.key === "ArrowLeft" && i > 0) {
      inputs.current[i - 1]?.focus();
    } else if (event.key === "ArrowRight" && i < codeLength - 1) {
      inputs.current[i + 1]?.focus();
    }
  }

  function onPaste(i: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    fill(i, event.clipboardData.getData("text"));
  }

  return (
    <fieldset>
      <legend className="mb-2.5 text-sm font-bold text-fg-2">{label}</legend>
      <div className={cn("flex gap-2 sm:gap-2.5", state === "bad" && "anim-shake")}>
        <input type="hidden" name={name} value={digits.join("")} />
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={digit}
            onChange={(e) => onInput(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={(e) => onPaste(i, e)}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={i === 0 ? codeLength : 1}
            aria-label={format(t.digit, { n: i + 1 })}
            data-testid={`code-digit-${i}`}
            className={cn(
              "h-16 w-[52px] min-w-0 rounded-[14px] border-2 bg-canvas text-center font-mono text-[26px] font-bold text-fg transition-colors focus:outline-none sm:h-[70px] sm:w-[60px] sm:text-[28px]",
              state === "ok"
                ? "border-success"
                : state === "bad"
                  ? "border-danger"
                  : i === firstEmpty
                    ? "border-accent"
                    : digit
                      ? "border-line-strong"
                      : "border-line",
              "focus:border-accent",
            )}
          />
        ))}
      </div>
      <p className="mt-2.5 mb-0 flex items-center gap-1.5 text-[13px] leading-[1.45] text-fg-3">
        <Clock className="size-3.5 flex-none" strokeWidth={2.2} aria-hidden="true" />
        {format(t.validFor, { minutes: codeValidMinutes })}
      </p>
    </fieldset>
  );
}
