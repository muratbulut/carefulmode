// Okul adı kuralları. Ad tabeladaki resmî addır; karşılaştırma için küçük harfe çevrilmiş ve
// boşlukları sadeleştirilmiş hali (nameKey) kullanılır, böylece "Atatürk Ortaokulu" ile
// "atatürk  ortaokulu" aynı okul sayılır. Migration'daki SQL de aynı kuralı uygular.

export const schoolNameLimits = { min: 5, max: 90 } as const;

/** Baştaki ve sondaki boşluklar atılır, aradaki boşluklar teke iner. */
export function cleanSchoolName(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ");
}

export function schoolNameKey(value: string): string {
  return cleanSchoolName(value).toLocaleLowerCase("tr");
}

export function schoolNameOk(value: string): boolean {
  const name = cleanSchoolName(value);
  return name.length >= schoolNameLimits.min && name.length <= schoolNameLimits.max && /\p{L}/u.test(name);
}

/** Benzer ad (okul ekleme ve "Bu okul mu?" eşlemesi): biri ötekini içeriyorsa ya da ilk iki kelime aynıysa. */
export function similarSchoolNames(a: string, b: string): boolean {
  const x = schoolNameKey(a);
  const y = schoolNameKey(b);
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const head = (s: string) => s.split(" ").slice(0, 2).join(" ");
  return x.split(" ").length >= 2 && head(x) === head(y);
}
