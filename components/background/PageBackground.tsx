import { FlowingThreads } from "./FlowingThreads";

/** 404 ve durum sayfalarının üstündeki sakin iplikler (sayfanın üst 520 px'i). */
export function PageBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-70 [mask-image:linear-gradient(#000_40%,transparent)]"
    >
      <FlowingThreads pattern="page" className="hidden md:block" />
      <FlowingThreads pattern="mobile" className="md:hidden" />
    </div>
  );
}
