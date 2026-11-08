import { CreditCard, Lock, Sparkle, Ticket } from "lucide-react";
import type { QuizArt } from "@/lib/lab/content";
import { getMessages } from "@/lib/i18n";

/**
 * Mini testin üstündeki hareketli çizim (Tur 7): gift hediye kutusu ve soru işareti, coin oltaya
 * takılı 1 TL. Yalnızca süs; ekran okuyucudan gizli. "Hareketi azalt" açıksa durur.
 */
export function QuizArtView({ art }: { art: QuizArt }) {
  return (
    <div
      aria-hidden="true"
      className="relative h-[150px] overflow-hidden rounded-[20px] border border-card bg-[radial-gradient(60%_90%_at_50%_100%,color-mix(in_srgb,var(--purple)_18%,transparent),transparent_70%),var(--surface-deep)]"
    >
      {art === "gift" ? <Gift /> : <Coin />}
    </div>
  );
}

function Gift() {
  const m = getMessages().lab.training.quiz;
  return (
    <>
      <div className="absolute top-9 left-[calc(50%-46px)] size-[92px] [animation:art-bob_3.2s_ease-in-out_infinite]">
        <div className="absolute top-[38px] left-1.5 h-[54px] w-20 rounded-[10px] bg-[linear-gradient(135deg,var(--art-gift-1),var(--art-gift-2))]" />
        <div className="absolute top-[38px] left-10 h-[54px] w-3 bg-warning" />
        <div className="absolute top-[22px] left-0 h-5 w-[92px] origin-[20%_100%] rounded-lg bg-[linear-gradient(135deg,var(--art-lid-1),var(--art-lid-2))] [animation:gift-lid_2.4s_ease-in-out_infinite]">
          <div className="absolute top-0 left-10 h-5 w-3 bg-warning" />
        </div>
      </div>
      <span className="absolute top-[18px] left-[calc(50%+46px)] font-heading text-[40px] font-bold text-warning-fg [animation:qmark_1.8s_ease-in-out_infinite]">{m.qmark}</span>
      <Ticket className="absolute top-[70px] left-[calc(50%-120px)] size-[34px] -rotate-[14deg] text-accent-fg" strokeWidth={1.8} />
      <Sparkle className="absolute top-[92px] left-[calc(50%+84px)] size-[22px] rotate-12 text-pink-fg" strokeWidth={2} />
    </>
  );
}

function Coin() {
  const m = getMessages().lab.training.quiz;
  return (
    <>
      <div className="absolute -top-2.5 left-[calc(50%-40px)] h-[150px] w-20 [animation:hook-line_3s_ease-in-out_infinite]">
        <span className="absolute top-0 left-[39px] h-[62px] w-0.5 bg-[repeating-linear-gradient(180deg,var(--fg-4)_0_4px,transparent_4px_8px)]" />
        <svg width="40" height="34" viewBox="0 0 40 34" className="absolute top-[58px] left-[22px]">
          <path d="M18 0 v14 a10 10 0 1 1 -12 -6" fill="none" className="stroke-warning" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <div className="absolute top-[88px] left-2.5 flex size-[60px] items-center justify-center rounded-full border-[3px] border-art-coin-edge bg-[radial-gradient(circle_at_35%_30%,var(--art-chip-1),var(--art-chip-2)_70%)] font-heading text-lg font-bold text-art-coin-ink [animation:coin-spin_2.6s_ease-in-out_infinite]">
          {m.oneTl}
        </div>
      </div>
      <CreditCard className="absolute top-14 left-[calc(50%-130px)] size-[34px] text-danger-fg" strokeWidth={1.8} />
      <Lock className="absolute top-[50px] left-[calc(50%+96px)] size-7 text-danger-fg" strokeWidth={1.8} />
    </>
  );
}
