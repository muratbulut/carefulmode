// Zamanlanmış temizlik (instrumentation.ts saatte bir çalıştırır):
// - "Hesabı sil" denip 7 günü dolan hesaplar ve bütün verileri (kalıcı kayıtlarda izi olan hesap
//   silinmez, anonimleştirilir; sabah soruları 10),
// - 7 gün içinde doğrulanmayan hesaplar (doküman Bölüm 8, saklama süreleri; sabah soruları 18),
// - sonuçlanmayan öğretmen talebinin 60 gün önce yüklenen belgesi (ad ve boyut kalır; soru 11),
// - süresi dolmuş oturumlar, doğrulama kodları ve istek sınırı sayaçları,
// - öğretmen talebi kararlarının güvenlik ağı: geri al süresi geçmiş kararın belgesi hâlâ
//   duruyorsa silinir, maili gitmediyse gönderilir (lib/teacher/decide.ts; normalde karardan
//   hemen sonra kurulan iş yapar, sunucu o arada kapandıysa burası yakalar).

import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { getMessages } from "@/lib/i18n";
import { deleteExpiredRateLimits } from "@/lib/rate-limit";
import { finalizeDueDecisions } from "@/lib/teacher/decide";

const DAY = 24 * 60 * 60 * 1000;
export const unverifiedRetentionDays = 7;
/** Karar verilmeyen (inceleniyor ya da bilgi istendi) talebin belgesi, yüklendikten bu kadar gün sonra silinir. */
export const pendingDocumentRetentionDays = 60;

type Tx = Prisma.TransactionClient;

/**
 * Hesabı ve ona bağlı verileri siler. Oturumlar, rozetler, sınıf üyelikleri ve öğretmenlik
 * talepleri (belgesiyle) veritabanında hesapla birlikte silinir; lab denemeleri ve öğretmenin
 * sınıfları burada ayrıca silinir (sınıfın üyelikleri ve ödevleri sınıfla birlikte gider,
 * öğrencilerin kendi ilerlemesi kalır).
 *
 * Kalıcı kayıtlarda izi olan hesap (lastingTraces) silinemez: kayıt defteri silinmez ve
 * düzenlenmez, haber ve ipucu yazarına, eklenen okul ve verilen kararlar karar verene bağlıdır.
 * Böyle hesap anonimleştirilir (anonymize): kişisel bilgileri ve girişi silinir, adı "Silinmiş
 * kullanıcı" olur, kayıtlar ona bağlı kalır.
 */
export async function deleteAccount(userId: string): Promise<"deleted" | "anonymized"> {
  return db.$transaction(async (tx) => {
    await tx.labAttempt.deleteMany({ where: { userId } });
    await tx.classroom.deleteMany({ where: { teacherId: userId } });
    if (await lastingTraces(tx, userId)) {
      await anonymize(tx, userId);
      return "anonymized";
    }
    await tx.user.delete({ where: { id: userId } });
    return "deleted";
  });
}

/** Hesabı silmeyi engelleyen kalıcı kayıtlardan biri var mı? */
async function lastingTraces(tx: Tx, userId: string) {
  const found = await Promise.all([
    tx.auditLog.findFirst({ where: { actorId: userId }, select: { id: true } }),
    tx.teamPermission.findFirst({ where: { grantedById: userId }, select: { userId: true } }),
    tx.school.findFirst({ where: { createdById: userId }, select: { id: true } }),
    tx.teacherApplication.findFirst({ where: { decidedById: userId }, select: { id: true } }),
    tx.dailyTip.findFirst({ where: { authorId: userId }, select: { id: true } }),
    tx.newsArticle.findFirst({ where: { authorId: userId }, select: { id: true } }),
  ]);
  return found.some((row) => row !== null);
}

/**
 * Hesabın kişisel verisini siler, satırı kayıtlar için bırakır: ad "Silinmiş kullanıcı", e-posta
 * hiçbir yere ulaşmayan benzersiz bir adres (asıl adresle yeniden kayıt olunabilir), şifre ve
 * oturumlar silinir, rolü DELETED olur (giremez, hiçbir listede görünmez). Ekip izinleri, okul
 * sorumluluğu, rozetler, ilerleme, sınıf üyelikleri ve kendi öğretmenlik talepleri de silinir.
 * Kayıt defterine yazılmaz: işlemi yapan bir kişi yok, kişinin kendi isteği.
 */
async function anonymize(tx: Tx, userId: string) {
  await tx.session.deleteMany({ where: { userId } });
  await tx.account.deleteMany({ where: { userId } });
  await tx.teamPermission.deleteMany({ where: { userId } });
  await tx.school.updateMany({ where: { coordinatorId: userId }, data: { coordinatorId: null } });
  await tx.teacherApplication.deleteMany({ where: { userId } });
  await tx.classroomMembership.deleteMany({ where: { userId } });
  await tx.trainingProgress.deleteMany({ where: { userId } });
  await tx.earnedBadge.deleteMany({ where: { userId } });
  await tx.tipView.deleteMany({ where: { userId } });
  await tx.user.update({
    where: { id: userId },
    data: {
      displayName: getMessages().profile.delete.anonymizedName,
      email: `silinmis-${userId}@silinmis.invalid`,
      emailVerified: false,
      role: "DELETED",
      birthYear: null,
      educationStatus: null,
      gradeLevel: null,
      schoolId: null,
      avatar: null,
      kvkkConsentAt: null,
      lastActiveAt: null,
      lastSignInAt: null,
      previousSignInAt: null,
      suspended: true,
      deletionScheduledAt: null,
    },
  });
}

export async function runCleanup(now = new Date()) {
  const due = await db.user.findMany({
    where: {
      // Anonimleştirilen hesap doğrulanmamış görünür ama yeniden ele alınmaz.
      role: { not: "DELETED" },
      OR: [
        { deletionScheduledAt: { lte: now } },
        { emailVerified: false, createdAt: { lt: new Date(now.getTime() - unverifiedRetentionDays * DAY) } },
      ],
    },
    select: { id: true },
  });
  let accounts = 0;
  for (const { id } of due) {
    try {
      await deleteAccount(id);
      accounts++;
    } catch (error) {
      console.error("[temizlik] hesap silinemedi:", id, error instanceof Error ? error.message : error);
    }
  }
  const [sessions, codes, limits, documents, decisions] = await Promise.all([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }).then((r) => r.count),
    db.verification.deleteMany({ where: { expiresAt: { lt: now } } }).then((r) => r.count),
    deleteExpiredRateLimits(),
    // Bilgi istenip yeni belge gelince yükleme anı yenilenir (application-actions.ts), süre baştan sayılır.
    db.applicationDocument
      .deleteMany({
        where: {
          createdAt: { lt: new Date(now.getTime() - pendingDocumentRetentionDays * DAY) },
          application: { status: { in: ["PENDING", "INFO_REQUESTED"] } },
        },
      })
      .then((r) => r.count),
    finalizeDueDecisions(now).catch((error) => {
      console.error("[temizlik] talep kararları kesinleşemedi:", error instanceof Error ? error.message : error);
      return 0;
    }),
  ]);
  return { accounts, sessions, codes, limits, documents, decisions };
}

let started = false;

/** Sunucu açılınca bir dakika sonra, sonra saatte bir. Bir sunucuda bir kez kurulur. */
export function startCleanupSchedule() {
  if (started) return;
  started = true;
  const run = () =>
    runCleanup()
      .then((r) => {
        if (r.accounts > 0) console.info("[temizlik] silinen hesap:", r.accounts);
        if (r.documents > 0) console.info("[temizlik] süresi dolan talep belgesi:", r.documents);
      })
      .catch((error) => console.error("[temizlik] çalışamadı:", error instanceof Error ? error.message : error));
  setTimeout(run, 60_000).unref();
  setInterval(run, 60 * 60_000).unref();
}
