// Haberin kapak görseli (4 Kasım, Murat: 15). Yönetimdeki haber formunda her boyutta görsel
// seçilir; tarayıcı onu yeniden çizer (en çok 1600 px genişlik, WebP; tarayıcı WebP
// yazamıyorsa JPEG), böylece konum ve cihaz bilgisi (EXIF) gitmez. Sunucu dosyanın türünü adına
// değil ilk baytlarına bakarak bulur, boyutunu başlığından okur ve sınırları yeniden denetler.
// Tarayıcı (components/admin/news/CoverField.tsx) ve sunucu (lib/news/cover-actions.ts) aynı
// kuralları kullanır; asıl denetim sunucudadır.

export const coverRules = {
  /** Önerilen boyut (formda yazar): 16:9. */
  recommended: { width: 1600, height: 900 },
  /** Tarayıcı görseli bu genişliğe kadar küçültür. */
  maxWidth: 1600,
  /** Uzun kenar sınırı (çok uzun dar görseller için). */
  maxEdge: 2400,
  /** Bundan dar görselde "kapakta bulanık görünebilir" uyarısı çıkar. */
  minSharpWidth: 1200,
  /** Seçilen ham dosya (yeniden çizilmeden önce). */
  maxInputBytes: 25 * 1024 * 1024,
  /** Sunucuya giden yeniden çizilmiş dosya. */
  maxBytes: 2 * 1024 * 1024,
  quality: 0.85,
  alt: 160,
  credit: 80,
} as const;

export type CoverMime = "image/webp" | "image/jpeg";

/** Dosyanın ilk baytlarından türü: WebP ("RIFF....WEBP") ya da JPEG; başka her şeyde null. */
export function detectCoverType(head: Uint8Array): CoverMime | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
  if (head.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  return null;
}

const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);

/** WebP başlığından genişlik ve yükseklik (VP8, VP8L, VP8X); okunamazsa null. */
function webpSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 30) return null;
  const chunk = String.fromCharCode(...b.subarray(12, 16));
  if (chunk === "VP8 " && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (chunk === "VP8L" && b[20] === 0x2f) {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  return null;
}

/** JPEG'in SOF bölümünden genişlik ve yükseklik; okunamazsa null. */
function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    const length = (b[i + 2] << 8) | b[i + 3];
    // SOF0-SOF15 (DHT, JPG ve DAC hariç).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    }
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

export type CoverProblem = "type" | "size" | "dimensions";

export type CheckedCover = { ok: true; mimeType: CoverMime; width: number; height: number } | { ok: false; problem: CoverProblem };

/** Sunucuya gelen (yeniden çizilmiş) görseli denetler: tür baytlardan, boyut başlıktan. */
export function checkCover(bytes: Uint8Array): CheckedCover {
  if (bytes.byteLength === 0 || bytes.byteLength > coverRules.maxBytes) return { ok: false, problem: "size" };
  const mimeType = detectCoverType(bytes);
  if (!mimeType) return { ok: false, problem: "type" };
  const size = mimeType === "image/webp" ? webpSize(bytes) : jpegSize(bytes);
  if (!size || size.width < 1 || size.height < 1 || size.width > coverRules.maxWidth || Math.max(size.width, size.height) > coverRules.maxEdge) {
    return { ok: false, problem: "dimensions" };
  }
  return { ok: true, mimeType, ...size };
}

/** Yeniden çizilecek boyut: genişlik en çok 1600, uzun kenar en çok 2400; oran korunur, büyütülmez. */
export function scaledSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, coverRules.maxWidth / width, coverRules.maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Odak noktası yüzde, 0-100 arası tam sayı. */
export const clampFocus = (value: number) => (Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 50);

/** Kapağın adresi; sürüm (güncellenme anı) değişince tarayıcı yenisini ister. */
export const coverUrl = (articleId: string, version: number) => `/api/kapak/${encodeURIComponent(articleId)}?v=${version.toString(36)}`;

/** Kapak bilgisi: görsel varsa adresi, boyutu ve odak noktası; alt metin ve kaynak. */
export type CoverView = { src: string; width: number; height: number; focusX: number; focusY: number; alt: string; credit: string };
