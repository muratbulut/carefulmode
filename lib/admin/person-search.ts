// Yönetimdeki kişi aramalarının (ekibe ekle, okul sorumlusu) öğrenci kuralı. Öğrenci hesabının
// (18 yaşından küçük olabilecek öğrenci; access.ts isStudentAccount) tam soyadı ve e-postası
// yönetimde görünmez; arama da bunları açığa çıkarmamalı: öğrenci hesabı yalnızca görünen adıyla
// ("ayşe y.") ya da e-postasının tamamıyla bulunur. Soyadı ya da e-postanın bir parçası yazılınca
// çıkmaz (güvenlik turu 4). Görünen ad ve e-posta users-model.ts personShown ile kurulur.
// Yalnızca sunucuda; SQL'ler parametreli.

import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { minorBirthYearFloor } from "./access";
import { likePattern } from "./users-model";

/**
 * Öğrencinin aramada görünen adı, SQL'de: "ayşe y." (adı ve soyadının baş harfi, küçük harf,
 * ı → i). Soyadın kendisi aranmaz; böylece arama soyadını açığa çıkarmaz (shortName ile aynı).
 * Sorguda kullanıcı tablosunun takma adı `u` olmalı.
 */
export const studentKeySql = Prisma.sql`translate(lower(
  split_part(btrim(u."displayName"), ' ', 1) ||
  CASE WHEN position(' ' in btrim(u."displayName")) > 0
    THEN ' ' || left(substring(btrim(u."displayName") from '([^ ]+)$'), 1) || '.'
    ELSE '' END
), 'ı', 'i')`;

/** Öğrenci hesabı (isStudentAccount) Prisma süzgeci olarak. */
export function studentAccountWhere(now = new Date()): Prisma.UserWhereInput {
  return { role: "STUDENT", OR: [{ birthYear: null }, { birthYear: { gte: minorBirthYearFloor(now) } }] };
}

/**
 * Aramanın metin koşulu: öğrenci hesabı olmayanlar adda ya da e-postada geçen metinle, öğrenci
 * hesapları yalnızca görünen adıyla ya da e-postasının tamamıyla (studentIdsMatching). `query`
 * LIKE jokerlerinden arındırılmış metindir (team-rules.ts cleanQuery).
 */
export async function personMatchWhere(query: string, typedEmail: string, options: { notInTeam?: boolean } = {}): Promise<Prisma.UserWhereInput> {
  const now = new Date();
  const students = await studentIdsMatching(query, typedEmail, now, options);
  return {
    OR: [
      { NOT: studentAccountWhere(now), OR: [{ displayName: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] },
      { id: { in: students } },
    ],
  };
}

/** Bir aramada en fazla bu kadar öğrenci adayı okunur (sonuç zaten 8 kişi; fazlası için daha çok yazılır). */
const studentMatchLimit = 50;

/**
 * Aramayla eşleşen, girebilen (doğrulanmış, askıda değil, silinmeyi beklemiyor) öğrenci
 * hesaplarının kimlikleri, ad sırasıyla. Eşleşme: görünen adda geçen metin ya da e-postanın
 * tamamı. `notInTeam`: ekipte olanlar (izin satırı olan) çıkmaz.
 */
async function studentIdsMatching(query: string, typedEmail: string, now: Date, options: { notInTeam?: boolean }): Promise<string[]> {
  const pattern = likePattern(query);
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT u."id" FROM "User" u
    WHERE u."role" = 'STUDENT' AND (u."birthYear" IS NULL OR u."birthYear" >= ${minorBirthYearFloor(now)})
      AND u."emailVerified" = true AND u."suspended" = false AND u."deletionScheduledAt" IS NULL
      ${options.notInTeam ? Prisma.sql`AND NOT EXISTS (SELECT 1 FROM "TeamPermission" p WHERE p."userId" = u."id")` : Prisma.empty}
      AND (${studentKeySql} LIKE ${pattern} OR lower(u."email") = ${typedEmail})
    ORDER BY u."displayName" ASC, u."id" ASC
    LIMIT ${studentMatchLimit}`;
  return rows.map((row) => row.id);
}
