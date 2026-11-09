"use server";

// Öğrencinin sınıf eylemleri: sınıf koduyla katılma ve sınıftan ayrılma (ana sayfadaki kart,
// profil > Sınıf, /katil/[kod]). Her eylem oturumu ve hesabı veritabanından yeniden okur;
// tarayıcıdan gelen değerin türüne bile güvenilmez.
//
// Kod tahmin edilemesin: istek sınırı sınıf aranmadan önce sayılır (kullanıcı ve IP başına) ve
// yanlış kod, arşivlenen sınıf ya da öğretmenliği biten kişinin sınıfı aynı cevabı alır.

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { formatClock } from "@/lib/account/shared";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { format, getMessages } from "@/lib/i18n";
import { rateLimit, rateRules } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { getUser } from "@/lib/session";
import { isJoinCode, normalizeJoinCode } from "./rules";
import { classroomSelect, isTeacherRole, toStudentClass, type StudentClass } from "./student";

export type JoinErrorCode = "auth" | "unverified" | "format" | "not_found" | "member" | "own" | "rate_limited" | "generic";

export type JoinResult =
  | { status: "ok"; classroom: StudentClass; message: string }
  | { status: "error"; code: JoinErrorCode; message: string; retryAfterSec?: number };

export type LeaveResult = { status: "ok" | "error"; message: string };

const t = () => getMessages().studentClass;

const fail = (code: JoinErrorCode, message: string, retryAfterSec?: number): JoinResult => ({ status: "error", code, message, retryAfterSec });

/** Oturumdaki kişinin güncel hali; askıya alınmışsa yok sayılır. */
async function currentUser() {
  const sessionUser = await getUser();
  if (!sessionUser) return null;
  const row = await db.user.findUnique({ where: { id: sessionUser.id }, select: { id: true, emailVerified: true, suspended: true } });
  return row && !row.suspended ? row : null;
}

export async function joinClassroom(code: unknown): Promise<JoinResult> {
  const m = t();
  const user = await currentUser();
  if (!user) return fail("auth", m.errors.signIn);
  if (!user.emailVerified) return fail("unverified", m.verifyFirst);
  // Biçim denetimi veritabanına bakmaz; bu yüzden sınıra sayılmaz.
  const normalized = typeof code === "string" && code.length <= 32 ? normalizeJoinCode(code) : "";
  if (!isJoinCode(normalized)) return fail("format", m.errors.codeFormat);

  // Önce kullanıcı sınırı: sınırı dolan kişinin denemeleri okulun ortak IP sayacını yemesin.
  const ip = clientIp(await headers());
  for (const [rule, id] of [
    [rateRules.joinClassUser, user.id],
    [rateRules.joinClassIp, ip],
  ] as const) {
    const limit = await rateLimit.consume(rule, id);
    if (!limit.allowed) return fail("rate_limited", format(m.errors.tooMany, { time: formatClock(limit.retryAfterSec) }), limit.retryAfterSec);
  }

  const classroom = await db.classroom.findUnique({
    where: { joinCode: normalized },
    select: { ...classroomSelect, archived: true, teacherId: true, teacher: { select: { displayName: true, role: true, school: { select: { name: true } } } } },
  });
  if (!classroom || classroom.archived || !isTeacherRole(classroom.teacher.role)) return fail("not_found", m.errors.notFound);
  if (classroom.teacherId === user.id) return fail("own", m.errors.own);

  const info = toStudentClass(classroom);
  try {
    await db.classroomMembership.create({ data: { classroomId: classroom.id, userId: user.id } });
  } catch (error) {
    // Aynı anda iki istek (çift tıklama) ya da zaten üye.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("member", format(m.errors.member, { name: info.name }));
    }
    throw error;
  }
  // Sayfa yeniden çizilir: ödev kutusu dolar, "Sınıf arkadaşı" rozeti yazılır (getProgressSummary).
  refresh();
  return { status: "ok", classroom: info, message: format(m.joined, { name: info.name }) };
}

/** Yalnızca kendi üyeliğini siler; hesap, puan ve raporlar kalır. */
export async function leaveClassroom(classroomId: unknown): Promise<LeaveResult> {
  const m = t();
  const sessionUser = await getUser();
  if (!sessionUser) return { status: "error", message: m.errors.signIn };
  if (typeof classroomId !== "string" || classroomId.length === 0 || classroomId.length > 64) return { status: "error", message: m.errors.generic };
  const limit = await rateLimit.consume(rateRules.classroomActions, sessionUser.id);
  if (!limit.allowed) return { status: "error", message: format(m.errors.tooMany, { time: formatClock(limit.retryAfterSec) }) };

  await db.classroomMembership.deleteMany({ where: { classroomId, userId: sessionUser.id } });
  refresh();
  return { status: "ok", message: m.profile.left };
}
