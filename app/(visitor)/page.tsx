import { BandReveal } from "@/components/landing/BandReveal";
import { Hero } from "@/components/landing/Hero";
import { LandingBackground } from "@/components/landing/LandingBackground";
import { RoadmapSection } from "@/components/landing/RoadmapSection";
import { Steps } from "@/components/landing/Steps";

/**
 * Ana sayfa: ziyaretçiye tanıtım sayfası (kahraman, üç adım, yol haritası). Masaüstünde sayfa
 * bant bant ilerler: kahraman ilk ekranı tam doldurur, kaydırınca sıradaki bant aşağıdan belirir
 * (globals.css, landing-band).
 */
export default function HomePage() {
  return (
    <>
      <LandingBackground />
      <BandReveal />
      <div data-landing-band="hero" className="landing-band">
        <Hero />
      </div>
      <div data-landing-band="steps" className="landing-band">
        <Steps />
      </div>
      <div data-landing-band="roadmap" className="landing-band">
        <RoadmapSection />
      </div>
    </>
  );
}
