"use server";

// Hesap ekranlarının sunucu eylemleri: kayıt, giriş, e-posta doğrulama, şifre sıfırlama, çıkış.
// Better Auth'a yalnızca buradan gidilir (lib/auth.ts); istek sınırları ve kullanıcıya
// gösterilen mesajlar burada uygulanır. Mesajlar sözlükten gelir (t.auth).

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { promoteConfiguredAdmin } from "@/lib/admin/promote";
import { codeRules, getAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { routes } from "@/lib/navigation";
import { evaluatePassword, personalTokens } from "@/lib/password-strength";
import { rateLimit, rateRules } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { getUser } from "@/lib/session";
import { cleanName, codeError, consumeCodeSend, emailSchema, field, nameOk, parseEducation, t, tooMany } from "./action-helpers";
import { apiErrorCode, isMinor, maxBirthYear, minBirthYear, safeNext, withNext, type FormState } from "./shared";

// ---------------------------------------------------------------------------
// Kayıt
// ---------------------------------------------------------------------------

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  const m = t();
  const h = await headers();
  const ip = clientIp(h);

  const limit = await rateLimit.consume(rateRules.signUpIp, ip);
  if (!limit.allowed) return tooMany(limit.retryAfterSec);

  const name = cleanName(field(form, "name"));
  const email = emailSchema.safeParse(field(form, "email"));
  const password = field(form, "password");
  const birthYear = Number.parseInt(field(form, "birthYear"), 10);
  const education = field(form, "education");
  const level = field(form, "level");
  const department = field(form, "department").trim();

  const errors: FormState["fieldErrors"] = {};
  if (!nameOk(name)) errors.name = m.errors.nameLength;
  if (!email.success) errors.email = m.errors.email;
  if (!evaluatePassword(password, personalTokens(name, email.data)).accepted || password.length > 128) {
    errors.password = m.errors.passwordWeak;
  }
  const yearOk = Number.isInteger(birthYear) && birthYear >= minBirthYear() && birthYear <= maxBirthYear();
  if (!yearOk) errors.birthYear = m.errors.birthYear;
  if (form.get("kvkk") !== "on") errors.kvkk = m.errors.kvkk;
  if (yearOk && isMinor(birthYear) && form.get("guardian") !== "on") errors.guardian = m.errors.guardian;
  if (department.length > 60) errors.department = m.errors.department;
  if (Object.keys(errors).length > 0 || !email.success) return { status: "error", fieldErrors: errors };

  const { educationStatus, gradeLevel } = parseEducation(education, level, department);

  try {
    await getAuth().api.signUpEmail({
      body: {
        name,
        email: email.data,
        password,
        birthYear,
        educationStatus,
        gradeLevel,
        kvkkConsentAt: new Date(),
      },
      headers: h,
    });
  } catch (error) {
    const code = apiErrorCode(error);
    if (code?.startsWith("USER_ALREADY_EXISTS")) {
      return { status: "error", fieldErrors: { email: m.errors.emailTaken } };
    }
    if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
      return { status: "error", fieldErrors: { password: m.errors.passwordWeak } };
    }
    console.error("[auth] kayıt başarısız:", code ?? error);
    return { status: "error", message: m.errors.generic };
  }

  // Kayıtla birlikte ilk kod gitti; "tekrar gönder" için 60 sn ara buradan başlar.
  await consumeCodeSend(email.data, ip);
  redirect(withNext(routes.verify, safeNext(field(form, "next"), "") || undefined));
}

// ---------------------------------------------------------------------------
// Giriş
// ---------------------------------------------------------------------------

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const m = t();
  const h = await headers();
  const ip = clientIp(h);
  const next = safeNext(field(form, "next"));
  const parsed = emailSchema.safeParse(field(form, "email"));
  const password = field(form, "password");
  // Geçersiz adres de "hatalı" sayılır; hangi alanın yanlış olduğu söylenmez.
  const email = parsed.success ? parsed.data : field(form, "email").trim().toLowerCase().slice(0, 254);

  const ipLimit = await rateLimit.consume(rateRules.signInIp, ip);
  if (!ipLimit.allowed) return tooMany(ipLimit.retryAfterSec, m.signIn.tooManyFromNetwork);

  const lock = await rateLimit.check(rateRules.signInFailures, email);
  if (!lock.allowed) return { status: "error", code: "locked", retryAfterSec: lock.retryAfterSec };

  let userId: string;
  try {
    if (!parsed.success || !password) throw new Error("INVALID_EMAIL_OR_PASSWORD");
    const result = await getAuth().api.signInEmail({
      body: { email, password, rememberMe: true },
      headers: h,
    });
    userId = result.user.id;
  } catch (error) {
    const code = error instanceof Error && error.message === "INVALID_EMAIL_OR_PASSWORD" ? error.message : apiErrorCode(error);
    if (code === "ACCOUNT_SUSPENDED") return { status: "error", message: m.signIn.suspended };
    if (code !== "INVALID_EMAIL_OR_PASSWORD") {
      console.error("[auth] giriş başarısız:", code ?? error);
      return { status: "error", message: m.errors.generic };
    }
    await rateLimit.consume(rateRules.signInFailures, email);
    const after = await rateLimit.check(rateRules.signInFailures, email);
    if (!after.allowed) return { status: "error", code: "locked", retryAfterSec: after.retryAfterSec };
    const failures = await rateLimit.count(rateRules.signInFailures, email);
    return {
      status: "error",
      code: "wrong",
      attemptsLeft: Math.max(0, rateRules.signInFailures.max - failures),
    };
  }

  await rateLimit.reset(rateRules.signInFailures, email);
  // ADMIN_EMAILS'teki doğrulanmış adres yönetici olur (lib/admin/promote.ts).
  await promoteConfiguredAdmin(userId);
  // 7 gün içinde giriş yapılırsa hesap silme isteği iptal olur.
  const cancelled = await db.user.updateMany({
    where: { id: userId, deletionScheduledAt: { not: null } },
    data: { deletionScheduledAt: null },
  });
  redirect(cancelled.count > 0 ? `${routes.profile}?silme=iptal` : next);
}

export async function signOut() {
  await getAuth().api.signOut({ headers: await headers() });
  redirect(routes.home);
}

// ---------------------------------------------------------------------------
// E-posta doğrulama
// ---------------------------------------------------------------------------

export async function verifyEmail(_prev: FormState, form: FormData): Promise<FormState> {
  const m = t();
  const user = await getUser();
  if (!user) redirect(withNext(routes.signIn, routes.verify));
  const next = safeNext(field(form, "next"));
  if (user.emailVerified) redirect(next);

  const h = await headers();
  const ipLimit = await rateLimit.consume(rateRules.codeVerifyIp, clientIp(h));
  if (!ipLimit.allowed) return tooMany(ipLimit.retryAfterSec);

  const otp = field(form, "code").replace(/\D/g, "");
  if (otp.length !== codeRules.length) return { status: "error", code: "wrong", message: m.code.incomplete };

  try {
    await getAuth().api.verifyEmailOTP({ body: { email: user.email, otp }, headers: h });
  } catch (error) {
    return codeError(error);
  }
  // ADMIN_EMAILS'teki adres doğrulanınca yönetici olur (lib/admin/promote.ts).
  await promoteConfiguredAdmin(user.id);
  return { status: "ok", redirectTo: next };
}

export async function resendVerificationCode(): Promise<FormState> {
  const m = t();
  const user = await getUser();
  if (!user) redirect(withNext(routes.signIn, routes.verify));
  if (user.emailVerified) return { status: "ok", message: m.verify.alreadyVerified };

  const h = await headers();
  const limit = await consumeCodeSend(user.email, clientIp(h));
  if (!limit.allowed) return tooMany(limit.retryAfterSec);

  await getAuth().api.sendVerificationOTP({ body: { email: user.email, type: "email-verification" }, headers: h });
  return { status: "ok", code: "sent", message: m.code.resent, retryAfterSec: rateRules.codeSendCooldown.windowSec };
}

/** Doğrulanmamış hesapta e-posta yanlış yazıldıysa adresi değiştirip yeni kod gönderir. */
export async function changeUnverifiedEmail(_prev: FormState, form: FormData): Promise<FormState> {
  const m = t();
  const user = await getUser();
  if (!user) redirect(withNext(routes.signIn, routes.verify));
  if (user.emailVerified) return { status: "error", message: m.verify.alreadyVerified };

  const parsed = emailSchema.safeParse(field(form, "email"));
  if (!parsed.success) return { status: "error", fieldErrors: { email: m.errors.email } };
  const email = parsed.data;
  if (email === user.email) return { status: "ok", email };

  const h = await headers();
  const limit = await consumeCodeSend(email, clientIp(h));
  if (!limit.allowed) return tooMany(limit.retryAfterSec);

  // Adres henüz doğrulanmadığı için sahiplik kanıtlanmış değil; yeni adres kodla doğrulanacak.
  const taken = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) return { status: "error", fieldErrors: { email: m.verify.emailTaken } };
  // Yalnızca hâlâ doğrulanmamış ve adresi değişmemiş hesap yazılır: kod doğrulaması bu arada
  // bittiyse (iki sekme ya da aynı anda iki istek) kanıtlanmamış yeni adres doğrulanmış sayılmasın.
  try {
    const changed = await db.user.updateMany({ where: { id: user.id, email: user.email, emailVerified: false }, data: { email } });
    if (changed.count === 0) return { status: "error", message: m.verify.alreadyVerified };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { status: "error", fieldErrors: { email: m.verify.emailTaken } };
    throw error;
  }

  await getAuth().api.sendVerificationOTP({ body: { email, type: "email-verification" }, headers: h });
  return { status: "ok", code: "sent", email, message: m.code.resent, retryAfterSec: rateRules.codeSendCooldown.windowSec };
}

// ---------------------------------------------------------------------------
// Şifre sıfırlama (4 adım: e-posta, mail, kod, yeni şifre)
// ---------------------------------------------------------------------------

/** Kod ister. Yanıt, adresle bir hesap olsa da olmasa da aynıdır. */
export async function requestPasswordReset(_prev: FormState, form: FormData): Promise<FormState> {
  const m = t();
  const parsed = emailSchema.safeParse(field(form, "email"));
  if (!parsed.success) return { status: "error", fieldErrors: { email: m.errors.email } };
  const email = parsed.data;

  const h = await headers();
  const limit = await consumeCodeSend(email, clientIp(h));
  if (!limit.allowed) return tooMany(limit.retryAfterSec);

  await getAuth().api.requestPasswordResetEmailOTP({ body: { email }, headers: h });
  return { status: "ok", code: "sent", email, retryAfterSec: rateRules.codeSendCooldown.windowSec };
}

/** 3. adım: kodu harcamadan denetler; doğruysa yeni şifre adımına geçilir. */
export async function checkResetCode(_prev: FormState, form: FormData): Promise<FormState> {
  const m = t();
  const email = emailSchema.safeParse(field(form, "email"));
  const otp = field(form, "code").replace(/\D/g, "");
  if (!email.success || otp.length !== codeRules.length) return { status: "error", code: "wrong", message: m.code.incomplete };

  const h = await headers();
  const ipLimit = await rateLimit.consume(rateRules.codeVerifyIp, clientIp(h));
  if (!ipLimit.allowed) return tooMany(ipLimit.retryAfterSec);

  try {
    await getAuth().api.checkVerificationOTP({ body: { email: email.data, type: "forget-password", otp }, headers: h });
  } catch (error) {
    return codeError(error);
  }
  return { status: "ok" };
}

export async function resetPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const m = t();
  const email = emailSchema.safeParse(field(form, "email"));
  const otp = field(form, "code").replace(/\D/g, "");
  const password = field(form, "password");
  if (!email.success || otp.length !== codeRules.length) return { status: "error", code: "wrong", message: m.code.wrong };
  if (!evaluatePassword(password, personalTokens(email.data)).accepted || password.length > 128) {
    return { status: "error", fieldErrors: { password: m.errors.passwordWeak } };
  }

  const h = await headers();
  const ipLimit = await rateLimit.consume(rateRules.codeVerifyIp, clientIp(h));
  if (!ipLimit.allowed) return tooMany(ipLimit.retryAfterSec);

  try {
    await getAuth().api.resetPasswordEmailOTP({ body: { email: email.data, otp, password }, headers: h });
  } catch (error) {
    return codeError(error);
  }
  // Yeni şifreyle giriş kilide takılmasın.
  await rateLimit.reset(rateRules.signInFailures, email.data);
  return { status: "ok" };
}
