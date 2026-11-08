import { FlowingThreads } from "@/components/background/FlowingThreads";

/**
 * Tanıtım sayfasının arka planı: sağ tarafta akan iplikler ve camgöbeği bir hale.
 * Kabuğun en üstünden başlar (header'ın arkasına da uzanır).
 */
export function LandingBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0">
      {/* Masaüstü */}
      <div className="absolute inset-x-0 top-0 hidden h-[920px] [mask-image:linear-gradient(#000_50%,transparent)] lg:block">
        <div className="absolute inset-0 [mask-image:linear-gradient(90deg,transparent_0%,transparent_34%,#000_60%)]">
          <FlowingThreads pattern="hero" />
        </div>
      </div>
      <div className="absolute top-10 right-[6%] hidden size-[520px] rounded-full bg-[radial-gradient(circle,rgb(34_211_238/0.14),transparent_65%)] lg:block" />
      {/* Telefon */}
      <div className="absolute inset-x-0 top-[60px] h-[620px] [mask-image:linear-gradient(#000_60%,transparent)] lg:hidden">
        <FlowingThreads pattern="mobile" />
      </div>
    </div>
  );
}
