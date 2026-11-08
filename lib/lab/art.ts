/**
 * Odaların çizimleri (3 Kasım, 7.1. revize): her odanın kendi görseli `public/odalar/<oda>.svg`
 * dosyasındadır (rozetlerdeki gibi). Çizimi olan odalar bu listededir; olmayan odada kartta
 * mahallenin ikonu görünür. Yeni odanın çizimi eklenince adresi buraya da yazılır;
 * tests/unit/room-art.test.ts listeyle klasörü karşılaştırır.
 */
export const roomArt = [
  "oltalama-egitimi",
  "sahte-kargo-maili",
  "kodu-soran-arkadas",
  "kisisel-veri-ve-para-guvenligi",
  "kulaklik-icin-veli-karti",
  "eski-telefonunu-sat",
] as const;

const known = new Set<string>(roomArt);

/** Odanın çiziminin adresi; çizimi yoksa null. */
export function roomArtOf(slug: string): string | null {
  return known.has(slug) ? `/odalar/${slug}.svg` : null;
}
