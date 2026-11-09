// Yük testi hesaplarının ortak parçaları (prepare.ts, cleanup.ts). Yük testinin açtığı her hesap
// aynı alan adındadır; temizlik yalnızca bu adresleri ve onlara bağlı satırları siler.
//
// Bu betikler yalnızca bu makinedeki veritabanında çalışır: sürücünün bağlanacağı adres
// localhost, 127.0.0.1 ya da ::1 değilse çalışmayı reddeder (safety.ts). Canlı veritabanında yük
// hesabı açmak ayrı bir karardır (tests/load/README.md, "Canlı koşu").

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../lib/generated/prisma/client.ts";
import { checkLocalDatabase } from "./safety.ts";

/** Yük testi hesaplarının alan adı (.invalid hiçbir zaman gerçek bir adres olamaz). */
export const loadEmailDomain = "load.carefulmode.invalid";

/** Yük testi içeriğinin (haber, ipucu) kısa adlarının başı; temizlik bunlara bakar. */
export const loadSlugPrefix = "yuk-testi-";

/**
 * Yük testinin gönderdiği X-Forwarded-For adresleri belgelerde kullanılan ayrılmış bloklardan
 * gelir (RFC 5737): okul ağı 203.0.113.0/24, ev ağları 198.51.100.0/24. Temizlik bu adreslerin
 * istek sınırı sayaçlarını da siler.
 */
export const loadIpPrefixes = ["203.0.113.", "198.51.100."] as const;

/** Adres yerel değilse süreci durdurur. Döndürdüğü değer yalnızca ekrana yazmak içindir (şifresiz). */
export function assertLocalDatabase(url: string | undefined): string {
  const check = checkLocalDatabase(url);
  if (!check.ok) {
    console.error(check.reason);
    process.exit(1);
  }
  return check.where;
}

export function connect(url: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export type Db = ReturnType<typeof connect>;

/**
 * Yük testinin bıraktığı her şeyi siler: hesaplar, denemeleri, sınıfları, haberleri, ipuçları,
 * istek sınırı sayaçları. Kayıt defteri silinmez; deftere satır yazmış bir yük hesabı olursa
 * (olmaması gerekir) o hesap silinmez ve ekrana yazılır.
 */
export async function deleteLoadData(db: Db) {
  const users = await db.user.findMany({ where: { email: { endsWith: `@${loadEmailDomain}` } }, select: { id: true, email: true } });
  const ids = users.map((u) => u.id);
  const audited = new Set(
    (await db.auditLog.findMany({ where: { actorId: { in: ids } }, select: { actorId: true }, distinct: ["actorId"] })).map((a) => a.actorId),
  );
  const removable = ids.filter((id) => !audited.has(id));

  const tips = await db.dailyTip.findMany({ where: { OR: [{ authorId: { in: ids } }, { text: { startsWith: "[yük testi]" } }] }, select: { id: true } });
  const tipIds = tips.map((t) => t.id);

  const counts = await db.$transaction([
    db.labAttempt.deleteMany({ where: { userId: { in: removable } } }),
    db.classroom.deleteMany({ where: { teacherId: { in: removable } } }),
    db.newsArticle.deleteMany({ where: { OR: [{ authorId: { in: removable } }, { slug: { startsWith: loadSlugPrefix } }] } }),
    db.tipDay.deleteMany({ where: { tipId: { in: tipIds } } }),
    db.dailyTip.deleteMany({ where: { id: { in: tipIds } } }),
    db.verification.deleteMany({ where: { identifier: { contains: `@${loadEmailDomain}` } } }),
    db.rateLimit.deleteMany({
      where: {
        OR: [
          ...loadIpPrefixes.map((prefix) => ({ key: { contains: `:${prefix}` } })),
          { key: { endsWith: `@${loadEmailDomain}` } },
          ...removable.map((id) => ({ key: { endsWith: `:${id.toLowerCase()}` } })),
        ],
      },
    }),
    db.user.deleteMany({ where: { id: { in: removable } } }),
  ]);
  const [attempts, classrooms, news, , tipRows, , limits, deleted] = counts.map((c) => c.count);
  return { users: deleted, attempts, classrooms, news, tips: tipRows, rateLimits: limits, keptForAudit: users.filter((u) => audited.has(u.id)).map((u) => u.email) };
}
