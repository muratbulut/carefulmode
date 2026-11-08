// Hesap ve profil sunucu eylemlerinin ortak parçaları (lib/account/actions.ts,
// lib/account/profile-actions.ts). Yalnızca sunucuda kullanılır.

import * as z from "@/lib/zod";
import { format, getMessages } from "@/lib/i18n";
import { rateLimit, rateRules } from "@/lib/rate-limit";
import { apiErrorCode, educationLevels, formatClock, type EducationStatus, type FormState } from "./shared";

export const t = () => getMessages().auth;

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** Görünen ad: baştaki, sondaki ve arka arkaya boşluklar atılır. */
export function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function nameOk(name: string) {
  return name.length >= 2 && name.length <= 24;
}

export function tooMany(retryAfterSec: number, message?: string): FormState {
  const text = message ?? format(t().errors.tooMany, { time: formatClock(retryAfterSec) });
  return { status: "error", message: text, retryAfterSec, code: "rate_limited" };
}

/** Kod gönderme sınırları: e-posta başına 60 sn ara ve saatlik üst sınır, IP başına geniş sınır. */
export async function consumeCodeSend(email: string, ip: string) {
  for (const [rule, id] of [
    [rateRules.codeSendIp, ip],
    [rateRules.codeSendCooldown, email],
    [rateRules.codeSendHourly, email],
  ] as const) {
    const result = await rateLimit.consume(rule, id);
    if (!result.allowed) return result;
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** Better Auth'un kod hatalarını ekrandaki mesaja çevirir. */
export function codeError(error: unknown): FormState {
  const m = t();
  const code = apiErrorCode(error);
  if (code === "OTP_EXPIRED") return { status: "error", code: "expired", message: m.code.expired };
  if (code === "TOO_MANY_ATTEMPTS") return { status: "error", code: "expired", message: m.code.tooManyAttempts };
  if (code === "INVALID_OTP" || code === "USER_NOT_FOUND") return { status: "error", code: "wrong", message: m.code.wrong };
  console.error("[auth] kod doğrulanamadı:", code ?? error);
  return { status: "error", message: m.errors.generic };
}

/**
 * Eğitim durumu isteğe bağlıdır; listede olmayan kademe yok sayılır. Ön lisans ve üstünde
 * bölüm "Lisans · Bilgisayar Mühendisliği" biçiminde kademeye eklenir.
 */
export function parseEducation(education: string, level: string, department: string) {
  const educationStatus: EducationStatus | undefined =
    education === "STUDYING" || education === "GRADUATED" ? education : undefined;
  const levels = educationStatus ? educationLevels(educationStatus) : [];
  const levelIndex = levels.indexOf(level);
  const dept = department.trim().replace(/\s+/g, " ");
  const gradeLevel = levelIndex < 0 ? undefined : levelIndex >= 2 && dept ? `${level} · ${dept}` : level;
  return { educationStatus, gradeLevel };
}
