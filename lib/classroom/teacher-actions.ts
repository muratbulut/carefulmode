"use server";

// Öğretmenin sınıf işleri (Sınıflarım, sınıf detayı): sınıf aç, sınıf kodunu yenile, ödev ver ya
// da son tarihini değiştir, ödevi bitir, öğrenciyi sınıftan çıkar ve tahtaya yansıtırken
// katılanları izle.
//
// Her eylem öğretmen erişimini (lib/teacher/access.ts) ve sınıfın sahibini veritabanından yeniden
// denetler; tarayıcıdan gelen kimliklere güvenilmez. Başkasının ya da arşivdeki sınıf
// "bulunamadı" döner, varlığı söylenmez. Değiştiren işler öğretmen başına istek sınırına sayılır.

import { refresh } from "next/cache";
import * as z from "@/lib/zod";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { getPublishedLabs } from "@/lib/lab/data";
import { rateLimit, rateRules } from "@/lib/rate-limit";
import { getTeacherAccess, type TeacherAccess } from "@/lib/teacher/access";
import { homeworkSelection } from "./homework";
import { classNameLimits, classNameOk, cleanClassName, generateJoinCode, isClassLevel } from "./rules";
import { findOwnedClassroom, joinQr } from "./teacher";
import { parseDueDate, shortName, type QrData } from "./teacher-rules";

export type TeacherActionError = "forbidden" | "notFound" | "invalid" | "dueDate" | "noLabs" | "noRooms" | "rateLimited" | "failed";

export type TeacherActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: TeacherActionError };

type Fail = { ok: false; error: TeacherActionError };

const fail = (error: TeacherActionError): Fail => ({ ok: false, error });
const failed = (value: TeacherAccess | Fail): value is Fail => "error" in value;

const id = z.string().min(1).max(64);

/** Değiştiren işlerden önce: öğretmen mi, istek sınırı dolmadı mı? */
async function teacherFor(mutation: boolean): Promise<TeacherAccess | Fail> {
  const access = await getTeacherAccess();
  if (!access) return fail("forbidden");
  if (mutation) {
    const limit = await rateLimit.consume(rateRules.classroomActions, access.userId);
    if (!limit.allowed) return fail("rateLimited");
  }
  return access;
}

/**
 * İşlem içinde sınıfın satırını kilitler (aynı sınıfa aynı anda gelen iki "ödev ver" iki açık
 * ödev bırakamasın) ve sahibini denetler. Sınıf bu öğretmenin değilse false.
 */
async function lockOwned(tx: Prisma.TransactionClient, classroomId: string, teacherId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Classroom"
    WHERE "id" = ${classroomId} AND "teacherId" = ${teacherId} AND "archived" = false
    FOR UPDATE`;
  return rows.length === 1;
}

// ---------------------------------------------------------------------------------------
// Sınıf aç
// ---------------------------------------------------------------------------------------

const createSchema = z.object({ name: z.string().max(classNameLimits.max * 4), level: z.string().max(16) });

export type CreatedClassroom = { id: string; name: string; code: string; qr: QrData };

export async function createClassroom(input: { name: string; level: string }): Promise<TeacherActionResult<{ classroom: CreatedClassroom }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success || !classNameOk(parsed.data.name) || !isClassLevel(parsed.data.level)) {
    return (await getTeacherAccess()) ? fail("invalid") : fail("forbidden");
  }
  const access = await teacherFor(true);
  if (failed(access)) return access;

  const name = cleanClassName(parsed.data.name);
  // Kod rastgeledir; nadiren başka sınıfın koduyla çakışırsa yeni kodla yeniden denenir.
  for (let attempt = 0; attempt < 5; attempt++) {
    const joinCode = generateJoinCode();
    try {
      const row = await db.classroom.create({
        data: { name, level: parsed.data.level, teacherId: access.userId, joinCode },
        select: { id: true, name: true, joinCode: true },
      });
      refresh();
      return { ok: true, classroom: { id: row.id, name: row.name, code: row.joinCode, qr: joinQr(row.joinCode) } };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      console.error("[sınıf] oluşturulamadı:", e);
      return fail("failed");
    }
  }
  return fail("failed");
}

// ---------------------------------------------------------------------------------------
// Sınıf kodunu yenile
// ---------------------------------------------------------------------------------------

/**
 * Sınıfa yeni bir kod verir (sabah soruları 14: kod istenmeyen kişilere ulaştıysa). Eski kod ve
 * onunla yapılmış davet bağlantısı ya da QR hemen çalışmaz olur; sınıftaki öğrenciler sınıfta kalır.
 */
export async function renewJoinCode(input: { classroomId: string }): Promise<TeacherActionResult<{ code: string }>> {
  const parsed = z.object({ classroomId: id }).safeParse(input);
  if (!parsed.success) return (await getTeacherAccess()) ? fail("invalid") : fail("forbidden");
  const access = await teacherFor(true);
  if (failed(access)) return access;
  const { classroomId } = parsed.data;

  const owned = await findOwnedClassroom(access.userId, classroomId);
  if (!owned) return fail("notFound");
  // Sınıf açarken olduğu gibi: kod başka sınıfınkiyle çakışırsa yeni kodla yeniden denenir.
  for (let attempt = 0; attempt < 5; attempt++) {
    const joinCode = generateJoinCode();
    if (joinCode === owned.joinCode) continue;
    try {
      const { count } = await db.classroom.updateMany({
        where: { id: classroomId, teacherId: access.userId, archived: false },
        data: { joinCode },
      });
      if (count === 0) return fail("notFound");
      refresh();
      return { ok: true, code: joinCode };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      console.error("[sınıf] kod yenilenemedi:", e);
      return fail("failed");
    }
  }
  return fail("failed");
}

// ---------------------------------------------------------------------------------------
// Ödev: ver, son tarihi değiştir, bitir
// ---------------------------------------------------------------------------------------

const homeworkSchema = z.object({ classroomId: id, neighborhoodId: id, labIds: z.array(id).max(200), due: z.string().max(16) });

/**
 * Mahallenin seçilen odalarını sınıfın ödevi yapar; seçilen odayı açan eğitimler kendiliğinden
 * eklenir (lib/classroom/homework.ts). Aynı anda tek ödev: açık ödev başka mahalledeyse kapanır
 * (geçmiş ödevlere geçer, ilerleme silinmez). Aynı mahalleyse odaları ve son tarihi değişir.
 */
export async function giveHomework(input: {
  classroomId: string;
  neighborhoodId: string;
  labIds: string[];
  due: string;
}): Promise<TeacherActionResult<{ result: "created" | "updated" }>> {
  const parsed = homeworkSchema.safeParse(input);
  if (!parsed.success) return (await getTeacherAccess()) ? fail("invalid") : fail("forbidden");
  const access = await teacherFor(true);
  if (failed(access)) return access;
  const { classroomId, neighborhoodId } = parsed.data;

  if (!(await findOwnedClassroom(access.userId, classroomId))) return fail("notFound");
  const due = parseDueDate(parsed.data.due, new Date());
  if (!due.ok) return fail("dueDate");
  // Mahallede yayında lab yoksa ödev verilemez (bitirilecek bir şey yok).
  const published = await getPublishedLabs();
  if (!published.some((lab) => lab.neighborhoodId === neighborhoodId)) return fail("noLabs");
  if (parsed.data.labIds.length === 0) return fail("noRooms");
  // Seçilen odalar bu mahallenin yayındaki odaları olmalı (sayfa açıkken biri yayından kalktıysa da).
  const labIds = homeworkSelection(neighborhoodId, parsed.data.labIds, published);
  if (!labIds) return fail("invalid");

  try {
    const result = await db.$transaction(async (tx) => {
      if (!(await lockOwned(tx, classroomId, access.userId))) return null;
      const open = await tx.assignment.findMany({
        where: { classroomId, closed: false },
        orderBy: { createdAt: "desc" },
        select: { id: true, neighborhoodId: true },
      });
      const [latest, ...older] = open;
      if (latest && latest.neighborhoodId === neighborhoodId) {
        await tx.assignment.update({ where: { id: latest.id }, data: { dueDate: due.date, labIds } });
        if (older.length > 0) await tx.assignment.updateMany({ where: { id: { in: older.map((a) => a.id) } }, data: { closed: true } });
        return "updated" as const;
      }
      await tx.assignment.updateMany({ where: { classroomId, closed: false }, data: { closed: true } });
      await tx.assignment.create({ data: { classroomId, neighborhoodId, labIds, dueDate: due.date } });
      return "created" as const;
    });
    if (!result) return fail("notFound");
    refresh();
    return { ok: true, result };
  } catch (e) {
    console.error("[sınıf] ödev verilemedi:", e);
    return fail("failed");
  }
}

/** Açık ödevi bitirir: geçmiş ödevlere geçer, kimsenin ilerlemesi silinmez. */
export async function endHomework(input: { classroomId: string }): Promise<TeacherActionResult> {
  const parsed = z.object({ classroomId: id }).safeParse(input);
  if (!parsed.success) return (await getTeacherAccess()) ? fail("invalid") : fail("forbidden");
  const access = await teacherFor(true);
  if (failed(access)) return access;
  const { classroomId } = parsed.data;

  try {
    const owned = await db.$transaction(async (tx) => {
      if (!(await lockOwned(tx, classroomId, access.userId))) return false;
      await tx.assignment.updateMany({ where: { classroomId, closed: false }, data: { closed: true } });
      return true;
    });
    if (!owned) return fail("notFound");
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[sınıf] ödev bitirilemedi:", e);
    return fail("failed");
  }
}

// ---------------------------------------------------------------------------------------
// Öğrenciyi sınıftan çıkar
// ---------------------------------------------------------------------------------------

/** Yalnızca üyelik silinir; öğrencinin hesabı ve ilerlemesi kalır, kodla yeniden katılabilir. */
export async function removeStudent(input: { classroomId: string; userId: string }): Promise<TeacherActionResult> {
  const parsed = z.object({ classroomId: id, userId: id }).safeParse(input);
  if (!parsed.success) return (await getTeacherAccess()) ? fail("invalid") : fail("forbidden");
  const access = await teacherFor(true);
  if (failed(access)) return access;
  const { classroomId, userId } = parsed.data;

  if (!(await findOwnedClassroom(access.userId, classroomId))) return fail("notFound");
  try {
    await db.classroomMembership.deleteMany({ where: { classroomId, userId } });
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[sınıf] öğrenci çıkarılamadı:", e);
    return fail("failed");
  }
}

// ---------------------------------------------------------------------------------------
// Tahtaya yansıt: katılanlar
// ---------------------------------------------------------------------------------------

/**
 * Tahta ekranı açıkken birkaç saniyede bir sorulur: ekran açıldıktan (`since`) sonra katılan
 * öğrencilerin adları. İlk çağrıda `since` boştur; veritabanının saati döner ve sonraki
 * çağrılar onu gönderir. Öğretmenin kendi sınıfının tahtasıdır; adlar kısaltılır ("Ayşe Y.").
 */
export async function projectionJoins(input: {
  classroomId: string;
  since: string | null;
}): Promise<TeacherActionResult<{ since: string; joined: { id: string; name: string }[] }>> {
  const parsed = z.object({ classroomId: id, since: z.string().max(40).nullable() }).safeParse(input);
  if (!parsed.success) return (await getTeacherAccess()) ? fail("invalid") : fail("forbidden");
  const access = await teacherFor(false);
  if (failed(access)) return access;
  const { classroomId } = parsed.data;

  if (!(await findOwnedClassroom(access.userId, classroomId))) return fail("notFound");
  const from = parsed.data.since ? new Date(parsed.data.since) : null;
  if (!from || Number.isNaN(from.getTime())) {
    const [{ now }] = await db.$queryRaw<{ now: Date }[]>`SELECT now() AS "now"`;
    return { ok: true, since: now.toISOString(), joined: [] };
  }
  const rows = await db.classroomMembership.findMany({
    where: { classroomId, joinedAt: { gt: from } },
    orderBy: { joinedAt: "asc" },
    take: 200,
    select: { userId: true, user: { select: { displayName: true } } },
  });
  return { ok: true, since: from.toISOString(), joined: rows.map((r) => ({ id: r.userId, name: shortName(r.user.displayName) })) };
}
