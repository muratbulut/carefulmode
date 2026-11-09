"use server";

// Profil sayfasının sunucu eylemleri (Tur 2, ekran 16): hesap bilgileri, e-posta değiştirme,
// avatar, şifre, oturumlar ve hesap silme. Her eylem oturumu kendisi denetler; tarayıcıdan
// gelen kullanıcı kimliğine hiç güvenilmez.

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { isAvatarCode } from "@/lib/avatars";
import { db } from "@/lib/db";
import { format, getMessages } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { evaluatePassword, personalTokens } from "@/lib/password-strength";
import { rateLimit, rateRules } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { getSession } from "@/lib/session";
import { cleanName, codeError, consumeCodeSend, emailSchema, field, nameOk, parseEducation, tooMany } from "./action-helpers";
import { apiErrorCode, codeLength, deletionGraceDays, isDeleteWord, withNext, type FormState } from "./shared";

const messages = () => getMessages();

async function requireSession() {
  const session = await getSession();
  if (!session) redirect(withNext(routes.signIn, routes.profile));
  return session;
}

/**
 * Şifre soran işlemlerde yanlış şifre, girişteki 5 deneme sınırına sayılır; böylece profil
 * ekranı şifre denemek için ikinci bir kapı olmaz.
 */
async function passwordLock(email: string): Promise<FormState | null> {
  const lock = await rateLimit.check(rateRules.signInFailures, email);
  return lock.allowed ? null : tooMany(lock.retryAfterSec);
}

async function wrongPassword(email: string, message: string): Promise<FormState> {
  await rateLimit.consume(rateRules.signInFailures, email);
  return (await passwordLock(email)) ?? { status: "error", fieldErrors: { password: message } };
}

// ---------------------------------------------------------------------------
// Hesap bilgileri
// ---------------------------------------------------------------------------

export async function updateProfile(_prev: FormState, form: FormData): Promise<FormState> {
  const m = messages();
  const { user } = await requireSession();
  const name = cleanName(field(form, "name"));
  const department = field(form, "department");
  const errors: FormState["fieldErrors"] = {};
  if (!nameOk(name)) errors.name = m.auth.errors.nameLength;
  if (department.trim().length > 60) errors.department = m.auth.errors.department;
  if (Object.keys(errors).length > 0) return { status: "error", fieldErrors: errors };

  const { educationStatus, gradeLevel } = parseEducation(field(form, "education"), field(form, "level"), department);
  await db.user.update({
    where: { id: user.id },
    data: { displayName: name, educationStatus: educationStatus ?? null, gradeLevel: gradeLevel ?? null },
  });
  refresh();
  return { status: "ok", message: m.profile.account.saved };
}

/** 1. adım: şifreyi denetler, yeni adrese kod gönderir. Adres başka hesaba aitse kod gitmez ama sonuç aynıdır. */
export async function requestEmailChange(_prev: FormState, form: FormData): Promise<FormState> {
  const m = messages();
  const { user } = await requireSession();
  const parsed = emailSchema.safeParse(field(form, "email"));
  if (!parsed.success) return { status: "error", fieldErrors: { email: m.auth.errors.email } };
  const newEmail = parsed.data;
  if (newEmail === user.email) return { status: "error", fieldErrors: { email: m.profile.email.same } };

  const locked = await passwordLock(user.email);
  if (locked) return locked;
  const h = await headers();
  try {
    await getAuth().api.verifyPassword({ body: { password: field(form, "password") }, headers: h });
  } catch (error) {
    if (apiErrorCode(error) === "INVALID_PASSWORD") return wrongPassword(user.email, m.profile.email.wrongPassword);
    console.error("[profil] şifre denetlenemedi:", apiErrorCode(error) ?? error);
    return { status: "error", message: m.auth.errors.generic };
  }
  await rateLimit.reset(rateRules.signInFailures, user.email);

  const limit = await consumeCodeSend(newEmail, clientIp(h));
  if (!limit.allowed) return tooMany(limit.retryAfterSec);
  try {
    await getAuth().api.requestEmailChangeEmailOTP({ body: { newEmail }, headers: h });
  } catch (error) {
    console.error("[profil] e-posta kodu istenemedi:", apiErrorCode(error) ?? error);
    return { status: "error", message: m.auth.errors.generic };
  }
  return { status: "ok", code: "sent", email: newEmail, retryAfterSec: rateRules.codeSendCooldown.windowSec };
}

/** 2. adım: yeni adrese gelen kodla adresi değiştirir. */
export async function confirmEmailChange(_prev: FormState, form: FormData): Promise<FormState> {
  const m = messages();
  await requireSession();
  const parsed = emailSchema.safeParse(field(form, "email"));
  const otp = field(form, "code").replace(/\D/g, "");
  if (!parsed.success || otp.length !== codeLength) return { status: "error", code: "wrong", message: m.auth.code.incomplete };

  const h = await headers();
  const ipLimit = await rateLimit.consume(rateRules.codeVerifyIp, clientIp(h));
  if (!ipLimit.allowed) return tooMany(ipLimit.retryAfterSec);
  try {
    await getAuth().api.changeEmailEmailOTP({ body: { newEmail: parsed.data, otp }, headers: h });
  } catch (error) {
    // Kod doğruysa ama adres bu arada başka hesaba geçtiyse Better Auth kodsuz hata döner.
    const text = error instanceof Error ? error.message : "";
    if (/already in use/i.test(text) || apiErrorCode(error) === "EMAIL_ALREADY_IN_USE") {
      return { status: "error", message: m.profile.email.taken };
    }
    return codeError(error);
  }
  refresh();
  return { status: "ok", message: m.profile.email.changed };
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

export async function setAvatar(code: string): Promise<FormState> {
  const m = messages();
  const { user } = await requireSession();
  if (!isAvatarCode(code)) return { status: "error", message: m.auth.errors.generic };
  await db.user.update({ where: { id: user.id }, data: { avatar: code } });
  refresh();
  return { status: "ok", message: format(m.profile.avatar.changed, { name: m.profile.avatar.names[code] }) };
}

// ---------------------------------------------------------------------------
// Güvenlik
// ---------------------------------------------------------------------------

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const m = messages();
  const { user } = await requireSession();
  const currentPassword = field(form, "password");
  const newPassword = field(form, "newPassword");
  if (!evaluatePassword(newPassword, personalTokens(user.name, user.email)).accepted || newPassword.length > 128) {
    return { status: "error", fieldErrors: { newPassword: m.auth.errors.passwordWeak } };
  }

  const locked = await passwordLock(user.email);
  if (locked) return locked;
  try {
    await getAuth().api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch (error) {
    const code = apiErrorCode(error);
    if (code === "INVALID_PASSWORD") return wrongPassword(user.email, m.profile.security.wrongPassword);
    if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
      return { status: "error", fieldErrors: { newPassword: m.auth.errors.passwordWeak } };
    }
    console.error("[profil] şifre değiştirilemedi:", code ?? error);
    return { status: "error", message: m.auth.errors.generic };
  }
  await rateLimit.reset(rateRules.signInFailures, user.email);
  refresh();
  return { status: "ok", message: m.profile.security.changed };
}

export async function signOutOtherDevices(): Promise<FormState> {
  const m = messages();
  await requireSession();
  await getAuth().api.revokeOtherSessions({ headers: await headers() });
  refresh();
  return { status: "ok", message: m.profile.security.signedOutOthers };
}

// ---------------------------------------------------------------------------
// Hesabı sil
// ---------------------------------------------------------------------------

/**
 * Hesap hemen silinmez: silme tarihi yazılır, diğer cihazlardaki oturumlar kapanır.
 * Süre dolunca zamanlanmış temizlik (lib/cleanup.ts) hesabı ve bütün verisini siler.
 */
export async function scheduleDeletion(_prev: FormState, form: FormData): Promise<FormState> {
  const m = messages();
  const { user } = await requireSession();
  const word = m.profile.delete.confirmWord;
  if (!isDeleteWord(field(form, "confirm"), word)) {
    return { status: "error", fieldErrors: { confirm: format(m.profile.delete.wrongWord, { word }) } };
  }
  const at = new Date(Date.now() + deletionGraceDays * 24 * 60 * 60 * 1000);
  await db.user.update({ where: { id: user.id }, data: { deletionScheduledAt: at } });
  await getAuth().api.revokeOtherSessions({ headers: await headers() });
  refresh();
  return { status: "ok", message: m.profile.delete.requested };
}

export async function cancelDeletion(): Promise<FormState> {
  const m = messages();
  const { user } = await requireSession();
  await db.user.update({ where: { id: user.id }, data: { deletionScheduledAt: null } });
  refresh();
  return { status: "ok", message: m.profile.delete.cancelled };
}
