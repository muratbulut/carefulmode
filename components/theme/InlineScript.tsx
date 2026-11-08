"use client";

/**
 * İlk boyamadan önce çalışan satır içi betik. Tarayıcıda çizilirken türü "text/plain"
 * olur; böylece React geliştirmede <script> uyarısı vermez ve betik iki kez çalışmaz
 * (Next.js "Preventing flash before hydration" rehberindeki kalıp).
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
