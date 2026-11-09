import { Suspense, type ReactNode } from "react";
import { UnverifiedStrip } from "@/components/auth/UnverifiedStrip";
import { BottomNav } from "./BottomNav";
import { BottomNavSlot } from "./BottomNavSlot";
import { Footer } from "./Footer";
import { TopNav } from "./TopNav";

/** Ziyaretçi sayfalarının çerçevesi: üst menü, içerik, alt bilgi ve telefonda alt menü. */
export function VisitorShell({ children, background }: { children: ReactNode; background?: ReactNode }) {
  return (
    <div data-visitor-shell="" className="relative flex min-h-dvh flex-col overflow-x-clip">
      {background}
      <TopNav />
      <Suspense fallback={null}>
        <UnverifiedStrip />
      </Suspense>
      <main id="content" className="flex-1">
        {children}
      </main>
      <Footer />
      {/* Ziyaretçi menüsü statik kabukta; oturum istek anında okunur, giriş yapmışsa onun menüsü gelir. */}
      <BottomNav />
      <Suspense fallback={null}>
        <BottomNavSlot />
      </Suspense>
    </div>
  );
}
