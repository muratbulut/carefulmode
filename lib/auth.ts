// Kimlik doğrulama: Better Auth (e-posta + şifre, 6 haneli e-posta kodu).
//
// Better Auth'un HTTP uçları (/api/auth/...) açılmaz. Formlar sunucu eylemleri
// (lib/account/actions.ts, lib/account/profile-actions.ts) üzerinden auth.api.* çağırır; böylece istek sınırları
// (lib/rate-limit.ts) ve hata mesajları tek yerden geçer, sınırı atlayan bir yol kalmaz.
//
// Örnek ilk kullanımda kurulur (getAuth): "next build" sırasında BETTER_AUTH_SECRET
// olmasa da içe aktarma hata vermez.

import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { after } from "next/server";
import { codeLength } from "@/lib/account/shared";
import { brand } from "@/lib/brand";
import { db } from "@/lib/db";
import { codeMail, type CodePurpose } from "@/lib/mail/code-mail";
import { sendMail } from "@/lib/mail";
import { siteUrl } from "@/lib/site";

/** E-posta kodu kuralları (doküman Bölüm 8): 6 hane, 10 dakika, en fazla 5 yanlış deneme. */
export const codeRules = { length: codeLength, expiresInSec: 10 * 60, attempts: 5 } as const;

const codePurposes: Record<string, CodePurpose> = {
  "email-verification": "verify",
  "forget-password": "reset",
  "change-email": "changeEmail",
};

async function sendCode(email: string, otp: string, type: string) {
  const purpose = codePurposes[type];
  // Kodla giriş kullanılmıyor; başka bir tür gelirse mail gitmez.
  if (!purpose) return;
  const user = await db.user.findUnique({ where: { email }, select: { displayName: true } });
  const message = codeMail({
    to: email,
    code: otp,
    purpose,
    name: purpose === "changeEmail" ? null : user?.displayName,
    minutes: codeRules.expiresInSec / 60,
    siteUrl: siteUrl(),
  });
  try {
    await sendMail(message);
  } catch (error) {
    // Kod ve adres kayda yazılmaz; kullanıcı "Kodu tekrar gönder" ile yeniden ister.
    console.error("[auth] kod maili gönderilemedi:", error instanceof Error ? error.message : error);
  }
}

function createAuth() {
  return betterAuth({
    appName: brand.name,
    baseURL: siteUrl(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: prismaAdapter(db, { provider: "postgresql" }),

    user: {
      fields: { name: "displayName", image: "avatar" },
      additionalFields: {
        role: { type: ["STUDENT", "TEACHER", "ADMIN"], required: false, input: false, defaultValue: "STUDENT" },
        birthYear: { type: "number", required: false },
        educationStatus: { type: ["STUDYING", "GRADUATED"], required: false },
        gradeLevel: { type: "string", required: false },
        kvkkConsentAt: { type: "date", required: false },
        deletionScheduledAt: { type: "date", required: false, input: false },
      },
    },

    session: {
      // Kullanıldıkça uzar; 7 gün hiç girilmezse oturum kapanır.
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },

    databaseHooks: {
      user: {
        update: {
          // E-postayı "doğrulandı" yapan yazım, kodla kanıtlanan adresi de aynı anda yazar. Şifre
          // sıfırlama yalnızca emailVerified yazar; o arada doğrulanmamış hesabın adresi
          // değiştirildiyse (changeUnverifiedEmail) kanıtlanmamış yeni adres doğrulanmış sayılmasın.
          // Kanıtlanan adres bilinmiyorsa "doğrulandı" hiç yazılmaz.
          before: async (data, context) => {
            if (data.emailVerified !== true || typeof data.email === "string") return;
            const proven = (context?.body as { email?: unknown } | undefined)?.email;
            if (typeof proven !== "string") return false;
            return { data: { ...data, email: proven.trim().toLowerCase() } };
          },
        },
      },
      session: {
        create: {
          // Askıya alınmış hesaba oturum açılmaz (yönetim panelinden askıya alınır).
          before: async (session) => {
            const user = await db.user.findUnique({ where: { id: session.userId }, select: { suspended: true } });
            if (user?.suspended) throw new APIError("FORBIDDEN", { code: "ACCOUNT_SUSPENDED", message: "Account suspended" });
          },
        },
      },
    },

    emailAndPassword: {
      enabled: true,
      // Güç kuralı (12 karakter, yaygın şifre değil...) sunucu eyleminde lib/password-strength ile
      // ayrıca uygulanır; buradaki alt sınır doküman Bölüm 8'deki asgari kuraldır.
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      // Doğrulanmamış kullanıcı girebilir ama lab başlatamaz (Faz 2 bitti ölçütü).
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
    },

    emailVerification: {
      // Kayıtla birlikte doğrulama kodu gider (emailOTP bu gönderimi kod mailine çevirir).
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
    },

    plugins: [
      emailOTP({
        otpLength: codeRules.length,
        expiresIn: codeRules.expiresInSec,
        allowedAttempts: codeRules.attempts,
        storeOTP: "hashed",
        sendVerificationOnSignUp: true,
        overrideDefaultEmailVerification: true,
        // Kodla giriş yok; kod yalnızca doğrulama, şifre sıfırlama ve e-posta değiştirme içindir.
        disableSignUp: true,
        changeEmail: { enabled: true },
        sendVerificationOTP: ({ email, otp, type }) => sendCode(email, otp, type),
      }),
      // Sunucu eylemlerinde çerezleri yazar; listenin sonunda olmalı.
      nextCookies(),
    ],

    // Sınırlar lib/rate-limit.ts'de; Better Auth'un kendi sınırlayıcısı uçlar açık olmadığı için kapalı.
    rateLimit: { enabled: false },

    advanced: {
      // Kimlikleri veritabanı şeması üretir (cuid), diğer tablolarla aynı biçimde.
      database: { generateId: false },
      // Gerçek ziyaretçi IP'si: sunucuda nginx, diğer kurulumlarda Caddy yazar.
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
      // Mail gönderimi yanıttan sonra yapılır: yanıt süresi hesabın var olup olmadığını belli etmez.
      backgroundTasks: { handler: (promise) => after(promise) },
    },
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { auth?: Auth };

export function getAuth(): Auth {
  globalForAuth.auth ??= createAuth();
  return globalForAuth.auth;
}

export type SessionUser = Auth["$Infer"]["Session"]["user"];
