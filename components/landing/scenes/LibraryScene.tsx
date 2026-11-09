import { Check, Lock, LogOut, Monitor, User } from "lucide-react";
import { getMessages, rich } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DoneToast, FlagsLabel, Scan, SceneFigure } from "./parts";
import "./LibraryScene.css";

type Shade = "teal" | "navy" | "olive" | "slate" | "plum" | "steel" | "indigo";

/** Raftaki kitaplar: x, y, en, boy, renk ve (devrik olanlarda) sol alt köşesinden eğim. */
const BOOKS: [number, number, number, number, Shade, number?][] = [
  [6, 20, 14, 64, "teal"], [22, 14, 22, 70, "navy"], [46, 20, 22, 64, "olive"], [70, 30, 22, 54, "navy"],
  [94, 30, 14, 54, "olive"], [110, 14, 14, 70, "slate"], [126, 30, 16, 54, "plum"], [144, 30, 18, 54, "teal"],
  [164, 24, 14, 60, "steel"], [180, 30, 16, 54, "navy"], [198, 30, 22, 54, "teal"], [222, 20, 22, 64, "olive"],
  [246, 24, 12, 60, "olive"], [260, 14, 16, 70, "steel"], [278, 24, 22, 60, "slate"], [302, 14, 18, 70, "slate"],
  [322, 14, 14, 70, "navy"], [338, 20, 12, 64, "navy", -14], [360, 24, 22, 60, "indigo"], [402, 14, 12, 70, "plum"],
  [416, 20, 16, 64, "navy"], [434, 20, 16, 64, "plum"], [452, 30, 22, 54, "teal"], [476, 24, 12, 60, "olive"],
  [6, 120, 16, 54, "teal"], [24, 104, 16, 70, "teal"], [60, 120, 16, 54, "indigo"], [96, 104, 12, 70, "indigo"],
  [110, 114, 16, 60, "steel"], [128, 114, 16, 60, "plum"], [146, 110, 12, 64, "steel"], [160, 110, 16, 64, "olive"],
  [178, 104, 12, 70, "indigo"], [192, 126, 14, 48, "steel", -14], [216, 120, 14, 54, "navy"], [232, 110, 22, 64, "navy"],
  [256, 114, 14, 60, "navy"], [272, 114, 22, 60, "plum"], [296, 120, 16, 54, "plum"], [332, 110, 18, 64, "plum"],
  [352, 120, 22, 54, "olive"], [376, 114, 18, 60, "steel"], [396, 120, 22, 54, "steel", -14], [428, 110, 22, 64, "plum"],
  [452, 120, 12, 54, "steel"], [466, 110, 14, 64, "plum", -14],
];

function Shelf() {
  return (
    <div className="hs-library-shelf">
      <svg viewBox="0 0 500 184" preserveAspectRatio="none">
        {BOOKS.map(([x, y, width, height, shade, tilt]) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width={width}
            height={height}
            rx="2"
            className={`hs-library-${shade}`}
            transform={tilt ? `rotate(${tilt} ${x} ${y + height})` : undefined}
          />
        ))}
        <rect x="0" y="84" width="500" height="6" rx="2" className="hs-library-steel" />
        <rect x="0" y="174" width="500" height="6" rx="2" className="hs-library-steel" />
      </svg>
    </div>
  );
}

/**
 * Kütüphane bilgisayarı: süre dolmuş, hesap hâlâ açık, şifre kaydedilmiş, "beni hatırla" işaretli
 * ve sırada başka biri var; çıkış yapılır, kayıtlı şifre silinir.
 */
export function LibraryScene() {
  const t = getMessages().landing.scenes.library;
  return (
    <SceneFigure caption={t.caption} className="hs-library">
      <Shelf />
      <div className="hs-laptop hs-library-laptop anim-float-1">
        <div className="hs-screen hs-library-screen">
          <div className="hs-library-top">
            <b>
              <Monitor />
              {t.computer}
            </b>
            <span>{rich(t.timeLeft, { time: (chunk) => <span className="hs-library-clock font-mono">{chunk}</span> })}</span>
          </div>
          <div className="hs-library-time">
            <i />
          </div>
          <div className="hs-library-page">
            <Scan />
            <div className="hs-library-account">
              <div className="hs-who">
                <div className="hs-avatar hs-library-avatar">{t.name.charAt(0)}</div>
                <div>
                  <b>{t.name}</b>
                  <span className="hs-sub hs-f1">{t.session}</span>
                </div>
              </div>
            </div>
            <div className="hs-library-rows">
              <div className="hs-row">
                <Lock />
                <span className="hs-f2">{t.saved}</span>
              </div>
              <div className="hs-row">
                <Check strokeWidth={2.6} />
                <span className="hs-f3">{t.remember}</span>
              </div>
            </div>
            <span className="hs-btn hs-red hs-library-sign-out anim-press">
              <LogOut strokeWidth={2.4} />
              {t.signOut}
            </span>
          </div>
        </div>
        <div className="hs-laptop-base" />
      </div>
      <div className="hs-side hs-library-log anim-float-2">
        <div className="hs-cap">{t.logTitle}</div>
        {t.log.map((entry, i) => (
          <div key={entry.time} className={cn("hs-library-entry", i === t.log.length - 1 && "hs-library-me")}>
            <span className="font-mono">{entry.time}</span>
            {i === t.log.length - 1 ? <b>{entry.name}</b> : <span>{entry.name}</span>}
          </div>
        ))}
        <div className="hs-library-entry hs-library-next">
          <span className="font-mono">{t.nextTime}</span>
          <b className="hs-pop">
            <User />
            {t.next}
          </b>
        </div>
      </div>
      <FlagsLabel />
      <DoneToast>{t.done}</DoneToast>
    </SceneFigure>
  );
}
