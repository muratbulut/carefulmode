// Okulum sayfasının verisi (O4 haftalık okul bülteni): okulun öğretmenleri ve kurulum adımları,
// sınıfların toplamı, haftalık lab sayıları, okuldan gelen talepler. Hesapların kuralları saf
// modülde (bulletin-model.ts); burası veritabanından okur ve birleştirir. Yalnızca sunucuda.
//
// Gizlilik (doküman Bölüm 3): sorumlu öğrenci adı, puanı, raporu görmez; yalnızca toplamlar.
// Öğrenci kimlikleri yalnızca saymak için okunur ve dönen veriye hiç girmez. Öğretmenin ve
// başvuranın e-postası, talepteki belge ve kurumsal e-posta adresi de dönmez ("var / yok" döner).

import "server-only";
import type { HandledRequest, SchoolClass, SchoolRequest, SchoolTeacher, SchoolView, TeacherHint } from "@/components/school/types";
import { mayBeMinor } from "@/lib/account/shared";
import { auditTarget } from "@/lib/audit";
import { avatarOf } from "@/lib/avatars";
import { homeworkLabs } from "@/lib/classroom/homework";
import { getMembersProgress, weekStart, type MemberLab } from "@/lib/classroom/progress";
import { isClassLevel } from "@/lib/classroom/rules";
import { db } from "@/lib/db";
import { format, getMessages } from "@/lib/i18n";
import { getNeighborhoods, getPublishedLabs } from "@/lib/lab/data";
import { paths } from "@/lib/navigation";
import { siteUrl } from "@/lib/site";
import * as model from "./bulletin-model";

const DAY = 24 * 60 * 60 * 1000;

/** Grafikteki hafta sayısı (bu hafta ve önceki 4). */
export const chartWeeks = 5;

export type TeacherFacts = {
  id: string;
  name: string;
  avatar: string;
  subject: string;
  approvedAt: Date | null;
  lastSignIn: Date | null;
  classes: SchoolClass[];
  students: number;
  step: model.SetupStep;
  fresh: boolean;
  signal: model.Signal;
};

/** Sınıf düzeyinin adı: "7. sınıf", "Karma"; bilinmeyen kod boş. */
function levelName(level: string) {
  const t = getMessages().school;
  if (!isClassLevel(level)) return "";
  return level === "mixed" ? t.levelMixed : format(t.levelName, { n: level });
}

function hintOf(step: model.SetupStep, fresh: boolean, approvedAt: Date | null, now: Date): TeacherHint {
  if (step === 5) return { kind: "good" };
  if (step === 4) return { kind: "assigned" };
  if (step === 3) return { kind: "joined" };
  if (step === 2) return { kind: "created", n: model.minStudentsJoined };
  if (fresh) return { kind: "fresh" };
  if (approvedAt) return { kind: "waitingDays", days: Math.floor((now.getTime() - approvedAt.getTime()) / DAY) };
  return { kind: "waiting" };
}

/**
 * Okulun öğretmenleri (okulu bu okul olan öğretmen ve yöneticiler), sınıfları ve haftalık lab
 * sayıları. Okulum sayfası ve "Hatırlat" eylemi aynı hesabı kullanır; hatırlatmanın türü
 * tarayıcının söylediğinden değil, buradan çıkar.
 */
export async function getSchoolFacts(schoolId: string, now: Date) {
  const teachers = await db.user.findMany({
    where: { schoolId, role: { in: ["TEACHER", "ADMIN"] } },
    select: {
      id: true,
      displayName: true,
      avatar: true,
      teacherApplications: {
        where: { status: "APPROVED" },
        orderBy: { decidedAt: "desc" },
        take: 1,
        select: { subject: true, decidedAt: true },
      },
      sessions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  const classrooms =
    teachers.length === 0
      ? []
      : await db.classroom.findMany({
          where: { teacherId: { in: teachers.map((t) => t.id) }, archived: false },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            level: true,
            teacherId: true,
            members: { select: { userId: true, joinedAt: true } },
            // Açık ödev; yoksa en son kapanan.
            assignments: { orderBy: [{ closed: "asc" }, { createdAt: "desc" }], take: 1, select: { neighborhoodId: true, labIds: true, dueDate: true, closed: true } },
          },
        });

  const memberIds = [...new Set(classrooms.flatMap((c) => c.members.map((m) => m.userId)))];
  const [progress, labs, neighborhoods] = await Promise.all([getMembersProgress(memberIds), getPublishedLabs(), getNeighborhoods()]);
  const week0 = weekStart(now);
  const starts = model.weekStarts(week0, chartWeeks);

  const neighborhoodOf = new Map(neighborhoods.map((n) => [n.id, n]));
  const noLabs = new Map<string, MemberLab>();
  const doneOf = (userId: string) => progress.get(userId)?.done ?? noLabs;
  const teacherName = new Map(teachers.map((t) => [t.id, t.displayName]));

  const classesOf = new Map<string, { view: SchoolClass; setup: model.ClassSetup; memberIds: string[] }[]>();
  for (const c of classrooms) {
    const assignment = c.assignments[0] ?? null;
    // Ödevin odaları: seçilenler ve onları açan eğitimler (öğretmen ekranıyla aynı hesap).
    const homework = assignment ? homeworkLabs(assignment, labs).map((lab) => lab.id) : [];
    const doneCounts = c.members.map((m) => homework.filter((labId) => doneOf(m.userId).has(labId)).length);
    const pct = assignment ? model.homeworkPct(doneCounts, homework.length) : null;
    const notStarted = doneCounts.filter((n) => n === 0).length;
    // Bu hafta biten lablar; öğrencinin bu sınıfa katılmadan önce bitirdikleri sayılmaz.
    const week = c.members.reduce(
      (sum, m) => sum + [...doneOf(m.userId).values()].filter((d) => d.doneAt >= week0 && d.doneAt >= m.joinedAt).length,
      0,
    );
    const neighborhood = assignment ? neighborhoodOf.get(assignment.neighborhoodId) : undefined;
    const view: SchoolClass = {
      id: c.id,
      name: c.name,
      level: levelName(c.level),
      members: c.members.length,
      teacher: teacherName.get(c.teacherId) ?? "",
      topic: neighborhood ? { name: neighborhood.name, color: neighborhood.color } : null,
      pct,
      week,
      due: assignment && !assignment.closed && assignment.dueDate ? model.dueText(assignment.dueDate) : null,
      attention:
        c.members.length === 0
          ? { kind: "noMembers" }
          : !assignment
            ? { kind: "noAssignment" }
            : !assignment.closed && notStarted > 0
              ? { kind: "notStarted", n: notStarted }
              : null,
    };
    const list = classesOf.get(c.teacherId) ?? [];
    list.push({ view, setup: { members: c.members.length, hasAssignment: !!assignment, pct }, memberIds: c.members.map((m) => m.userId) });
    classesOf.set(c.teacherId, list);
  }

  const teacherFacts: TeacherFacts[] = teachers.map((t) => {
    const classes = classesOf.get(t.id) ?? [];
    const approvedAt = t.teacherApplications[0]?.decidedAt ?? null;
    const step = model.setupStep(classes.map((c) => c.setup));
    const fresh = model.isFresh(approvedAt, now);
    return {
      id: t.id,
      name: t.displayName,
      avatar: avatarOf(t).emoji,
      subject: t.teacherApplications[0]?.subject ?? "",
      approvedAt,
      lastSignIn: t.sessions[0]?.createdAt ?? null,
      classes: classes.map((c) => c.view),
      students: new Set(classes.flatMap((c) => c.memberIds)).size,
      step,
      fresh,
      signal: model.signalOf(step, fresh),
    };
  });

  // Okulun haftalık lab sayısı: her öğrencinin, okulun bir sınıfına ilk katıldığı andan sonra
  // bitirdiği lablar (bir lab bir kez sayılır).
  const firstJoin = new Map<string, Date>();
  for (const c of classrooms) {
    for (const m of c.members) {
      const seen = firstJoin.get(m.userId);
      if (!seen || m.joinedAt < seen) firstJoin.set(m.userId, m.joinedAt);
    }
  }
  const doneDates = memberIds.flatMap((id) => [...doneOf(id).values()].map((d) => d.doneAt).filter((at) => at >= firstJoin.get(id)!));
  const weekly = model.countByWeek(doneDates, starts);

  return { teachers: teacherFacts, students: memberIds.length, starts, weekly, week0 };
}

/** Okulum sayfasının bütün verisi; okul yoksa ya da kişi okulun sorumlusu değilse null. */
export async function getSchoolView(coordinator: { userId: string; name: string }, schoolId: string, now: Date): Promise<SchoolView | null> {
  const school = await db.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true, province: true, district: true, coordinatorApproves: true, coordinatorId: true },
  });
  if (!school || school.coordinatorId !== coordinator.userId) return null;

  const [facts, applications, approvedByMe] = await Promise.all([
    getSchoolFacts(school.id, now),
    db.teacherApplication.findMany({
      // Sorumlu kendi talebine karar vermez.
      where: { schoolId: school.id, status: { in: ["PENDING", "INFO_REQUESTED"] }, userId: { not: coordinator.userId } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        subject: true,
        createdAt: true,
        institutionalEmail: true,
        documentName: true,
        coordinatorOpinion: true,
        user: { select: { id: true, displayName: true, avatar: true, birthYear: true } },
      },
    }),
    db.teacherApplication.findMany({
      where: { schoolId: school.id, status: "APPROVED", decidedById: coordinator.userId, decidedAt: { gte: new Date(now.getTime() - model.handledDays * DAY) } },
      orderBy: { decidedAt: "desc" },
      select: { id: true, user: { select: { displayName: true } } },
    }),
  ]);

  const reminded = new Set(
    (
      await db.auditLog.findMany({
        where: {
          action: "teacher.reminded",
          target: { in: facts.teachers.map((t) => auditTarget.user(t.id)) },
          createdAt: { gte: new Date(now.getTime() - model.reminderCooldownMs) },
        },
        select: { target: true },
      })
    ).map((r) => r.target),
  );

  const teachers: SchoolTeacher[] = facts.teachers
    .map((t) => {
      const me = t.id === coordinator.userId;
      return {
        id: t.id,
        name: t.name,
        avatar: t.avatar,
        subject: t.subject,
        me,
        lastSeen: t.lastSignIn ? model.whenText(t.lastSignIn, now) : null,
        step: t.step,
        signal: t.signal,
        remind: model.canRemind({ step: t.step, fresh: t.fresh, isMe: me }) ? model.reminderKindOf(t.step) : null,
        reminded: reminded.has(auditTarget.user(t.id)),
        hint: hintOf(t.step, t.fresh, t.approvedAt, now),
        classes: t.classes,
        students: t.students,
      };
    })
    .sort((a, b) => Number(b.me) - Number(a.me) || a.name.localeCompare(b.name, "tr"));

  const requests: SchoolRequest[] = applications
    .filter((a) => a.coordinatorOpinion === null)
    .map((a) => ({
      id: a.id,
      name: a.user.displayName,
      avatar: avatarOf(a.user).emoji,
      subject: a.subject,
      when: model.whenText(a.createdAt, now),
      hasInstitutionalEmail: !!a.institutionalEmail,
      hasDocument: a.documentName !== null,
      minor: mayBeMinor(a.user.birthYear, now),
    }));
  const handled: HandledRequest[] = [
    ...approvedByMe.map((a) => ({ id: a.id, name: a.user.displayName, kind: "approved" as const })),
    ...applications
      .filter((a) => a.coordinatorOpinion !== null)
      .map((a) => ({ id: a.id, name: a.user.displayName, kind: a.coordinatorOpinion === "ENDORSED" ? ("endorsed" as const) : ("notRecognized" as const) })),
  ];

  const classes = teachers.flatMap((t) => t.classes);
  const others = teachers.filter((t) => !t.me);
  const thisWeek = facts.weekly[facts.weekly.length - 1] ?? 0;
  const lastWeek = facts.weekly[facts.weekly.length - 2] ?? 0;
  const counts = { teachers: teachers.length, classes: classes.length, students: facts.students, weekDone: thisWeek };
  const sentences = model.bulletinSentences({
    thisWeek,
    lastWeek,
    classCount: classes.length,
    homework: classes
      .filter((c) => c.topic && c.pct !== null)
      .sort((a, b) => b.pct! - a.pct!)
      .map((c) => ({ className: c.name, topic: c.topic!.name, pct: c.pct! })),
    stuckTeachers: others.filter((t) => model.isStuck(t.signal)).map((t) => t.name),
    newTeachers: others.filter((t) => t.signal === "new").length,
    teacherCount: teachers.length,
    pendingRequests: requests.length,
    coordinatorApproves: school.coordinatorApproves,
  });
  const week = model.isoWeek(facts.week0);
  const range = model.weekRange(facts.week0);
  const last = facts.starts.length - 1;

  return {
    school: { id: school.id, name: school.name, province: school.province, district: school.district, coordinatorApproves: school.coordinatorApproves },
    meTeacher: teachers.some((t) => t.me),
    inviteUrl: `${siteUrl()}${paths.teacherInvite(school.id)}`,
    mailto: model.principalMailto({ school: school.name, week, range, preparedBy: coordinator.name, counts, sentences }),
    bulletin: {
      week,
      range,
      preparedBy: coordinator.name,
      counts,
      sentences,
      chart: facts.starts.map((start, i) => ({ label: model.weekLabel(start, i === last), count: facts.weekly[i], current: i === last })),
      trend: model.trendOf(thisWeek, lastWeek),
    },
    requests,
    handled,
    teachers,
  };
}
