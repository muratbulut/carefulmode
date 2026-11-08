import { describe, expect, it } from "vitest";
import { checkCover, clampFocus, coverRules, coverUrl, detectCoverType, scaledSize } from "@/lib/news/cover";
import { mostReadMonth, mostReadOf } from "@/lib/news/dates";

// Haberin kapak görseli (4 Kasım, 15): sunucu dosyanın türünü baytlarından, boyutunu
// başlığından okur; tarayıcının söylediği tür ve ad kullanılmaz.

const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));
const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];

function webpX(width: number, height: number) {
  return new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), ...ascii("VP8X"), 10, 0, 0, 0, 0, 0, 0, 0, ...le24(width - 1), ...le24(height - 1), 0, 0]);
}

function webpLossy(width: number, height: number) {
  return new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), ...ascii("VP8 "), 0, 0, 0, 0, 0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(width), ...le16(height), 0, 0]);
}

function webpLossless(width: number, height: number) {
  const bits = (width - 1) | ((height - 1) << 14);
  return new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), ...ascii("VP8L"), 0, 0, 0, 0, 0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >>> 24) & 0xff, 0, 0, 0, 0, 0]);
}

/** SOI, 16 baytlık APP0 (EXIF yerine), SOF0. */
function jpeg(width: number, height: number) {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, ...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1,
    0xff, 0xd9,
  ]);
}

describe("kapak görselinin türü", () => {
  it("WebP ve JPEG ilk baytlarından tanınır", () => {
    expect(detectCoverType(webpX(1600, 900))).toBe("image/webp");
    expect(detectCoverType(jpeg(1600, 900))).toBe("image/jpeg");
  });

  it("PNG, GIF, SVG ve uzantısı değiştirilmiş dosya reddedilir", () => {
    expect(detectCoverType(new Uint8Array([0x89, ...ascii("PNG\r\n\x1a\n"), 0, 0, 0, 0]))).toBeNull();
    expect(detectCoverType(new Uint8Array(ascii("GIF89a......")))).toBeNull();
    expect(detectCoverType(new Uint8Array(ascii("<svg xmlns='http://www.w3.org/2000/svg'>")))).toBeNull();
    expect(detectCoverType(new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")]))).toBeNull();
    expect(detectCoverType(new Uint8Array([]))).toBeNull();
  });
});

describe("kapak görselinin denetimi", () => {
  it("boyut başlıktan okunur (VP8X, VP8, VP8L, JPEG)", () => {
    expect(checkCover(webpX(1600, 900))).toEqual({ ok: true, mimeType: "image/webp", width: 1600, height: 900 });
    expect(checkCover(webpLossy(1200, 675))).toEqual({ ok: true, mimeType: "image/webp", width: 1200, height: 675 });
    expect(checkCover(webpLossless(640, 480))).toEqual({ ok: true, mimeType: "image/webp", width: 640, height: 480 });
    expect(checkCover(jpeg(1600, 2400))).toEqual({ ok: true, mimeType: "image/jpeg", width: 1600, height: 2400 });
  });

  it("1600 px'ten geniş ya da uzun kenarı 2400 px'i geçen görsel reddedilir (tarayıcı küçültmüş olmalı)", () => {
    expect(checkCover(webpX(1601, 900))).toEqual({ ok: false, problem: "dimensions" });
    expect(checkCover(jpeg(1000, 2401))).toEqual({ ok: false, problem: "dimensions" });
  });

  it("boş, 2 MB'ı geçen ya da başlığı okunamayan dosya reddedilir", () => {
    expect(checkCover(new Uint8Array([]))).toEqual({ ok: false, problem: "size" });
    const big = new Uint8Array(coverRules.maxBytes + 1);
    big.set(jpeg(100, 100));
    expect(checkCover(big)).toEqual({ ok: false, problem: "size" });
    expect(checkCover(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toEqual({ ok: false, problem: "dimensions" });
    expect(checkCover(new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), ...ascii("VP8 ")]))).toEqual({ ok: false, problem: "dimensions" });
  });
});

describe("yeniden çizim boyutu", () => {
  it("genişlik en çok 1600, uzun kenar en çok 2400; oran korunur", () => {
    expect(scaledSize(4000, 2250)).toEqual({ width: 1600, height: 900 });
    expect(scaledSize(1000, 4000)).toEqual({ width: 600, height: 2400 });
    expect(scaledSize(3200, 3200)).toEqual({ width: 1600, height: 1600 });
  });

  it("küçük görsel büyütülmez", () => {
    expect(scaledSize(800, 450)).toEqual({ width: 800, height: 450 });
    expect(scaledSize(1, 10000)).toEqual({ width: 1, height: 2400 });
  });
});

describe("odak noktası ve adres", () => {
  it("odak 0-100 arası tam sayı; geçersizde orta", () => {
    expect(clampFocus(-5)).toBe(0);
    expect(clampFocus(104)).toBe(100);
    expect(clampFocus(33.6)).toBe(34);
    expect(clampFocus(Number.NaN)).toBe(50);
  });

  it("kapak adresi sürümle değişir", () => {
    expect(coverUrl("abc", 1730000000000)).toBe(`/api/kapak/abc?v=${(1730000000000).toString(36)}`);
    expect(coverUrl("abc", 1)).not.toBe(coverUrl("abc", 2));
  });
});

describe("bu ayın en çok okunanı", () => {
  // Türkiye saatiyle (UTC+3).
  const at = (iso: string) => new Date(`${iso}T12:00:00+03:00`);
  const article = (slug: string, day: string, readCount: number) => ({ slug, publishedAt: at(day), readCount });

  it("ayın ilk 7 gününde geçen ay, sonra bu ay", () => {
    expect(mostReadMonth(at("2026-11-07"))).toEqual({ year: 2026, month: 9, current: false });
    expect(mostReadMonth(at("2026-11-08"))).toEqual({ year: 2026, month: 10, current: true });
    expect(mostReadMonth(at("2027-01-03"))).toEqual({ year: 2026, month: 11, current: false });
  });

  it("o ayda yayınlanan en çok okunan; eşitlikte en yenisi, okunmamış haber sayılmaz", () => {
    const list = [article("d", "2026-11-20", 0), article("c", "2026-11-13", 40), article("b", "2026-11-09", 40), article("a", "2026-10-30", 900)];
    expect(mostReadOf(list, at("2026-11-25"))).toEqual({ article: list[1], current: true });
    expect(mostReadOf(list, at("2026-11-04"))).toEqual({ article: list[3], current: false });
    expect(mostReadOf([article("d", "2026-11-20", 0)], at("2026-11-25"))).toBeNull();
    expect(mostReadOf([], at("2026-11-25"))).toBeNull();
  });
});
