"use client";

// Kök yerleşim bile çizilemezse bu sayfa gelir. Tema ve stiller yüklenmemiş olabilir,
// bu yüzden renkler burada satır içinde (koyu temanın değerleri) duruyor.
import { defaultLocale, getMessages } from "@/lib/i18n";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = getMessages();
  return (
    <html lang={defaultLocale}>
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0B1020", color: "#E8ECF8", fontFamily: "system-ui, sans-serif" }}>
        <title>{t.errors.pageTitle}</title>
        <main style={{ maxWidth: 480, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24 }}>{t.errors.title}</h1>
          <p style={{ color: "#C9D0E4", lineHeight: 1.55 }}>{t.errors.textWithoutCode}</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ height: 44, padding: "0 18px", border: 0, borderRadius: 12, background: "#22D3EE", color: "#0B1020", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
          >
            {t.status.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
