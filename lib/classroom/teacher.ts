// Öğretmenin sınıflarının verisi (Sınıflarım, sınıf detayı, tahtaya yansıt). Sınıf yalnızca kendi
// öğretmenine görünür: her okuma teacherId ve archived=false ile yapılır; başkasının sınıfı
// "yok" sayılır (varlığı da söylenmez). Yalnızca sunucuda.
//
// "Bitirdi" öğrencinin yol haritasıyla aynı kuraldır (lib/classroom/progress.ts). Ödevin odaları
// öğretmenin seçtikleri ve onları açan eğitimlerdir (lib/classroom/homework.ts); seçim gelmeden
// verilen ödevde mahallenin yayındaki bütün odaları. Öğretmene öğrenci başına yalnızca bitirdi /
// bitirmedi gider; güvende kalma oranı sınıf toplamıdır, en az 5 öğrenci bitirince görünür ve
// 5'erli gruplarla güncellenir (teacher-rules.ts groupedNoticeRates).

import "server-only";
import QRCode from "qrcode";
import type {
  AttentionView,
  ClassCardView,
  ClassesData,
  ClassroomDetailData,
  HomeworkLabView,
  HomeworkView,
  HoodView,
  StudentView,
} from "@/components/classroom/types";
import { dayMonth, timeAgo } from "@/lib/account/dates";
import { db } from "@/lib/db";
import { format, getMessages } from "@/lib/i18n";
import { getNeighborhoods, getPublishedLabs, requestTime, type NeighborhoodRow, type PublishedLab } from "@/lib/lab/data";
import { gateOf, routeOrder } from "@/lib/lab/gates";
import { paths } from "@/lib/navigation";
import { siteUrl } from "@/lib/site";
import { homeworkLabs } from "./homework";
import { getMembersProgress, weekStart, type MemberProgress } from "./progress";
import {
  attentionFor,
  attentionOrder,
  daysLeft,
  dueBounds,
  groupedNoticeRates,
  homeworkTotals,
  packQr,
  percent,
  studentStatus,
  toDateInput,
  turkeyDate,
  type Attention,
  type AttentionInput,
  type LabFinish,
  type QrData,
} from "./teacher-rules";

/** "YENİ" etiketi: sınıf açıldıktan sonraki 2 gün. */
const newForDays = 2;

/** Sınıfa katılma bağlantısının tam adresi (kopyalanan bağlantı ve QR). */
export function joinUrl(code: string) {
  return siteUrl() + paths.join(code);
}

/** Katılma bağlantısının QR modülleri; tarayıcıda tema rengiyle çizilir. */
export function joinQr(code: string): QrData {
  const qr = QRCode.create(joinUrl(code), { errorCorrectionLevel: "M" });
  return packQr(qr.modules.size, qr.modules.data);
}

/** Öğretmenin kendi, arşivlenmemiş sınıfı; değilse null. */
export async function findOwnedClassroom(teacherId: string, classroomId: string) {
  if (!classroomId || classroomId.length > 64) return null;
  return db.classroom.findFirst({
    where: { id: classroomId, teacherId, archived: false },
    select: { id: true, name: true, joinCode: true },
  });
}

type Hood = NeighborhoodRow & { labs: PublishedLab[] };
type Progress = Map<string, MemberProgress>;

/** Mahalleler ve yayındaki labları, rota sırasıyla (her eğitim, ardından açtığı senaryolar). */
async function getHoods(): Promise<Hood[]> {
  const [neighborhoods, labs] = await Promise.all([getNeighborhoods(), getPublishedLabs()]);
  return neighborhoods.map((n) => ({ ...n, labs: routeOrder(labs, n.id) }));
}

const doneIn = (p: MemberProgress | undefined, labs: readonly { id: string }[]) => labs.filter((lab) => p?.done.has(lab.id)).length;

/** Bu hafta ilk kez biten (öğrenci, lab) çiftleri; yalnızca yayındaki lablar. */
function weekPairs(userIds: readonly string[], progress: Progress, published: Set<string>, since: Date): Set<string> {
  const pairs = new Set<string>();
  for (const userId of userIds) {
    for (const [labId, lab] of progress.get(userId)?.done ?? []) {
      if (published.has(labId) && lab.doneAt >= since) pairs.add(`${userId}:${labId}`);
    }
  }
  return pairs;
}

function lastActivity(userIds: readonly string[], progress: Progress): Date | null {
  let last: Date | null = null;
  for (const id of userIds) {
    const at = progress.get(id)?.lastLabAt;
    if (at && (!last || at > last)) last = at;
  }
  return last;
}

/** Ödevdeki her labın sınıf toplamı: bitiren sayısı ve (senaryoda) 5'erli gruplarla tuzağı fark edenler. */
function labSummaries(labs: readonly PublishedLab[], userIds: readonly string[], progress: Progress): HomeworkLabView[] {
  return labs.map((lab) => {
    const finishes: LabFinish[] = [];
    for (const id of userIds) {
      const done = progress.get(id)?.done.get(lab.id);
      if (done) finishes.push({ userId: id, doneAt: done.doneAt, first: done.noticed?.first === true, last: done.noticed?.last === true });
    }
    const training = lab.type === "TRAINING";
    return { id: lab.id, name: lab.meta.name, training, finishers: finishes.length, noticed: training ? null : groupedNoticeRates(finishes) };
  });
}

/** Sınıfın bir mahalledeki labları bitirme oranı (öğrenci × lab). */
function hoodPct(hood: Hood, userIds: readonly string[], progress: Progress) {
  const done = userIds.reduce((sum, id) => sum + doneIn(progress.get(id), hood.labs), 0);
  return percent(done, userIds.length * hood.labs.length);
}

const messages = () => getMessages().classroom;

function timeText(date: Date | null, now: Date): string | null {
  if (!date) return null;
  return timeAgo(date, now) ?? messages().justNow;
}

/** "17 Ekim'e kadar" */
function dueText(due: Date) {
  const t = messages();
  const { day, month } = turkeyDate(due);
  return format(t.dueUntil, { date: `${day} ${t.monthsUntil[month]}` });
}

/** "6 gün kaldı", "Bugün son gün", "Son tarih geçti" */
function leftText(due: Date, now: Date) {
  const t = messages().detail.band;
  const left = daysLeft(due, now);
  if (left < 0) return t.overdue;
  return left === 0 ? t.lastDay : format(t.left, { days: left });
}

function attentionText(attention: Attention): string {
  const t = messages().attention;
  switch (attention.kind) {
    case "overdue":
      return format(t.overdue, { count: attention.count });
    case "dueToday":
      return format(t.dueToday, { done: attention.finished, total: attention.members });
    case "dueSoon":
      return format(t.dueSoon, { days: attention.days, done: attention.finished, total: attention.members });
    case "hardLab":
      return format(t.hardLab, { lab: attention.lab, rate: attention.rate });
    case "notStarted":
      return format(t.notStarted, { count: attention.count });
    case "noHomework":
      return format(t.noHomework, { count: attention.count });
    case "noStudents":
      return t.noStudents;
  }
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "tr");

// ---------------------------------------------------------------------------------------
// Sınıflarım
// ---------------------------------------------------------------------------------------

export async function getTeacherClasses(teacherId: string): Promise<ClassesData> {
  const [classrooms, hoods, now] = await Promise.all([
    db.classroom.findMany({
      where: { teacherId, archived: false },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        level: true,
        joinCode: true,
        createdAt: true,
        members: { select: { userId: true } },
        assignments: {
          where: { closed: false },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { neighborhoodId: true, labIds: true, dueDate: true, createdAt: true },
        },
      },
    }),
    getHoods(),
    requestTime(),
  ]);
  const allIds = [...new Set(classrooms.flatMap((c) => c.members.map((m) => m.userId)))];
  const progress = await getMembersProgress(allIds);
  const published = new Set(hoods.flatMap((h) => h.labs.map((lab) => lab.id)));
  const since = weekStart(now);

  const flagged: { order: number; attention: Attention; view: AttentionView }[] = [];
  const classes: ClassCardView[] = classrooms.map((c, index) => {
    const ids = c.members.map((m) => m.userId);
    const open = c.assignments[0];
    const hood = open ? hoods.find((h) => h.id === open.neighborhoodId) : undefined;

    let homework: ClassCardView["homework"] = null;
    let attentionHomework: AttentionInput["homework"] = null;
    if (open && hood) {
      const labs = homeworkLabs(open, hood.labs);
      const totals = homeworkTotals(
        ids.map((id) => doneIn(progress.get(id), labs)),
        labs.length,
      );
      homework = { name: hood.name, color: hood.color, finished: totals.finished, due: open.dueDate ? dueText(open.dueDate) : null };
      attentionHomework = {
        createdAt: open.createdAt,
        dueDate: open.dueDate,
        totals,
        labs: labSummaries(labs, ids, progress).map((lab) => ({ name: lab.name, firstRate: lab.noticed?.first ?? null })),
      };
    }

    const attention = attentionFor({ members: ids.length, createdAt: c.createdAt, homework: attentionHomework }, now);
    if (attention) flagged.push({ order: index, attention, view: { id: c.id, name: c.name, text: attentionText(attention) } });

    return {
      id: c.id,
      name: c.name,
      code: c.joinCode,
      qr: joinQr(c.joinCode),
      level: c.level,
      students: ids.length,
      isNew: now.getTime() - c.createdAt.getTime() < newForDays * 24 * 60 * 60 * 1000,
      homework,
      week: weekPairs(ids, progress, published, since).size,
      last: timeText(lastActivity(ids, progress), now),
    };
  });

  const rank = (a: Attention) => attentionOrder.indexOf(a.kind);
  flagged.sort((a, b) => rank(a.attention) - rank(b.attention) || a.order - b.order);

  return {
    summary: {
      classes: classes.length,
      students: allIds.length,
      week: weekPairs(allIds, progress, published, since).size,
    },
    classes,
    attention: flagged.map((f) => f.view),
    origin: siteUrl(),
  };
}

// ---------------------------------------------------------------------------------------
// Sınıf detayı
// ---------------------------------------------------------------------------------------

/** Sınıfın detayı; sınıf bu öğretmenin değilse (ya da arşivdeyse) null. */
export async function getClassroomDetail(teacherId: string, classroomId: string): Promise<ClassroomDetailData | null> {
  if (!classroomId || classroomId.length > 64) return null;
  const [classroom, hoods, now] = await Promise.all([
    db.classroom.findFirst({
      where: { id: classroomId, teacherId, archived: false },
      select: {
        id: true,
        name: true,
        level: true,
        joinCode: true,
        members: { select: { joinedAt: true, user: { select: { id: true, displayName: true } } } },
        assignments: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { neighborhoodId: true, labIds: true, dueDate: true, closed: true },
        },
      },
    }),
    getHoods(),
    requestTime(),
  ]);
  if (!classroom) return null;

  const members = classroom.members.map((m) => ({ id: m.user.id, name: m.user.displayName, joinedAt: m.joinedAt })).sort(byName);
  const ids = members.map((m) => m.id);
  const progress = await getMembersProgress(ids);
  const allLabs = hoods.flatMap((h) => h.labs);
  const published = new Set(allLabs.map((lab) => lab.id));

  const open = classroom.assignments.find((a) => !a.closed);
  const current = open ? hoods.find((h) => h.id === open.neighborhoodId) : undefined;
  const homeworkLabList = open && current ? homeworkLabs(open, current.labs) : [];

  let homework: HomeworkView | null = null;
  if (open && current) {
    const totals = homeworkTotals(
      ids.map((id) => doneIn(progress.get(id), homeworkLabList)),
      homeworkLabList.length,
    );
    homework = {
      neighborhoodId: current.id,
      name: current.name,
      color: current.color,
      icon: current.icon,
      labs: labSummaries(homeworkLabList, ids, progress),
      pct: totals.pct,
      finished: totals.finished,
      notStarted: members.filter((m) => doneIn(progress.get(m.id), homeworkLabList) === 0).map((m) => ({ id: m.id, name: m.name })),
      due: open.dueDate ? dueText(open.dueDate) : null,
      left: open.dueDate ? leftText(open.dueDate, now) : null,
      overdue: open.dueDate ? daysLeft(open.dueDate, now) < 0 : false,
      dueInput: open.dueDate ? toDateInput(open.dueDate) : "",
    };
  }

  const students: StudentView[] = members.map((m) => {
    const p = progress.get(m.id);
    const homeworkDone = homeworkLabList.map((lab) => p?.done.has(lab.id) ?? false);
    return {
      id: m.id,
      name: m.name,
      joined: dayMonth(m.joinedAt),
      last: timeText(p?.lastLabAt ?? null, now),
      homework: homeworkDone,
      status: current ? studentStatus(homeworkDone.filter(Boolean).length, homeworkLabList.length) : null,
      total: doneIn(p, allLabs),
      byHood: hoods.map((h) => doneIn(p, h.labs)),
    };
  });

  const hoodViews: HoodView[] = hoods.map((h) => ({
    id: h.id,
    name: h.name,
    color: h.color,
    icon: h.icon,
    labCount: h.labs.length,
    // Ödev penceresindeki oda listesi; gate: odayı açan eğitim (temel eğitimde null).
    labs: h.labs.map((lab) => ({ id: lab.id, name: lab.meta.name, training: lab.type === "TRAINING", gate: gateOf(lab, h.labs)?.id ?? null })),
    pct: hoodPct(h, ids, progress),
    current: h.id === current?.id,
  }));

  // Geçmiş ödevler: kapanan ödevlerin mahalleleri (en yeni önce, her mahalle bir kez; açık olan hariç).
  const pastIds = [...new Set(classroom.assignments.filter((a) => a.closed && a.neighborhoodId !== current?.id).map((a) => a.neighborhoodId))];
  const past = pastIds.flatMap((id) => {
    const h = hoodViews.find((x) => x.id === id);
    return h ? [{ id: h.id, name: h.name, color: h.color, pct: h.pct }] : [];
  });

  return {
    id: classroom.id,
    name: classroom.name,
    code: classroom.joinCode,
    qr: joinQr(classroom.joinCode),
    level: classroom.level,
    origin: siteUrl(),
    week: weekPairs(ids, progress, published, weekStart(now)).size,
    labTotal: allLabs.length,
    homework,
    students,
    hoods: hoodViews,
    past,
    dueBounds: dueBounds(now),
  };
}
