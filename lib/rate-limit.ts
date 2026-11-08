// İstek sınırları (doküman Bölüm 8): giriş, kayıt, kod gönderme ve şifre sıfırlama.
//
// Sayaçlar veritabanında durur (RateLimit tablosu), böylece uygulama yeniden başlasa da
// sınır sürer. Pencere sabittir: ilk istekle başlar, süresi dolunca sayaç sıfırdan sayar.
// Okullarda bütün sınıf tek IP'den çıkar; bu yüzden IP sınırları geniş, asıl koruma
// e-posta başına sınırlardadır. IP sınırları aynı saatte birkaç sınıfı (35'er öğrenci) geçirecek
// kadar geniştir (sabah soruları 19; önceki sınır aynı saatte iki sınıfta 10 öğrenciyi
// geri çeviriyordu, tests/load/README.md "Okul-IP denemesi").

import { db } from "@/lib/db";

export type RateRule = {
  /** Anahtarın ilk parçası; aynı kimlik için kuralları birbirinden ayırır. */
  name: string;
  max: number;
  windowSec: number;
};

export const rateRules = {
  // 5 hatalı girişten sonra o e-posta için bekleme (Tur 1, ekran 6). Başarılı giriş sıfırlar.
  signInFailures: { name: "sign-in-fail", max: 5, windowSec: 5 * 60 },
  signInIp: { name: "sign-in-ip", max: 300, windowSec: 10 * 60 },
  signUpIp: { name: "sign-up-ip", max: 200, windowSec: 60 * 60 },
  // Kod tekrar gönderme 60 saniyede bir (Bölüm 8); saatte en fazla 6 kod.
  codeSendCooldown: { name: "code-cooldown", max: 1, windowSec: 60 },
  codeSendHourly: { name: "code-hourly", max: 6, windowSec: 60 * 60 },
  codeSendIp: { name: "code-ip", max: 300, windowSec: 60 * 60 },
  // Kod denemesi: kodun kendisi 5 yanlışta geçersizleşir; bu sınır yeni kod isteyip
  // denemeyi sürdürmeyi yavaşlatır.
  codeVerifyIp: { name: "code-verify-ip", max: 300, windowSec: 10 * 60 },
  // Lab eylemleri (olay gönderme, cevap, eğitim kartları) kullanıcı başına. Normal bir öğrenci
  // 10 dakikada birkaç düzine istek atar; sınır yalnızca betikle yüklenmeyi keser.
  labActions: { name: "lab-actions", max: 600, windowSec: 10 * 60 },
  // Sınıf koduyla katılma denemesi kullanıcı başına: kod tahmin edilemesin (32^6 olasılık),
  // yanlış yazan öğrenci de birkaç kez deneyebilsin.
  joinClassUser: { name: "join-class", max: 10, windowSec: 10 * 60 },
  // Okul ağında bütün sınıf aynı IP'den katılır; geniş tutulur.
  joinClassIp: { name: "join-class-ip", max: 300, windowSec: 10 * 60 },
  // Öğretmenin sınıf işleri (sınıf aç, ödev ver, öğrenci çıkar...) ve okul sorumlusunun işleri.
  classroomActions: { name: "classroom-actions", max: 120, windowSec: 10 * 60 },
  // Yönetimdeki yazma işleri (lab, ipucu, gündem, öğretmen talepleri, ekip, kullanıcılar, okullar)
  // ve öğrenci profiline bakış, kişi başına. Her işlem silinmeyen kayıt defterine bir satır yazar;
  // sınır betikle defteri doldurmayı keser (güvenlik turu 4).
  adminActions: { name: "admin-actions", max: 120, windowSec: 10 * 60 },
  // Öğretmenlik talebi gönderme, cevaplama, geri çekme; belge yükleme de buna dahildir.
  applicationActions: { name: "application-actions", max: 10, windowSec: 60 * 60 },
  // Okul sorumlusunun öğretmene hatırlatma maili: aynı öğretmene günde bir kez (kural eylemde),
  // sorumlu başına saatte en fazla 20.
  reminderMails: { name: "reminder-mails", max: 20, windowSec: 60 * 60 },
} as const satisfies Record<string, RateRule>;

export type RateResult = { allowed: boolean; retryAfterSec: number };

/** Sayaç deposu. Uygulamada veritabanı; birim testlerinde bellek. */
export type RateStore = {
  /** Sayacı bir artırır (pencere dolduysa 1'den başlatır); yeni değeri ve bitişi döner. */
  hit(key: string, windowSec: number): Promise<{ count: number; resetAt: Date }>;
  get(key: string): Promise<{ count: number; resetAt: Date } | null>;
  delete(key: string): Promise<void>;
};

const dbStore: RateStore = {
  async hit(key, windowSec) {
    // Tek sorguda ve atomik: aynı anda gelen iki istek sayacı birlikte bozamaz.
    const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + make_interval(secs => ${windowSec}))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
      RETURNING "count", "resetAt"`;
    return rows[0];
  },
  async get(key) {
    return db.rateLimit.findUnique({ where: { key }, select: { count: true, resetAt: true } });
  },
  async delete(key) {
    await db.rateLimit.deleteMany({ where: { key } });
  },
};

function keyOf(rule: RateRule, id: string) {
  return `${rule.name}:${id.toLowerCase()}`;
}

function secondsUntil(date: Date, now: Date) {
  return Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 1000));
}

export function createRateLimiter(store: RateStore, clock: () => Date = () => new Date()) {
  return {
    /** Bir istek sayar. Sınır aşıldıysa allowed=false ve kalan bekleme süresi döner. */
    async consume(rule: RateRule, id: string): Promise<RateResult> {
      const { count, resetAt } = await store.hit(keyOf(rule, id), rule.windowSec);
      if (count <= rule.max) return { allowed: true, retryAfterSec: 0 };
      return { allowed: false, retryAfterSec: secondsUntil(resetAt, clock()) };
    },

    /** Saymadan bakar: sınır dolmuş mu? (Ör. giriş denemesinden önce kilit kontrolü.) */
    async check(rule: RateRule, id: string): Promise<RateResult> {
      const row = await store.get(keyOf(rule, id));
      const now = clock();
      if (!row || row.resetAt <= now || row.count < rule.max) return { allowed: true, retryAfterSec: 0 };
      return { allowed: false, retryAfterSec: secondsUntil(row.resetAt, now) };
    },

    /** Penceredeki sayaç değeri (süresi dolduysa 0). */
    async count(rule: RateRule, id: string): Promise<number> {
      const row = await store.get(keyOf(rule, id));
      return !row || row.resetAt <= clock() ? 0 : row.count;
    },

    async reset(rule: RateRule, id: string) {
      await store.delete(keyOf(rule, id));
    },
  };
}

export const rateLimit = createRateLimiter(dbStore);

/** Süresi dolmuş sayaçları siler (zamanlanmış temizlik işi). */
export async function deleteExpiredRateLimits() {
  const { count } = await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
  return count;
}
