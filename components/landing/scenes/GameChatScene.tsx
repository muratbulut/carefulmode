import { Gamepad2, Lock, TriangleAlert, User } from "lucide-react";
import { getMessages, rich } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DoneToast, FlagsLabel, SceneFigure, flagTags } from "./parts";
import "./GameChatScene.css";

const bubbleTiming = ["hs-bubble1", "hs-bubble2", "hs-bubble3"];
const bubbleRow = ["hs-chat-q1", "hs-chat-q2", "hs-chat-q3"];
const recoveryFlags = ["hs-f1", "hs-f2", "hs-f3"];

/** Kulaklıklı öğrenci: yüzsüz karartı. */
function Student() {
  return (
    <svg viewBox="0 0 150 200">
      <defs>
        <linearGradient id="hero-chat-me" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="hs-chat-me-top" />
          <stop offset="1" className="hs-chat-me-bottom" />
        </linearGradient>
      </defs>
      <path d="M14 200c0-46 26-74 61-74s61 28 61 74z" fill="url(#hero-chat-me)" />
      <circle cx="75" cy="78" r="36" fill="url(#hero-chat-me)" />
      <g className="hs-chat-headset">
        <path d="M33 86a42 42 0 0 1 84 0h-7a35 35 0 0 0-70 0z" />
        <rect x="27" y="72" width="16" height="28" rx="7" />
        <rect x="107" y="72" width="16" height="28" rx="7" />
      </g>
      <g className="hs-chat-headset-shine">
        <rect x="30" y="75" width="4" height="16" rx="2" />
        <rect x="110" y="75" width="4" height="16" rx="2" />
      </g>
    </svg>
  );
}

/** Bereli yabancı: öğrenciyle aynı tarzda karartı (düz renkler, saydamlık yok, ek yeri görünmez). */
function Stranger() {
  return (
    <svg viewBox="0 0 150 200">
      <defs>
        <linearGradient id="hero-chat-them" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="hs-chat-them-top" />
          <stop offset="1" className="hs-chat-them-bottom" />
        </linearGradient>
      </defs>
      <path d="M14 200c0-46 26-74 61-74s61 28 61 74z" fill="url(#hero-chat-them)" />
      <circle cx="75" cy="80" r="36" fill="url(#hero-chat-them)" />
      <path d="M40 74c0-26 15-42 35-42s35 16 35 42z" className="hs-chat-beanie" />
      <path d="M58 40c4-3 10-5 17-5" className="hs-chat-beanie-shine" strokeWidth="4" strokeLinecap="round" />
      <rect x="36" y="64" width="78" height="17" rx="8.5" className="hs-chat-beanie-band" />
      <g className="hs-chat-beanie-rib">
        {[46, 58, 70, 82, 94].map((x) => (
          <rect key={x} x={x} y="67" width="3" height="11" rx="1.5" />
        ))}
      </g>
      <circle cx="75" cy="27" r="9" className="hs-chat-pompom" />
    </svg>
  );
}

/**
 * Oyun sohbeti: yeni tanışılan biri sırayla hesap kurtarma sorularının cevaplarını sorar
 * (doğum günü, ilk evcil hayvan, annenin kızlık soyadı); bilgi verilmez, oyuncu bildirilir.
 */
export function GameChatScene() {
  const t = getMessages().landing.scenes.chat;
  return (
    <SceneFigure caption={t.caption} className="hs-chat">
      <div className="hs-chat-glow hs-chat-glow-me" />
      <div className="hs-chat-glow hs-chat-glow-them" />
      <div className="hs-figure hs-chat-me anim-float-1">
        <Student />
      </div>
      <div className="hs-figure hs-chat-them anim-float-1">
        <Stranger />
      </div>
      <div className="hs-pill hs-pop-early hs-chat-stranger">
        <User />
        {t.stranger}
      </div>
      <div className="hs-side hs-chat-recovery anim-float-2">
        <div className="hs-cap">{t.recoveryTitle}</div>
        {t.recovery.map((item, i) => (
          <div key={item} className="hs-row hs-chat-row">
            <Lock />
            <span className={recoveryFlags[i]}>{item}</span>
          </div>
        ))}
      </div>
      {t.questions.map((question, i) => (
        <div key={question} className={cn("hs-bubble", "hs-bubble-them", "hs-chat-question", bubbleRow[i], bubbleTiming[i])}>
          {rich(question, flagTags)}
        </div>
      ))}
      <div className="hs-bubble hs-bubble-me hs-bubble-reply hs-chat-reply">
        {t.reply}
        <br />
        <span className="hs-btn hs-red hs-chat-report anim-press">
          <TriangleAlert strokeWidth={2.4} />
          {t.report}
        </span>
      </div>
      <div className="hs-pill hs-pop-early hs-chat-room">
        <Gamepad2 />
        {t.room}
      </div>
      <FlagsLabel className="hs-chat-label" />
      <DoneToast>{t.done}</DoneToast>
    </SceneFigure>
  );
}
