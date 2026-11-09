import { Eye, ShieldCheck, X } from "lucide-react";
import { getMessages, rich } from "@/lib/i18n";
import { DoneToast, FlagsLabel, Scan, SceneFigure, ShieldBadge, flagTags } from "./parts";
import "./UsbScene.css";

/**
 * Bulunmuş flash bellek: "Sınav soruları" etiketli bellek dizüstüne takılır, pdf gibi görünen bir
 * program değişiklik yapmak ister; "Hayır" basılır, bellek çıkarılır.
 */
export function UsbScene() {
  const t = getMessages().landing.scenes.usb;
  return (
    <SceneFigure caption={t.caption} className="hs-usb">
      <div className="hs-laptop hs-usb-laptop anim-float-1">
        <div className="hs-screen hs-usb-screen">
          <div className="hs-usb-desk" />
          <Scan />
          <div className="hs-usb-dialog">
            <div className="hs-usb-title font-heading">
              <ShieldCheck strokeWidth={1.8} />
              {t.dialogTitle}
            </div>
            <div className="hs-usb-question font-heading">{rich(t.question, flagTags)}</div>
            <div className="hs-usb-detail">
              {rich(t.program, { b: (chunk) => <b>{chunk}</b>, f2: (chunk) => <b>{flagTags.f2(chunk)}</b> })}
            </div>
            <div className="hs-usb-detail">{rich(t.publisher, { f3: (chunk) => <b className="hs-f3">{chunk}</b> })}</div>
            <div className="hs-btns">
              <span className="hs-btn hs-blue">{t.yes}</span>
              <span className="hs-btn hs-red anim-press">
                <X strokeWidth={2.6} />
                {t.no}
              </span>
            </div>
          </div>
        </div>
        <div className="hs-laptop-base hs-usb-laptop-base" />
        <div className="hs-usb-slot" />
        <div className="hs-usb-clip">
          <div className="hs-usb-stick">
            <div className="hs-usb-plug" />
            <div className="hs-usb-body" />
            <div className="hs-usb-led" />
          </div>
        </div>
        <div className="hs-usb-tag font-heading">{t.tag}</div>
      </div>
      <div className="hs-pill hs-pop-early hs-usb-found">
        <Eye />
        {t.found}
      </div>
      <ShieldBadge />
      <FlagsLabel />
      <DoneToast>{t.done}</DoneToast>
    </SceneFigure>
  );
}
