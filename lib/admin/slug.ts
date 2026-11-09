// Oda adresi (slug) üretimi. Yeni oda açılırken addan bir kez üretilir ve sonra değişmez
// (öğrencinin adresi /oda/<slug> sabit kalsın). Türkçe harfler İngilizce karşılıklarına çevrilir:
// "Kodu soran \"arkadaş\"" -> "kodu-soran-arkadas".

const turkish: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
};

/** Slug en fazla bu kadar karakter olur (sonuna "-2" gibi ek gelebilir). */
export const slugMaxLength = 60;

export function slugify(name: string): string {
  const lower = name.toLocaleLowerCase("tr");
  const ascii = Array.from(lower, (ch) => turkish[ch] ?? ch)
    .join("")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const slug = ascii
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, slugMaxLength)
    .replace(/-+$/g, "");
  return slug || "oda";
}

/** Alınmış adreslerle çakışmayan ilk slug: ad, ad-2, ad-3... */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, slugMaxLength - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}
