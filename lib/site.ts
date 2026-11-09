// Sitenin kök adresi (maildeki bağlantılar, Better Auth). Sunucuda yayın betiği
// BETTER_AUTH_URL'yi alan adından yazar; yerelde varsayılan geliştirme adresidir.
export function siteUrl() {
  return (process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, "");
}

/** Tarihler kullanıcıya Türkiye saatiyle gösterilir (sunucu UTC'de çalışsa da). */
export const siteTimeZone = "Europe/Istanbul";
