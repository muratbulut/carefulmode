// Canlı şifre gücü göstergesi (Tur 1, ekran 5; tahta: Kayit-Masaustu). Kayıt, şifre sıfırlama ve
// profildeki şifre değiştirme aynı kuralı kullanır; sunucu eylemi de şifreyi bununla tekrar denetler.
//
// Kırılma süresi öğretici bir tahmindir: karakter havuzu ve uzunluktan çevrimdışı kaba kuvvet
// süresi (saniyede 2·10^10 deneme). Yaygın ya da tahmin edilebilir şifrede süre "anında"dır.

export type PasswordTone = "info" | "bad" | "warn" | "good";
export type CrackUnit = "century" | "year" | "day" | "hour" | "minute" | "second";

export type PasswordCheck = "length" | "mix" | "symbol" | "safe";

export type PasswordEvaluation = {
  checks: Record<PasswordCheck, boolean>;
  /** En çok kullanılan şifrelerden biri, tek karakter tekrarı ya da kısa bir sayı. */
  common: boolean;
  /** Yıl ya da kişinin adı/e-postası gibi tahmin edilebilir bir parça içeriyor. */
  guessable: boolean;
  /** 0-4: sağlanan madde sayısı. */
  score: number;
  crackSeconds: number;
  tone: PasswordTone;
  /** Sarı uyarıda önerilecek ilk eksik. */
  missing: "length" | "symbol" | "digit" | null;
  /** Kayıt düğmesi bu durumda açılır; sunucu da aynı kuralı uygular. */
  accepted: boolean;
};

export const MIN_PASSWORD_LENGTH = 8;
export const STRONG_PASSWORD_LENGTH = 12;

const COMMON = new Set([
  "123456", "1234567", "12345678", "123456789", "1234567890", "111111", "000000", "123123", "654321",
  "password", "password1", "password123", "12345", "1q2w3e4r", "qwertyuiop", "sifre", "şifre", "sifre123", "şifre123", "qwerty", "qwerty123", "asdfgh",
  "abc123", "iloveyou", "galatasaray", "fenerbahce", "fenerbahçe", "besiktas", "beşiktaş", "trabzonspor",
  "türkiye", "turkiye",
]);

const LETTER = /[a-zA-ZçğıöşüÇĞİÖŞÜ]/;
const SYMBOL = /[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/;

/** Ad ve e-postadan tahmin edilebilir parçalar (en az 3 harf). */
export function personalTokens(...values: (string | null | undefined)[]) {
  const tokens = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const local = value.split("@")[0];
    for (const part of local.toLocaleLowerCase("tr").split(/[^a-zçğıöşü0-9]+/)) {
      if (part.length >= 3) tokens.add(part);
    }
  }
  return [...tokens];
}

export function evaluatePassword(password: string, personal: string[] = []): PasswordEvaluation {
  const lower = password.toLocaleLowerCase("tr");
  const filled = password.length > 0;
  const common =
    filled && (COMMON.has(lower) || /^(.)\1+$/.test(password) || (/^\d+$/.test(password) && password.length < 10));
  const guessable =
    !common && filled && (/(19|20)\d\d/.test(password) || personal.some((token) => lower.includes(token)));

  const checks = {
    length: password.length >= STRONG_PASSWORD_LENGTH,
    mix: LETTER.test(password) && /\d/.test(password),
    symbol: SYMBOL.test(password),
    safe: filled && !common && !guessable,
  };

  let pool = 0;
  if (/[a-zçğıöşü]/.test(password)) pool += 29;
  if (/[A-ZÇĞİÖŞÜ]/.test(password)) pool += 29;
  if (/\d/.test(password)) pool += 10;
  if (checks.symbol) pool += 33;
  const crackSeconds = common || guessable ? 0 : 2 ** (password.length * Math.log2(Math.max(pool, 1))) / 2e10;

  const score = filled ? Object.values(checks).filter(Boolean).length : 0;
  const tone: PasswordTone = !filled ? "info" : common ? "bad" : guessable || score < 4 ? "warn" : "good";
  const missing = !checks.length ? "length" : !checks.symbol ? "symbol" : !checks.mix ? "digit" : null;
  const accepted = score >= 3 && !common && password.length >= MIN_PASSWORD_LENGTH;

  return { checks, common, guessable, score, crackSeconds, tone, missing, accepted };
}

/** Kırılma süresini okunur birime çevirir: { unit, amount } ya da "anında"/"yüzyıldan uzun". */
export function crackTime(seconds: number): { unit: CrackUnit | "instant" | "moments"; amount: number } {
  const units: [number, CrackUnit][] = [
    [31_536_000, "year"],
    [86_400, "day"],
    [3_600, "hour"],
    [60, "minute"],
    [1, "second"],
  ];
  if (seconds < 1) return { unit: "instant", amount: 0 };
  if (seconds >= 31_536_000 * 100) return { unit: "century", amount: 0 };
  for (const [size, unit] of units) {
    if (seconds >= size) return { unit, amount: Math.round(seconds / size) };
  }
  return { unit: "moments", amount: 0 };
}
