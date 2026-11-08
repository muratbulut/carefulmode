import { Check, Image as ImageIcon, Lock, LogOut, Phone, PhoneOff, RotateCcw, Search, Wallet, type LucideIcon } from "lucide-react";
import { CallerAvatar } from "@/components/lab/mission/CallerAvatar";
import { cardIconMap } from "@/components/lab/training/card-icons";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AppIcon } from "./PhoneMockup";
import type { LabDetailData, MissionCoverData } from "./types";
import "./MissionCover.css";

/** Satıştaki hazırlık maddelerinin ikonları, sırayla: fotoğrafları yedekle, hesaplardan çık, sıfırla. */
const stepIcons: LucideIcon[] = [ImageIcon, LogOut, RotateCcw];

/**
 * Görevli odanın kapağındaki görsel (Murat, 3 Kasım, tuvalde "3 sade"): telefon çalıyor (yalnızca
 * gelen arama ekranı, konuşma yok), çevresine yazısız hikâye kartları sırayla düşer: ürün ya da
 * ilan ve fiyatı, iki mail ya da iki alıcı (baş harf ve çizgiler, "?"), annenin onay kodu ya da
 * kargodan önceki hazırlık, bir etiket. 14 saniyelik döngü `MissionCover.css`'te; "Hareketi azalt"
 * açıksa her şey son hâliyle durur. Hangi mailin sahte olduğu burada hiç yoktur.
 */
export function MissionCover({ cover, template, className }: { cover: MissionCoverData; template: LabDetailData["template"]; className?: string }) {
  const t = getMessages();
  const d = t.lab.detail.cover;
  const Deal = cardIconMap[cover.icon];
  const Badge = cover.badge ? cardIconMap[cover.badge] : null;
  return (
    <div role="img" aria-label={format(d.label, { caller: cover.caller })} className={cn("mc-root", `mc-${cover.kind}`, className)}>
      <div aria-hidden="true" className="mc-glow" />
      <div aria-hidden="true" className="mc-orbit">
        <span className="mc-orbit-dot" />
        <span className="mc-orbit-dot mc-orbit-dot-2" />
      </div>
      {cover.kind === "shop" ? (
        <div aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={`mc-confetti mc-confetti-${n}`} />
          ))}
        </div>
      ) : null}

      <div aria-hidden="true" className="mc-stage">
        {/* Telefon: yalnızca gelen arama */}
        <div className="mc-phone">
          <div className="mc-screen">
            <span className="mc-avatar">
              <span className="mc-wave" />
              <span className="mc-wave mc-wave-2" />
              <CallerAvatar look={cover.look} talking={false} crop="face" className="relative size-full rounded-full" />
            </span>
            <span className="mc-caller font-heading">{cover.caller}</span>
            <span className="mc-calling">
              {d.calling}
              <span className="mc-dots">
                {[1, 2, 3].map((n) => (
                  <span key={n}>{d.dot}</span>
                ))}
              </span>
            </span>
          </div>
          <div className="mc-buttons">
            <span className="mc-button">
              <span className="mc-round mc-decline">
                <PhoneOff className="size-6" strokeWidth={2.2} />
              </span>
              {t.lab.call.decline}
            </span>
            <span className="mc-button">
              <span className="mc-round mc-accept">
                <Phone className="size-6" strokeWidth={2.2} />
              </span>
              {t.lab.call.accept}
            </span>
          </div>
        </div>

        {/* 1. kart: ürün ya da ilan, fiyat */}
        <div className="mc-card mc-card-1">
          <div className="mc-deal">
            <Deal className="mc-hop size-11" strokeWidth={1.8} />
          </div>
          <div className="mc-price font-heading">{cover.price}</div>
          {cover.kind === "shop" ? (
            <div className="mc-track">
              <span className="mc-fill" />
            </div>
          ) : null}
        </div>

        {/* 2. kart: iki mail ya da iki alıcı, yazısız */}
        <div className="mc-card mc-card-2">
          <div className="flex items-center justify-between">
            <AppIcon template={template} className="size-6" />
            <span className="mc-ask">{d.ask}</span>
          </div>
          <div className="mc-rows">
            <div className="mc-typing">
              <span />
              <span />
              <span />
            </div>
            {cover.senders.map((sender, i) => (
              <div key={i} className={cn("mc-row", i === 0 ? "mc-row-1" : "mc-row-2")}>
                <span className={`mc-initial mc-tone-${sender.tone % 3}`}>{sender.initial}</span>
                <span className="mc-lines">
                  <span />
                  <span />
                </span>
              </div>
            ))}
            {cover.kind === "shop" ? <Search className="mc-lens" strokeWidth={2} /> : null}
          </div>
        </div>

        {/* 3. kart: alışta annenin onay kodu, satışta kargodan önceki hazırlık */}
        {cover.kind === "shop" ? (
          <div className="mc-card-3">
            <div className="mc-card mc-sms">
              <span className="mc-lock">
                <Lock className="size-[18px]" strokeWidth={2.6} />
              </span>
              <span className="mc-code">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <span key={n} />
                ))}
              </span>
            </div>
          </div>
        ) : (
          <div className="mc-card mc-card-3 mc-steps">
            {stepIcons.slice(0, Math.max(cover.steps, 1)).map((Icon, i) => (
              <div key={i} className="mc-step">
                <Icon className="size-5 flex-none" strokeWidth={2} />
                <span className="mc-step-line" />
                <span className="mc-box">
                  <span className={`mc-tick mc-tick-${i + 1}`}>
                    <Check className="size-3" strokeWidth={4} />
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Etiket */}
        {cover.kind === "sale" ? (
          <div className="mc-sticker">
            <span className="mc-wallets">
              <Wallet className="size-5" strokeWidth={2.2} />
              <span className="mc-coin-track">
                <span className="mc-coin" />
              </span>
              <Wallet className="size-5" strokeWidth={2.2} />
            </span>
          </div>
        ) : Badge ? (
          <div className="mc-sticker">
            <span className="mc-badge mc-hop">
              <Badge className="size-8" strokeWidth={2} />
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
