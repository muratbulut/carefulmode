import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { HeroMascot } from "@/components/mascot/HeroMascot";
import { getMessages, rich } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { PostamScene } from "./PostamScene";
import { GameChatScene } from "./scenes/GameChatScene";
import { HeroScenes } from "./scenes/HeroScenes";
import { LibraryScene } from "./scenes/LibraryScene";
import { ProfileMapScene } from "./scenes/ProfileMapScene";
import { QrPosterScene } from "./scenes/QrPosterScene";
import { UsbScene } from "./scenes/UsbScene";

/**
 * Tanıtım sayfasının üst kısmı (Tema H, H13A3 masaüstü ve 1.3D telefon). Sağdaki alanda altı oda
 * sahnesi her ziyarette karışık sırayla döner (HeroScenes); ilki Postam, sayfa canlanana kadar o görünür.
 * Başlığın üstündeki büyük maskot dokununca tepki verir, uzun süre hareket olmazsa uyur (HeroMascot).
 */
export function Hero() {
  const t = getMessages().landing.hero;
  return (
    <>
      <section className="relative mx-auto flex max-w-[1200px] flex-col gap-[18px] px-4 pt-7 pb-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-14 lg:px-6 lg:py-12">
        <div className="flex flex-col gap-[18px] lg:flex-[1_1_460px] lg:gap-6">
          {/* Büyük maskot başlığın üstünde; sağdaki dönen oda sahneleri yerinde kalır (maskot tuvali). */}
          <HeroMascot className="w-[112px] self-start lg:w-[168px]" />
          <div className="flex items-center gap-1.5 self-start rounded-full bg-accent/12 px-2.5 py-[5px] text-[11px] font-bold tracking-[0.8px] text-accent-light lg:gap-2 lg:px-3 lg:py-1.5 lg:text-sm lg:tracking-[1px]">
            <span className="size-[7px] rounded-full bg-success lg:size-2" aria-hidden="true" />
            {t.eyebrow}
            <span className="hidden lg:inline">&nbsp;{t.eyebrowMore}</span>
          </div>
          <h1 className="m-0 font-heading text-[38px] leading-[1.05] font-bold tracking-[-1px] sm:text-5xl lg:text-[62px] lg:leading-[1.03] lg:tracking-[-1.5px]">
            {rich(t.title, { accent: (chunk) => <span className="text-accent-fg">{chunk}</span> })}
          </h1>
          <p className="m-0 max-w-[520px] text-base leading-[1.55] text-fg-2 lg:text-xl">
            {rich(t.lead, { desktop: (chunk) => <span className="hidden lg:inline">{chunk}</span> })}
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap lg:gap-3">
            <Link
              href={routes.signUp}
              className="inline-flex h-[52px] items-center justify-center gap-2 rounded-xl bg-accent px-[26px] text-[17px] font-bold text-on-accent no-underline transition-[filter] hover:brightness-110"
            >
              {t.start}
              <ArrowRight className="hidden size-[18px] lg:block" strokeWidth={2.4} aria-hidden="true" />
            </Link>
            <Link
              href={routes.roadmap}
              className="inline-flex h-[52px] items-center justify-center rounded-xl border border-line bg-card px-[26px] text-[17px] font-bold text-fg no-underline transition-colors hover:border-accent"
            >
              {t.roadmap}
            </Link>
          </div>
          <ul className="m-0 flex list-none flex-wrap gap-x-3.5 gap-y-1.5 p-0 text-[13px] text-fg-3 lg:gap-5 lg:pt-1 lg:text-sm">
            {t.assurances.map((a) => (
              <li key={a.long} className="inline-flex items-center gap-[5px] lg:gap-1.5">
                <Check className="size-3.5 text-success-fg lg:size-4" strokeWidth={2.4} aria-hidden="true" />
                <span className="lg:hidden">{a.short}</span>
                <span className="hidden lg:inline">{a.long}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-center py-6 lg:flex-[1_1_460px] lg:py-0">
          <HeroScenes
            scenes={[
              <PostamScene key="postam" />,
              <UsbScene key="usb" />,
              <QrPosterScene key="qr" />,
              <GameChatScene key="chat" />,
              <LibraryScene key="library" />,
              <ProfileMapScene key="profile" />,
            ]}
          />
        </div>
      </section>
    </>
  );
}
