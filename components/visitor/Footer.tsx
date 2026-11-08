import Link from "next/link";
import { brand } from "@/lib/brand";
import { format, getMessages } from "@/lib/i18n";
import { routes, visitorNav } from "@/lib/navigation";

export function Footer() {
  const t = getMessages();
  return (
    <footer className="relative border-t border-card print:hidden">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 pt-[22px] pb-32 text-sm text-fg-4 sm:flex-row sm:items-center sm:justify-between lg:px-6 lg:pb-[22px]">
        <span>{format(t.site.footer, { brand: brand.name })}</span>
        {/* Telefonda bağlantılar 40 px yüksek: parmakla dokunulabilsin (satır arası boşluk onun içinde). */}
        <nav aria-label={t.nav.legal} className="flex flex-wrap gap-x-5 lg:gap-y-2">
          {visitorNav.footer.map((key) => (
            <Link key={key} href={routes[key]} className="inline-flex items-center text-fg-3 no-underline hover:text-fg max-lg:min-h-10">
              {t.nav.links[key]}
            </Link>
          ))}
          {/* Kod AGPL-3.0 lisanslı: sitenin kaynak koduna giden bağlantı her sayfanın altında durur. */}
          <a href={brand.sourceUrl} className="inline-flex items-center text-fg-3 no-underline hover:text-fg max-lg:min-h-10">
            {t.site.sourceCode}
          </a>
        </nav>
      </div>
    </footer>
  );
}
