// Yönetim · Kullanıcılar sayfasının verisi (Kullanicilar-Son): sekme sayıları, öğrenci listesi,
// öğretmenler ve kurulum adımları, okullar, öğrencinin kısa profili ve "Öğretmenin gözünden".
// Kurallar saf modüllerde (users-model.ts, lib/school/bulletin-model.ts); burası veritabanından
// okur ve birleştirir. Yalnızca sunucuda; her çağıran yöneticiyi kendisi denetler.
//
// Gizlilik: öğrencinin e-postası ve tam adı buradan çıkmaz; ad "Ad S." olarak döner. Öğrencinin
// puanı, raporu, deneme sayısı ve hacklenmesi okunmaz ya da dönen veriye girmez. Öğretmenin
// sınıfları yalnızca toplamlarla döner; öğrenci kimlikleri yalnızca saymak için kullanılır.
// Sorgular toplu yapılır (öğretmen başına ayrı sorgu yok); ham SQL yalnızca parametreli.

import "server-only";
import type {
  AdminClass,
  AdminSchool,
  AdminTeacher,
  GazeView,
  SchoolsOverview,
  StudentPage,
  StudentProfile,
  TeacherPage,
  UsersCounts,
} from "@/components/admin/users/types";
import { auditTarget } from "@/lib/audit";
import { avatarOf } from "@/lib/avatars";
import { visibleClassroom } from "@/lib/classroom/student";
import { isClassLevel } from "@/lib/classroom/rules";
import { getTeacherClasses } from "@/lib/classroom/teacher";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { format, getMessages } from "@/lib/i18n";
import { getCity, getNeighborhoods, getPublishedLabs, type CityLab } from "@/lib/lab/data";
import { canRemind, isFresh, reminderCooldownMs, reminderKindOf, setupStep, signalOf, whenText, type SetupStep } from "@/lib/school/bulletin-model";
import { effectivePermissions } from "./access";
import { studentKeySql } from "./person-search";
import {
  activeDays,
  calendarCells,
  dateText,
  daysAgoText,
  funnelOf,
  homeworkPctOf,
  likePattern,
  matchesSchool,
  matchesTeacher,
  pageSizes,
  pageSlice,
  shortName,
  teacherHintOf,
  weeklyAverage,
} from "./users-model";

/** "Öğretmen" sayılan hesaplar: rolü öğretmen, ya da bir okulda öğretmenlik yapan yönetici (Okulum'la aynı). */
const teacherWhere = {
  OR: [{ role: "TEACHER" as const }, { role: "ADMIN" as const, schoolId: { not: null } }],
};

/** Sınıf düzeyinin adı: "7. sınıf", "Karma"; bilinmeyen kod boş (Okulum'la aynı). */
function levelText(level: string) {
  const t = getMessages().school;
  if (!isClassLevel(level)) return "";
  return level === "mixed" ? t.levelMixed : format(t.levelName, { n: level });
}

const placeOf = (school: { province: string; district: string }) => format(getMessages().school.place, school);

// ---------------------------------------------------------------------------------------
// Sayılar
// ---------------------------------------------------------------------------------------

export async function getUsersCounts(): Promise<UsersCounts> {
  const [people, students, teachers, team, schools, pending] = await Promise.all([
    // Anonimleştirilen hesap kişi sayılmaz (lib/cleanup.ts).
    db.user.count({ where: { role: { not: "DELETED" } } }),
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: teacherWhere }),
    db.user.count({ where: { OR: [{ role: "ADMIN" }, { teamPermissions: { some: {} } }] } }),
    db.school.count(),
    db.teacherApplication.count({ where: { status: "PENDING" } }),
  ]);
  return { people, students, teachers, team, schools, pending };
}

// ---------------------------------------------------------------------------------------
// Öğrenciler
// ---------------------------------------------------------------------------------------

/** Öğrencinin görünür sınıfları (arşivde olmayan, öğretmeni hâlâ öğretmen): lib/classroom/student.ts ile aynı kural. */
const visibleMembershipSql = Prisma.sql`
  FROM "ClassroomMembership" m
  JOIN "Classroom" cl ON cl."id" = m."classroomId"
  JOIN "User" tu ON tu."id" = cl."teacherId"
  WHERE m."userId" = u."id" AND cl."archived" = false AND tu."role" IN ('TEACHER', 'ADMIN')`;

type StudentSqlRow = {
  id: string;
  displayName: string;
  avatar: string | null;
  createdAt: Date;
  className: string | null;
  teacherName: string | null;
  labs: number;
  lastSeen: Date | null;
};

/**
 * Öğrenci listesinin bir sayfası: en yeni üye önce. Arama adda (ilk ad ve soyadın baş harfi),
 * sınıf adında ve öğretmen adında yapılır. Bitirdiği lab sayısı yayındaki lablardan sayılır
 * (yol haritasıyla aynı kural: eğitimde son kart, senaryoda biten deneme).
 */
export async function getStudentPage(input: { search: string; page: number }, now: Date): Promise<StudentPage> {
  const labIds = (await getPublishedLabs()).map((lab) => lab.id);
  const search = input.search.trim();
  const pattern = search ? likePattern(search) : null;
  const where = pattern
    ? Prisma.sql`u."role" = 'STUDENT' AND (
        ${studentKeySql} LIKE ${pattern}
        OR EXISTS (SELECT 1 ${visibleMembershipSql}
          AND (translate(lower(cl."name"), 'ı', 'i') LIKE ${pattern} OR translate(lower(tu."displayName"), 'ı', 'i') LIKE ${pattern}))
      )`
    : Prisma.sql`u."role" = 'STUDENT'`;

  const [{ total }] = await db.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS "total" FROM "User" u WHERE ${where}`;
  const size = pageSizes.students;
  const slice = pageSlice(total, input.page, size);

  const rows = await db.$queryRaw<StudentSqlRow[]>`
    SELECT u."id", u."displayName", u."avatar", u."createdAt",
      c."name" AS "className", t."displayName" AS "teacherName",
      (SELECT count(*)::int FROM (
        SELECT tp."labId" FROM "TrainingProgress" tp
          WHERE tp."userId" = u."id" AND tp."completedAt" IS NOT NULL AND tp."labId" = ANY(${labIds}::text[])
        UNION
        SELECT a."labId" FROM "LabAttempt" a
          WHERE a."userId" = u."id" AND a."status" IN ('COMPLETED', 'HACKED') AND a."labId" = ANY(${labIds}::text[])
      ) d) AS "labs",
      (SELECT max(s."createdAt") FROM "Session" s WHERE s."userId" = u."id") AS "lastSeen"
    FROM "User" u
    LEFT JOIN LATERAL (
      SELECT cl."name", cl."teacherId" ${visibleMembershipSql}
      ORDER BY m."joinedAt" ASC LIMIT 1
    ) c ON true
    LEFT JOIN "User" t ON t."id" = c."teacherId"
    WHERE ${where}
    ORDER BY u."createdAt" DESC, u."id" DESC
    LIMIT ${size} OFFSET ${slice.start}`;

  const t = getMessages().adminUsers.students;
  return {
    rows: rows.map((r) => ({
      id: r.id,
      name: shortName(r.displayName),
      avatar: avatarOf(r).emoji,
      classLabel: r.className !== null ? format(t.classLabel, { name: r.className, teacher: r.teacherName ?? "" }) : null,
      labs: r.labs,
      joined: dateText(r.createdAt, now),
      lastSeen: r.lastSeen ? daysAgoText(r.lastSeen, now) : null,
    })),
    total,
    page: slice.page,
    pages: slice.pages,
    from: slice.from,
    to: slice.to,
    search,
  };
}

// ---------------------------------------------------------------------------------------
// Öğretmenler
// ---------------------------------------------------------------------------------------

type ClassSqlRow = {
  id: string;
  name: string;
  level: string;
  teacherId: string;
  members: number;
  neighborhoodId: string | null;
  /** Ödevin odaları (boşsa mahallenin bütün odaları). */
  labIds: string[] | null;
  donePairs: number;
};

/**
 * Öğretmenlerin sınıfları tek sorguda: üye sayısı, ödev (açık olan; yoksa en son kapanan; Okulum'la
 * aynı) ve ödevin bitirilen (öğrenci × lab) çifti. Ödevin labları kayıtlı odalarının yayındakiler
 * (kayıtlı liste açan eğitimleri de içerir); oda seçimi olmayan eski ödevde mahallenin yayındaki
 * bütün labları.
 */
async function getClassFacts(teacherIds: string[]) {
  if (teacherIds.length === 0) return { rows: [] as ClassSqlRow[], students: new Map<string, number>() };
  const labs = await getPublishedLabs();
  const labIds = labs.map((lab) => lab.id);
  const labHoods = labs.map((lab) => lab.neighborhoodId);
  const [rows, students] = await Promise.all([
    db.$queryRaw<ClassSqlRow[]>`
      SELECT c."id", c."name", c."level", c."teacherId",
        (SELECT count(*)::int FROM "ClassroomMembership" m WHERE m."classroomId" = c."id") AS "members",
        a."neighborhoodId", a."labIds",
        CASE WHEN a."neighborhoodId" IS NULL THEN 0 ELSE (
          SELECT count(*)::int FROM "ClassroomMembership" m
          JOIN unnest(${labIds}::text[], ${labHoods}::text[]) AS l("labId", "hoodId") ON l."hoodId" = a."neighborhoodId"
            AND (cardinality(a."labIds") = 0 OR l."labId" = ANY(a."labIds"))
          WHERE m."classroomId" = c."id" AND (
            EXISTS (SELECT 1 FROM "TrainingProgress" tp WHERE tp."userId" = m."userId" AND tp."labId" = l."labId" AND tp."completedAt" IS NOT NULL)
            OR EXISTS (SELECT 1 FROM "LabAttempt" la WHERE la."userId" = m."userId" AND la."labId" = l."labId" AND la."status" IN ('COMPLETED', 'HACKED'))
          )
        ) END AS "donePairs"
      FROM "Classroom" c
      LEFT JOIN LATERAL (
        SELECT x."neighborhoodId", x."labIds" FROM "Assignment" x WHERE x."classroomId" = c."id"
        ORDER BY x."closed" ASC, x."createdAt" DESC LIMIT 1
      ) a ON true
      WHERE c."teacherId" = ANY(${teacherIds}::text[]) AND c."archived" = false
      ORDER BY c."createdAt" ASC, c."id" ASC`,
    db.$queryRaw<{ teacherId: string; students: number }[]>`
      SELECT c."teacherId", count(DISTINCT m."userId")::int AS "students"
      FROM "ClassroomMembership" m JOIN "Classroom" c ON c."id" = m."classroomId"
      WHERE c."teacherId" = ANY(${teacherIds}::text[]) AND c."archived" = false
      GROUP BY c."teacherId"`,
  ]);
  return { rows, students: new Map(students.map((s) => [s.teacherId, s.students])) };
}

/**
 * Öğretmenler (rolü öğretmen olanlar ve okulu olan yöneticiler): okul, branş, onay, son giriş,
 * sınıfların toplamları, kurulum adımı ve işareti, "Hatırlat". Yalnızca istenenler okunur:
 * kimlikleri (`ids`) ya da okulları (`schoolIds`) verilen öğretmenler. Ad sırasıyla döner.
 */
export async function getAdminTeachers(now: Date, viewerId: string, only: { ids?: string[]; schoolIds?: string[] }): Promise<AdminTeacher[]> {
  if (!only.ids?.length && !only.schoolIds?.length) return [];
  const users = await db.user.findMany({
    where: {
      AND: [teacherWhere, only.ids?.length ? { id: { in: only.ids } } : {}, only.schoolIds?.length ? { schoolId: { in: only.schoolIds } } : {}],
    },
    select: {
      id: true,
      displayName: true,
      avatar: true,
      email: true,
      role: true,
      school: { select: { id: true, name: true, province: true, district: true } },
      coordinatedSchool: { select: { name: true } },
      teacherApplications: {
        where: { status: "APPROVED" },
        orderBy: { decidedAt: "desc" },
        take: 1,
        select: { subject: true, decidedAt: true, decidedBy: { select: { displayName: true } } },
      },
      sessions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  if (users.length === 0) return [];

  const teacherIds = users.map((u) => u.id);
  const [facts, neighborhoods, labs, reminded] = await Promise.all([
    getClassFacts(teacherIds),
    getNeighborhoods(),
    getPublishedLabs(),
    db.auditLog.findMany({
      where: {
        action: "teacher.reminded",
        target: { in: teacherIds.map((id) => auditTarget.user(id)) },
        createdAt: { gte: new Date(now.getTime() - reminderCooldownMs) },
      },
      select: { target: true },
    }),
  ]);
  const neighborhoodOf = new Map(neighborhoods.map((n) => [n.id, n]));
  const labCount = new Map<string, number>();
  for (const lab of labs) labCount.set(lab.neighborhoodId, (labCount.get(lab.neighborhoodId) ?? 0) + 1);
  const remindedTargets = new Set(reminded.map((r) => r.target));

  const classesOf = new Map<string, { view: AdminClass; setup: { members: number; hasAssignment: boolean; pct: number | null } }[]>();
  for (const row of facts.rows) {
    const hasAssignment = row.neighborhoodId !== null;
    const total = !hasAssignment
      ? 0
      : row.labIds && row.labIds.length > 0
        ? labs.filter((lab) => lab.neighborhoodId === row.neighborhoodId && row.labIds!.includes(lab.id)).length
        : (labCount.get(row.neighborhoodId!) ?? 0);
    const pct = hasAssignment ? homeworkPctOf(row.donePairs, row.members, total) : null;
    const neighborhood = hasAssignment ? neighborhoodOf.get(row.neighborhoodId!) : undefined;
    const list = classesOf.get(row.teacherId) ?? [];
    list.push({
      view: {
        id: row.id,
        name: row.name,
        level: levelText(row.level),
        members: row.members,
        topic: neighborhood ? { name: neighborhood.name, color: neighborhood.color } : null,
        pct,
      },
      setup: { members: row.members, hasAssignment, pct },
    });
    classesOf.set(row.teacherId, list);
  }

  return users
    .map((u): AdminTeacher => {
      const classes = classesOf.get(u.id) ?? [];
      const application = u.teacherApplications[0];
      const approvedAt = application?.decidedAt ?? null;
      const step: SetupStep = setupStep(classes.map((c) => c.setup));
      const fresh = isFresh(approvedAt, now);
      const me = u.id === viewerId;
      return {
        id: u.id,
        name: u.displayName,
        avatar: avatarOf(u).emoji,
        email: u.email,
        subject: application?.subject ?? "",
        isAdmin: u.role === "ADMIN",
        school: u.school ? { id: u.school.id, name: u.school.name, place: placeOf(u.school) } : null,
        coordinatorOf: u.coordinatedSchool?.name ?? null,
        approved: approvedAt
          ? { date: dateText(approvedAt, now), by: application?.decidedBy ? shortName(application.decidedBy.displayName) : null }
          : null,
        lastSeen: u.sessions[0] ? whenText(u.sessions[0].createdAt, now) : null,
        step,
        signal: signalOf(step, fresh),
        hint: teacherHintOf(step, fresh, approvedAt, now),
        remind: canRemind({ step, fresh, isMe: me }) ? reminderKindOf(step) : null,
        reminded: remindedTargets.has(auditTarget.user(u.id)),
        me,
        classes: classes.map((c) => c.view),
        students: facts.students.get(u.id) ?? 0,
      };
    })
    .sort(byName);
}

/** Öğretmenler ad sırasıyla (Türkçe); aynı adda kimlik sırası, sayfalar kaymasın diye. */
function byName(a: { name: string; id: string }, b: { name: string; id: string }) {
  return a.name.localeCompare(b.name, "tr") || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Öğretmenler sekmesinin bir sayfası. Arama ad, okul ya da branşta yapılır; bütün öğretmenlerin
 * yalnızca bu üç alanı okunur, ağır kısım (sınıflar, kurulum) yalnızca sayfadakiler için.
 */
export async function getTeacherPage(input: { search: string; page: number }, now: Date, viewerId: string): Promise<TeacherPage> {
  const search = input.search.trim();
  const all = await db.user.findMany({
    where: teacherWhere,
    select: {
      id: true,
      displayName: true,
      school: { select: { name: true } },
      teacherApplications: { where: { status: "APPROVED" }, orderBy: { decidedAt: "desc" }, take: 1, select: { subject: true } },
    },
  });
  const matched = all
    .filter((u) => matchesTeacher(search, { name: u.displayName, school: u.school?.name ?? null, subject: u.teacherApplications[0]?.subject ?? "" }))
    .map((u) => ({ id: u.id, name: u.displayName }))
    .sort(byName);
  const size = pageSizes.teachers;
  const slice = pageSlice(matched.length, input.page, size);
  const ids = matched.slice(slice.start, slice.start + size).map((u) => u.id);
  return {
    rows: await getAdminTeachers(now, viewerId, { ids }),
    total: matched.length,
    page: slice.page,
    pages: slice.pages,
    from: slice.from,
    to: slice.to,
    search,
  };
}

// ---------------------------------------------------------------------------------------
// Okullar
// ---------------------------------------------------------------------------------------

/**
 * Okullar görünümü: bütün okulların toplamları (okul, okullu öğretmen, bekleyen talep, sınıflardaki
 * öğrenci) ve aramaya (ad, il, ilçe) uyan okulların bir sayfası: sorumlusu, bekleyen talebi,
 * sınıflarındaki öğrenci, öğretmenleri ve kurulum hunisi. Öğretmenler yalnızca sayfadaki okullar
 * için okunur.
 */
export async function getSchoolsOverview(input: { search: string; page: number }, now: Date, viewerId: string): Promise<SchoolsOverview> {
  const search = input.search.trim();
  const [schools, pendingRows, pendingNoSchool, teachersInSchools, studentTotal] = await Promise.all([
    db.school.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        province: true,
        district: true,
        coordinatorApproves: true,
        coordinator: { select: { id: true, displayName: true, role: true, schoolId: true } },
      },
    }),
    db.teacherApplication.groupBy({ by: ["schoolId"], where: { status: "PENDING", schoolId: { not: null } }, _count: { _all: true } }),
    db.teacherApplication.count({ where: { status: "PENDING", schoolId: null } }),
    db.user.count({ where: { AND: [teacherWhere, { schoolId: { not: null } }] } }),
    db.$queryRaw<{ students: number }[]>`
      SELECT count(DISTINCT m."userId")::int AS "students"
      FROM "ClassroomMembership" m
      JOIN "Classroom" c ON c."id" = m."classroomId"
      JOIN "User" tu ON tu."id" = c."teacherId"
      WHERE c."archived" = false AND tu."schoolId" IS NOT NULL AND tu."role" IN ('TEACHER', 'ADMIN')`,
  ]);

  // Veritabanının sıralaması harmanlamaya bağlı; ekrandaki sıra Türkçe kuralla.
  const matched = schools
    .filter((s) => matchesSchool(search, s))
    .sort((a, b) => a.name.localeCompare(b.name, "tr") || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const size = pageSizes.schools;
  const slice = pageSlice(matched.length, input.page, size);
  const shown = matched.slice(slice.start, slice.start + size);
  const shownIds = shown.map((s) => s.id);

  const [teachers, studentRows] = await Promise.all([
    getAdminTeachers(now, viewerId, { schoolIds: shownIds }),
    shownIds.length === 0
      ? Promise.resolve([])
      : db.$queryRaw<{ schoolId: string; students: number }[]>`
          SELECT tu."schoolId", count(DISTINCT m."userId")::int AS "students"
          FROM "ClassroomMembership" m
          JOIN "Classroom" c ON c."id" = m."classroomId"
          JOIN "User" tu ON tu."id" = c."teacherId"
          WHERE c."archived" = false AND tu."schoolId" = ANY(${shownIds}::text[]) AND tu."role" IN ('TEACHER', 'ADMIN')
          GROUP BY tu."schoolId"`,
  ]);
  const pendingOf = new Map(pendingRows.map((r) => [r.schoolId, r._count._all]));
  const studentsOf = new Map(studentRows.map((r) => [r.schoolId, r.students]));

  const list: AdminSchool[] = shown.map((s) => {
    const own = teachers.filter((t) => t.school?.id === s.id);
    const coordinator = s.coordinator;
    return {
      id: s.id,
      name: s.name,
      place: placeOf(s),
      coordinator: coordinator
        ? {
            id: coordinator.id,
            name: coordinator.displayName,
            isTeacher: coordinator.schoolId === s.id && (coordinator.role === "TEACHER" || coordinator.role === "ADMIN"),
          }
        : null,
      coordinatorApproves: s.coordinatorApproves,
      pending: pendingOf.get(s.id) ?? 0,
      students: studentsOf.get(s.id) ?? 0,
      teacherIds: own.map((t) => t.id),
      funnel: funnelOf(own.map((t) => t.step)),
    };
  });

  const pending = pendingRows.reduce((sum, r) => sum + r._count._all, 0) + pendingNoSchool;
  return {
    schools: list,
    teachers,
    summary: { schools: schools.length, teachers: teachersInSchools, pending, students: studentTotal[0]?.students ?? 0 },
    pendingNoSchool,
    total: matched.length,
    page: slice.page,
    pages: slice.pages,
    from: slice.from,
    to: slice.to,
    search,
  };
}

// ---------------------------------------------------------------------------------------
// Öğrencinin kısa profili
// ---------------------------------------------------------------------------------------

/**
 * Öğrencinin kısa profili (Kullanicilar-Son-Ogrenci): "Ad S.", sınıfı, bitirdiği lablar ve
 * tarihleri, son aktiflik, haftada ortalama, son 4 haftanın takvimi, mahalleler. Puan, rapor,
 * deneme sayısı, hacklenme ve e-posta yok. Öğrenci değilse (öğretmen, yönetici) null.
 */
export async function getStudentProfile(studentId: string, now: Date): Promise<StudentProfile | null> {
  const user = await db.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      displayName: true,
      avatar: true,
      role: true,
      birthYear: true,
      createdAt: true,
      teamPermissions: { select: { permission: true } },
      classroomMemberships: {
        where: { classroom: visibleClassroom },
        orderBy: { joinedAt: "asc" },
        select: { classroom: { select: { name: true, teacher: { select: { displayName: true, school: { select: { name: true } } } } } } },
      },
      sessions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  if (!user || user.role !== "STUDENT") return null;

  const t = getMessages().adminUsers.profile;
  const city = await getCity(user.id);
  const items = city.flatMap((d) => d.route.map((item) => ({ item, district: d })));
  const finished = items
    .filter(({ item }) => item.state === "done" && item.progress.doneAt)
    .sort((a, b) => b.item.progress.doneAt!.getTime() - a.item.progress.doneAt!.getTime());
  const touched = (item: CityLab) => item.progress.touchedAt?.getTime() ?? 0;
  const current = items
    .filter(({ item }) => item.state !== "done" && (item.progress.inProgress !== null || (item.progress.cardIndex ?? 0) > 0))
    .sort((a, b) => touched(b.item) - touched(a.item))[0];

  const lastLab = Math.max(0, ...items.map(({ item }) => touched(item)));
  const lastSession = user.sessions[0]?.createdAt.getTime() ?? 0;
  const lastActive = Math.max(lastLab, lastSession);
  const cells = calendarCells(
    finished.map(({ item }) => item.progress.doneAt!),
    user.createdAt,
    now,
  );
  const first = user.classroomMemberships[0]?.classroom;
  const permissions = effectivePermissions({ role: user.role, birthYear: user.birthYear }, user.teamPermissions.map((p) => p.permission));

  return {
    id: user.id,
    name: shortName(user.displayName),
    avatar: avatarOf(user).emoji,
    classLine: first
      ? first.teacher.school
        ? format(t.classLineSchool, { name: first.name, teacher: first.teacher.displayName, school: first.teacher.school.name })
        : format(t.classLine, { name: first.name, teacher: first.teacher.displayName })
      : null,
    moreClasses: Math.max(0, user.classroomMemberships.length - 1),
    team: permissions.length > 0 ? permissions.map((p) => t.permissions[p]) : null,
    labs: finished.length,
    lastActive: lastActive > 0 ? daysAgoText(new Date(lastActive), now) : null,
    weekly: weeklyAverage(finished.length, user.createdAt, now),
    joined: dateText(user.createdAt, now),
    cells,
    activeDays: activeDays(cells),
    current: current ? { name: current.item.lab.meta.name, neighborhood: current.district.name, color: current.district.color } : null,
    // Henüz yayında labı olmayan mahalle ("0/0") yazılmaz.
    neighborhoods: city.filter((d) => d.total > 0).map((d) => ({ id: d.id, name: d.name, color: d.color, done: d.doneCount, total: d.total })),
    finished: finished.map(({ item, district }) => ({
      id: item.lab.id,
      name: item.lab.meta.name,
      neighborhood: district.name,
      color: district.color,
      training: item.lab.type === "TRAINING",
      when: daysAgoText(item.progress.doneAt!, now),
    })),
  };
}

// ---------------------------------------------------------------------------------------
// Öğretmenin gözünden
// ---------------------------------------------------------------------------------------

/**
 * Öğretmenin Sınıflarım ekranının verisi, salt okunur bakış için. Öğretmenin kendi ekranıyla aynı
 * hesap (getTeacherClasses); sınıf kodu, QR ve davet adresi bakışa gitmez. Öğretmen değilse null.
 */
export async function getTeacherGaze(teacherId: string): Promise<GazeView | null> {
  const user = await db.user.findFirst({ where: { AND: [teacherWhere, { id: teacherId }] }, select: { id: true, displayName: true } });
  if (!user) return null;
  const data = await getTeacherClasses(user.id);
  return {
    teacherId: user.id,
    name: user.displayName,
    firstName: user.displayName.trim().split(/\s+/)[0] ?? user.displayName,
    summary: data.summary,
    classes: data.classes.map((card) => ({
      id: card.id,
      name: card.name,
      level: card.level,
      students: card.students,
      isNew: card.isNew,
      homework: card.homework,
      week: card.week,
      last: card.last,
    })),
    attention: data.attention,
  };
}
