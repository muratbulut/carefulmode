import { TopNav } from "@/components/visitor/TopNav";

/** Sonuç raporu: masaüstünde üst menü kalır; telefonda ekranın tamamı rapora kalır. */
export default function ReportLayout({ children }: LayoutProps<"/oda/[oda]/sonuc">) {
  return (
    <>
      <div className="max-lg:hidden">
        <TopNav />
      </div>
      <main id="content" className="flex flex-1 flex-col">
        {children}
      </main>
    </>
  );
}
