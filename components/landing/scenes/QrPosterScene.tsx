import { X } from "lucide-react";
import { getMessages, rich } from "@/lib/i18n";
import { DoneToast, FlagsLabel, Scan, SceneFigure, flagTags } from "./parts";
import "./QrPosterScene.css";

/**
 * QR'ın deseni: 21x21 modül, "1" koyu. Bilerek okunamaz (bulucu kareleri var ama zamanlama ve biçim
 * bilgisi yanlış); hiçbir adrese götürmez. Tuvaldeki desenin aynısı.
 */
const QR_ROWS = [
  "111111101110101111111",
  "100000101000101000001",
  "101110100011101011101",
  "101110100011101011101",
  "101110101111101011101",
  "100000100001101000001",
  "111111100010101111111",
  "000000000010100000000",
  "111101010000100000001",
  "111011101100110010111",
  "001000010000110000101",
  "110011111000010001010",
  "011110101011011000011",
  "000000000010101110101",
  "111111101110111010101",
  "100000100100110110100",
  "101110101000100110001",
  "101110100111100111011",
  "101110100111011100100",
  "100000100111001101000",
  "111111100110110000011",
];

/** Desenin tek parça yolu: her satırdaki ardışık koyu modüller tek dikdörtgen. */
const QR_PATH = QR_ROWS.flatMap((row, y) =>
  [...row.matchAll(/1+/g)].map((run) => `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`),
).join("");

function FakeQr({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="-1 -1 23 23">
      <rect x="-1" y="-1" width="23" height="23" rx="1.5" className="hs-qr-paper" />
      <path d={QR_PATH} className="hs-qr-ink" />
    </svg>
  );
}

/**
 * Koridor afişindeki QR: "mağazada yok" denen elmas hilesi için kod; telefon kamerası okuyunca
 * .apk bağlantısı ve bilinmeyen uygulama sorusu çıkar; "Açma" basılır.
 */
export function QrPosterScene() {
  const t = getMessages().landing.scenes.qr;
  return (
    <SceneFigure caption={t.caption} className="hs-qr">
      <div className="hs-qr-poster anim-float-2">
        <div className="hs-qr-poster-title font-heading">{t.posterTitle}</div>
        <div className="hs-qr-poster-text">{rich(t.posterText, flagTags)}</div>
        <FakeQr className="hs-qr-poster-qr" />
        <div className="hs-qr-poster-place">{t.posterPlace}</div>
      </div>
      <div className="hs-qr-phone anim-float-1">
        <div className="hs-qr-glass">
          <div className="hs-qr-island" />
          <div className="hs-qr-status">
            <span>{t.clock}</span>
            <i className="hs-qr-battery" />
          </div>
          <div className="hs-qr-camera">
            <FakeQr className="hs-qr-camera-qr" />
            <div className="hs-qr-frame">
              <i className="hs-qr-corner" />
              <i className="hs-qr-corner" />
              <i className="hs-qr-corner" />
              <i className="hs-qr-corner" />
            </div>
          </div>
          <div className="hs-qr-sheet">
            <span className="hs-qr-grab" />
            <Scan />
            <div className="hs-qr-link hs-pop">
              <span className="hs-qr-address font-mono">{rich(t.link, flagTags)}</span>
            </div>
            <div>
              <div className="hs-qr-question font-heading">{rich(t.question, flagTags)}</div>
              <div className="hs-sub hs-qr-note">{t.note}</div>
            </div>
            <div className="hs-qr-actions">
              <span className="hs-btn hs-blue hs-qr-action">{t.open}</span>
              <span className="hs-btn hs-red hs-qr-action anim-press">
                <X strokeWidth={2.6} />
                {t.dontOpen}
              </span>
            </div>
          </div>
        </div>
      </div>
      <FlagsLabel />
      <DoneToast>{t.done}</DoneToast>
    </SceneFigure>
  );
}
