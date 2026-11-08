import { Suspense } from "react";
import { PageBackground } from "@/components/background/PageBackground";
import { StudentHome } from "@/components/home/StudentHome";
import { BandReveal } from "@/components/landing/BandReveal";
import { Hero } from "@/components/landing/Hero";
import { LandingBackground } from "@/components/landing/LandingBackground";
import { NewsSection } from "@/components/landing/NewsSection";
import { RoadmapSection } from "@/components/landing/RoadmapSection";
import { Steps } from "@/components/landing/Steps";
import { TipBannerSkeleton } from "@/components/landing/TipBanner";
import { TodayTipBanner } from "@/components/landing/TodayTipBanner";
import { Loading } from "@/components/status/Loading";
import { getUser } from "@/lib/session";

/**
 * Ana sayfa: ziyaretçiye tanıtım sayfası (kahraman, günün ipucu, üç adım, gündem, yol haritası),
 * giriş yapmış öğrenciye kendi ana sayfası. Oturum istek anında okunur.
 */
export default function HomePage() {
  return (
    <Suspense fallback={<Loading className="relative mx-4 my-8 lg:mx-auto lg:max-w-[1152px]" cardCount={3} />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const user = await getUser();
  if (user) {
    return (
      <>
        <PageBackground />
        <StudentHome userId={user.id} />
      </>
    );
  }
  return (
    <>
      <LandingBackground />
      <BandReveal />
      {/* Masaüstünde sayfa bant bant ilerler: kahraman ilk ekranı tam doldurur; ipucu ve üç adım,
          gündem ve yol haritası içerikleri kadar yer tutar, aralarında dengeli bir boşluk kalır;
          kaydırınca sıradaki bant aşağıdan belirir (globals.css, landing-band). */}
      <div data-landing-band="hero" className="landing-band">
        <Hero />
      </div>
      <div data-landing-band="steps" className="landing-band">
        <Suspense fallback={<TipBannerSkeleton />}>
          <TodayTipBanner />
        </Suspense>
        <Steps />
      </div>
      <div data-landing-band="news" className="landing-band">
        <NewsSection />
      </div>
      <div data-landing-band="roadmap" className="landing-band">
        <RoadmapSection />
      </div>
    </>
  );
}
