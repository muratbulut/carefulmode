import type { Metadata, Viewport } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { ConnectionBanner } from "@/components/status/ConnectionBanner";
import { InlineScript } from "@/components/theme/InlineScript";
import { brand } from "@/lib/brand";
import { defaultLocale, format, getMessages } from "@/lib/i18n";
import { DEFAULT_THEME, THEME_COLOR, THEME_SCRIPT } from "@/lib/theme";

const t = getMessages();

export const metadata: Metadata = {
  title: {
    default: format(t.site.title, { brand: brand.name }),
    template: format(t.site.titleTemplate, { brand: brand.name }),
  },
  description: t.site.description,
  applicationName: brand.name,
  metadataBase: new URL(brand.siteUrl),
  openGraph: { siteName: brand.name, type: "website", locale: "tr_TR" },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR[DEFAULT_THEME],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Tema betiği data-theme'i ilk boyamadan önce değiştirebilir; bu fark beklenen bir fark.
    <html lang={defaultLocale} data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <InlineScript html={THEME_SCRIPT} />
      </head>
      <body className="min-h-dvh">
        {children}
        <ConnectionBanner />
      </body>
    </html>
  );
}
