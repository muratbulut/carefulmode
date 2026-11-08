// Hesap formlarının sunucu ve tarayıcı tarafında ortak kullandığı tipler ve kurallar.

import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/navigation";

/** Sunucu eyleminin forma dönüşü. Mesajlar sözlükten, kullanıcıya gösterilecek haliyle gelir. */
export type FormState = {
  status: "idle" | "ok" | "error";
  /** Ekranın davranışını seçer: wrong (hatalı), locked (bekleme), expired, sent, rate_limited. */
  code?: "wrong" | "locked" | "expired" | "sent" | "rate_limited";
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  /** Geri sayım (saniye): kilit, kod tekrar gönderme arası. */
  retryAfterSec?: number;
  attemptsLeft?: number;
  email?: string;
  redirectTo?: string;
};

export const idleState: FormState = { status: "idle" };

/** "?sonra=" ile verilen dönüş adresi yalnızca sitenin kendi sayfası olabilir (açık yönlendirme yok). */
export function safeNext(value: unknown, fallback: string = routes.home): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  // Tarayıcı adresteki sekme ve satır sonlarını siler: "/\t/site.com" "//site.com" olurdu.
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return fallback;
  }
  return value;
}

export function withNext(path: string, next?: string) {
  return next ? `${path}?sonra=${encodeURIComponent(safeNext(next))}` : path;
}

/** E-posta kodunun hane sayısı (lib/auth.ts codeRules ile aynı). */
export const codeLength = 6;

/** Sunucunun verdiği bekleme süresini tarayıcıda geri sayıma çevirir (bkz. useSecondsLeft). */
export type Deadline = { from: number; until: number };

export function deadlineFrom(seconds: number | undefined, now: number): Deadline | undefined {
  return seconds ? { from: now, until: now + seconds * 1000 } : undefined;
}

/** 125 -> "2:05" */
export function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export type EducationStatus = "STUDYING" | "GRADUATED";

export function educationLevels(status: EducationStatus): string[] {
  return getMessages().auth.signUp.levels[status];
}

/** Kademe listesinde 3. sıradan (ön lisans) itibaren bölüm sorulur. */
export function asksDepartment(status: EducationStatus | "", level: string) {
  return status !== "" && educationLevels(status).indexOf(level) >= 2;
}

// Doğum yılı listesi: bu yıldan 6 önce ile 1950 arası (tahta: Kayit-Masaustu).
export const minBirthYear = () => 1950;
export const maxBirthYear = () => new Date().getFullYear() - 6;

/** 18 yaşından küçük olabilir mi? Yalnızca yıl alındığı için yıl farkıyla bakılır. */
export function isMinor(birthYear: number) {
  return new Date().getFullYear() - birthYear < 18;
}

/**
 * Öğretmenlik talebindeki uyarı için (sabah soruları 9): bu yıl 18'ini dolduruyorsa da doğum günü
 * henüz gelmemiş olabilir, bu yüzden isMinor'dan bir yıl geniştir. Talep engellenmez; onaylayan
 * kişi uyarıyı görür (doğum yılı sonradan değiştirilemediği için engel gerçek öğretmeni kilitlerdi).
 */
export function mayBeMinor(birthYear: number | null, now: Date) {
  return birthYear !== null && now.getFullYear() - birthYear <= 18;
}

/** Better Auth hatasının kodu (ör. INVALID_EMAIL_OR_PASSWORD); başka hata ise undefined. */
export function apiErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const body = (error as { body?: { code?: unknown } }).body;
  return typeof body?.code === "string" ? body.code : undefined;
}

/** "Hesabı sil" ile silme arasındaki süre (gün). Bu sürede giriş yapılırsa silme iptal olur. */
export const deletionGraceDays = 7;

/** Profilde ve silme onayında yazılması istenen kelime ("sil" de kabul edilir). */
export function isDeleteWord(value: string, word: string) {
  return value.trim().toLocaleUpperCase("tr") === word;
}

/** Kayıtlı "Lisans · Bilgisayar Mühendisliği" metnini profil formu için kademe ve bölüme ayırır. */
export function splitGradeLevel(status: EducationStatus | null | undefined, gradeLevel: string | null | undefined) {
  if (!status) return { status: "" as const, level: "", department: "" };
  const [level = "", ...rest] = (gradeLevel ?? "").split(" · ");
  const known = educationLevels(status).includes(level);
  return { status, level: known ? level : "", department: known ? rest.join(" · ") : "" };
}
