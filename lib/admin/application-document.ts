// Öğretmenlik belgesinin yönetimdeki görünümü (app/yonetim/talepler/[talep]/belge/route.ts):
// hangi türler gösterilir ve yanıtın güvenlik başlıkları. Saf; birim testli.
//
// Belge yalnızca talepleri inceleyen kişiye, sayfanın içinde (görsel <img>, PDF çerçevede)
// gösterilir. Yanıt önbelleğe alınmaz, türü tahmin edilmez (nosniff) ve kendi başına açılsa da
// betik çalıştıramaz (CSP sandbox). Yalnızca bu sitenin sayfaları çerçeveye alabilir.

export const servableDocumentTypes = ["application/pdf", "image/jpeg", "image/png"] as const;
export type ServableDocumentType = (typeof servableDocumentTypes)[number];

export const isServableDocumentType = (value: string): value is ServableDocumentType => (servableDocumentTypes as readonly string[]).includes(value);

/**
 * Aynı kişinin aynı belgeye bu süre içindeki ikinci isteği kayıt defterine yeniden yazılmaz
 * (tarayıcının PDF gösterici aynı açılışta birkaç istek yapabilir).
 */
export const documentViewAuditWindowMs = 60_000;

export const documentContentSecurityPolicy = "sandbox; default-src 'none'; img-src 'self' data:; object-src 'self'; frame-ancestors 'self'";

export function documentHeaders(mimeType: ServableDocumentType, size: number): Record<string, string> {
  return {
    "Content-Type": mimeType,
    "Content-Length": String(size),
    "Content-Disposition": "inline",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    // Genel başlıklar (next.config.ts) bu yanıta da eklenir ve aynı adlı başlığın yerine geçer:
    // "X-Frame-Options: DENY" burada da durur. Sayfaların genel CSP'si (frame-ancestors 'none')
    // de yerine geçeceği için next.config.ts bu adrese aynı belge CSP'sini ayrıca verir; buradaki
    // değer ters vekilsiz ya da başlık kuralı değişirse de geçerli kalsın diye durur. Belgenin
    // önizleme penceresinde açılabilmesini CSP'deki frame-ancestors 'self' sağlar; tarayıcılar
    // ikisi birlikteyken frame-ancestors'a uyar.
    "Content-Security-Policy": documentContentSecurityPolicy,
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}

/** Bulunamadı (yetkisiz istek de aynı cevabı alır: belgenin varlığı belli olmaz). */
export const documentNotFoundHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } as const;
