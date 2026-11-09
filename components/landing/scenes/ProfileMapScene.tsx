import { Eye, Gift, Globe, GraduationCap, Lock, MapPin } from "lucide-react";
import { getMessages, rich } from "@/lib/i18n";
import { DoneToast, FlagsLabel, Scan, SceneFigure } from "./parts";
import "./ProfileMapScene.css";

const learnedTiming = ["hs-profile-learned1", "hs-profile-learned2", "hs-profile-learned3"];

/** Yabancının haritası: dere, park, bloklar, sokaklar ve okuldan eve giden yol. */
function CityMap({ street }: { street: string }) {
  return (
    <svg className="hs-profile-city" viewBox="0 0 174 160">
      <path d="M-10 128c40-10 70 8 104-6s56-18 90-10" className="hs-profile-water" strokeWidth="12" />
      <rect x="104" y="10" width="62" height="38" rx="8" className="hs-profile-park" />
      <circle cx="122" cy="26" r="6" className="hs-profile-tree" />
      <circle cx="142" cy="32" r="7" className="hs-profile-tree" />
      <g className="hs-profile-block">
        <rect x="10" y="56" width="40" height="30" rx="5" />
        <rect x="62" y="10" width="30" height="36" rx="5" />
        <rect x="62" y="56" width="30" height="30" rx="5" />
        <rect x="104" y="58" width="24" height="28" rx="5" />
        <rect x="140" y="58" width="28" height="28" rx="5" />
        <rect x="10" y="96" width="40" height="18" rx="5" />
      </g>
      <path d="M0 51h174M0 91h174M56 0v160M98 0v120M134 51v40" className="hs-profile-road" strokeWidth="6" strokeLinecap="round" />
      <text x="62" y="103" className="hs-profile-street">
        {street}
      </text>
      <path d="M32 40V51h24v40h78" className="hs-profile-route" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Profil haritası: herkese açık profildeki okul, doğum tarihi ve sokak bir yabancının haritasına
 * düşer; okuldan eve giden yol ve evin yeri belirir. Profil gizlenince harita kapanır.
 */
export function ProfileMapScene() {
  const t = getMessages().landing.scenes.profile;
  const bold = { b: (chunk: string) => <b>{chunk}</b> };
  return (
    <SceneFigure caption={t.caption} className="hs-profile">
      <div className="hs-window hs-profile-card anim-float-1">
        <div className="hs-profile-cover" />
        <div className="hs-profile-me">
          <div className="hs-avatar hs-profile-avatar">{t.name.charAt(0)}</div>
          <span className="hs-profile-visibility">
            <span className="hs-profile-public">
              <Globe />
              {t.public}
            </span>
            <span className="hs-profile-friends">
              <Lock />
              {t.friends}
            </span>
          </span>
        </div>
        <div className="hs-profile-name">
          <b className="font-heading">{t.name}</b>
          <small>{t.handle}</small>
        </div>
        <div className="hs-profile-stats">
          <span>{rich(t.posts, bold)}</span>
          <span>{rich(t.followers, bold)}</span>
        </div>
        <div className="hs-window-body hs-profile-body">
          <Scan />
          <div className="hs-row hs-profile-row">
            <GraduationCap />
            <span className="hs-f1">{t.school}</span>
          </div>
          <div className="hs-row hs-profile-row">
            <Gift />
            <span className="hs-f2">{t.birthday}</span>
          </div>
          <div className="hs-row hs-profile-row">
            <MapPin />
            <span className="hs-f3">{t.home}</span>
          </div>
          <div className="hs-profile-tiles">
            <i />
            <i />
            <i />
          </div>
          <span className="hs-btn hs-red hs-profile-hide anim-press">
            <Lock />
            {t.hide}
          </span>
        </div>
      </div>
      <div className="hs-side hs-profile-map anim-float-2">
        <div className="hs-cap">{t.mapTitle}</div>
        <div className="hs-profile-map-box">
          <CityMap street={t.street} />
          <span className="hs-profile-marker hs-profile-school">
            <GraduationCap />
          </span>
          <span className="hs-profile-ring" />
          <span className="hs-profile-pin">
            <MapPin />
          </span>
          <div className="hs-profile-lock">
            <Lock />
            {t.locked}
          </div>
        </div>
        <div className="hs-profile-learned">
          {t.learned.map((item, i) => (
            <span key={item} className={learnedTiming[i]}>
              <Eye />
              {item}
            </span>
          ))}
        </div>
      </div>
      <FlagsLabel />
      <DoneToast>{t.done}</DoneToast>
    </SceneFigure>
  );
}
