// Öğrencinin sınıfları: profil > Sınıf, ana sayfadaki sınıf kartı ve öğretmeninin verdiği ödev.
//
// Gizlilik: öğrenci yalnızca kendi üyeliklerini görür (sınıfın adı, öğretmeni, öğretmenin
// okulu ve açık ödev). Sınıftaki diğer öğrenciler, sayıları ve kimin bitirdiği buradan çıkmaz.
// Arşivlenen sınıf ve öğretmenliği biten kişinin sınıfı öğrenciye görünmez; katılma eylemi de
// aynı kuralı kullanır (visibleClassroom). Yalnızca sunucuda.

import "server-only";
import { dayMonth } from "@/lib/account/dates";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { format, getMessages } from "@/lib/i18n";
import type { GateLab } from "@/lib/lab/gates";
import { labHref, routeOf, type DistrictView } from "@/lib/lab/route";
import { homeworkLabs } from "./homework";
import { siteTimeZone } from "@/lib/site";

/** Öğrenciye görünen sınıf: arşivde değil, öğretmeni hâlâ öğretmen (ya da yönetici). */
export const visibleClassroom = {
  archived: false,
  teacher: { role: { in: ["TEACHER", "ADMIN"] } },
} satisfies Prisma.ClassroomWhereInput;

export const isTeacherRole = (role: string) => role === "TEACHER" || role === "ADMIN";

/** Öğrencinin sınıfı. Kimlik "Sınıftan ayrıl" için gider; sınıf kodu ve üye listesi gitmez. */
export type StudentClass = { id: string; name: string; teacher: string; school: string | null };

export type ClassroomRow = { id: string; name: string; teacher: { displayName: string; school: { name: string } | null } };

export const classroomSelect = {
  id: true,
  name: true,
  teacher: { select: { displayName: true, school: { select: { name: true } } } },
} as const satisfies Prisma.ClassroomSelect;

export function toStudentClass(row: ClassroomRow): StudentClass {
  return { id: row.id, name: row.name, teacher: row.teacher.displayName, school: row.teacher.school?.name ?? null };
}

/** Açık ödev (kapatılmamış), sınıfıyla birlikte. */
export type OpenAssignment = {
  id: string;
  classroomId: string;
  neighborhoodId: string;
  /** Öğretmenin seçtiği odalar (açan eğitimlerle); boşsa bütün mahalle (lib/classroom/homework.ts). */
  labIds: string[];
  dueDate: Date | null;
  createdAt: Date;
};

/** Profil > Sınıf: katıldığı sınıflar (ilk katıldığı önce). */
export async function getClassroomSection(userId: string): Promise<{ classes: StudentClass[] }> {
  const rows = await db.classroomMembership.findMany({
    where: { userId, classroom: visibleClassroom },
    orderBy: { joinedAt: "asc" },
    select: { classroom: { select: classroomSelect } },
  });
  return { classes: rows.map((r) => toStudentClass(r.classroom)) };
}

/** Ana sayfa: sınıflar ve o sınıfların açık ödevleri. */
export async function getHomeClasses(userId: string): Promise<{ classes: StudentClass[]; assignments: OpenAssignment[] }> {
  const rows = await db.classroomMembership.findMany({
    where: { userId, classroom: visibleClassroom },
    orderBy: { joinedAt: "asc" },
    select: {
      classroom: {
        select: {
          ...classroomSelect,
          assignments: {
            where: { closed: false },
            orderBy: { createdAt: "desc" },
            select: { id: true, neighborhoodId: true, labIds: true, dueDate: true, createdAt: true },
          },
        },
      },
    },
  });
  return {
    classes: rows.map((r) => toStudentClass(r.classroom)),
    assignments: rows.flatMap((r) => r.classroom.assignments.map((a) => ({ ...a, classroomId: r.classroom.id }))),
  };
}

// ---------------------------------------------------------------------------------------
// Ana sayfadaki ödev kutusu (saf hesap; birim testinde sınanır)
// ---------------------------------------------------------------------------------------

/** Ödev kutusunun tarayıcıya giden hali. Metinler (tarih) sunucuda Türkiye saatiyle hazırlanır. */
export type AssignmentView = {
  id: string;
  classroom: { name: string; teacher: string };
  district: { slug: string; name: string; color: string };
  /** Ödevin odaları (öğretmenin seçtikleri ve onları açan eğitimler); bitenler ve toplam. */
  done: number;
  total: number;
  /** "17 Ekim'e kadar" ya da "Son tarih geçti (17 Ekim)"; son tarih yoksa null. */
  due: string | null;
  overdue: boolean;
  finished: boolean;
  /** Ödevde sıradaki açık oda ve düğmenin metni; bittiyse ya da açık oda yoksa null. */
  next: { name: string; href: string; label: string } | null;
};

/** Takvim günü, Türkiye saatiyle: karşılaştırma anahtarı ("2026-10-17"), gün ve ay. */
export function calendarDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: siteTimeZone, day: "numeric", month: "numeric", year: "numeric" }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const [day, month, year] = [get("day"), get("month"), get("year")];
  return { day, month: month - 1, key: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

/** "17 Ekim'e kadar" */
export function dueBy(date: Date) {
  const t = getMessages().studentClass.assignment;
  const { day, month } = calendarDay(date);
  return format(t.dueBy, { date: `${day} ${t.monthsTo[month]}` });
}

/**
 * Son tarih o günün sonuna kadar sürer: tarih geçmiş sayılması için bugün (Türkiye saatiyle)
 * son tarihten sonraki bir gün olmalı. Öğretmen günü nasıl kaydederse kaydetsin (00.00, 23.59)
 * sonuç aynıdır.
 */
export function isOverdue(dueDate: Date, now: Date) {
  return calendarDay(now).key > calendarDay(dueDate).key;
}

/**
 * Ana sayfadaki ödevler, en acil olan önce: bitmemişler bitenlerden önce; bitmemişler arasında
 * son tarihi en yakın (geçmiş olan en başta), son tarihsizler en sonda ve yeniden eskiye.
 */
export function assignmentViews(
  assignments: OpenAssignment[],
  classes: StudentClass[],
  districts: DistrictView[],
  neighborhoods: { id: string; slug: string }[],
  /** Yayındaki lablar: ödevin odaları bunlardan seçilir. */
  labs: readonly (GateLab & { slug: string })[],
  now: Date,
): AssignmentView[] {
  const t = getMessages().studentClass.assignment;
  const slugOf = new Map(neighborhoods.map((n) => [n.id, n.slug]));
  const classOf = new Map(classes.map((c) => [c.id, c]));

  const views = assignments.flatMap((a) => {
    const district = districts.find((d) => d.slug === slugOf.get(a.neighborhoodId));
    const classroom = classOf.get(a.classroomId);
    if (!district || !classroom) return [];
    const slugs = new Set(homeworkLabs(a, labs).map((lab) => lab.slug));
    const route = routeOf(district).filter((l) => slugs.has(l.slug));
    const done = route.filter((l) => l.state === "done").length;
    const finished = route.length > 0 && done >= route.length;
    const overdue = !finished && a.dueDate !== null && isOverdue(a.dueDate, now);
    // Sıradaki: ödevde bitmemiş ilk açık oda (mahallenin "sıradaki"si ödevde değilse onu atlar).
    const lab = finished ? null : (route.find((l) => l.state === "next" || l.state === "open") ?? null);
    const label = !lab ? "" : lab.inProgress ? t.resume : done === 0 ? t.start : t.next;
    const view: AssignmentView = {
      id: a.id,
      classroom: { name: classroom.name, teacher: classroom.teacher },
      district: { slug: district.slug, name: district.name, color: district.color },
      done,
      total: route.length,
      due: a.dueDate ? (overdue ? format(t.overdue, { date: dayMonth(a.dueDate) }) : dueBy(a.dueDate)) : null,
      overdue,
      finished,
      next: lab ? { name: lab.name, href: labHref(lab), label: format(label, { name: lab.name }) } : null,
    };
    return [{ view, due: a.dueDate?.getTime() ?? null, created: a.createdAt.getTime() }];
  });

  return views
    .sort((x, y) => {
      if (x.view.finished !== y.view.finished) return x.view.finished ? 1 : -1;
      if (x.due !== null && y.due !== null && x.due !== y.due) return x.due - y.due;
      if ((x.due === null) !== (y.due === null)) return x.due === null ? 1 : -1;
      return y.created - x.created;
    })
    .map((x) => x.view);
}
