// Yönetim · Öğretmen talepleri ekranının verisi (Talepler-Son). Sekme sayıları, sekmenin listesi
// ve seçili talebin ayrıntısı. Yalnızca sunucuda; erişim sayfada denetlenir (APPLICATIONS).
//
// Gizlilik: başvuranın hesap e-postası okunmaz, tarayıcıya gitmez; yalnızca doğrulama için
// verdiği kurumsal e-posta (isteğe bağlı) gösterilir. Belgenin baytları okunmaz; belge
// yalnızca kendi adresinden (app/yonetim/talepler/[talep]/belge/route.ts) açılır.

import "server-only";
import type {
  ApplicationDetail,
  ApplicationRow,
  ApplicationsBoard,
  DocumentView,
  QaView,
  SimilarSchool,
} from "@/components/admin/applications/types";
import { dayMonth, timeAgo } from "@/lib/account/dates";
import { mayBeMinor } from "@/lib/account/shared";
import { auditTarget, type AuditAction } from "@/lib/audit";
import { avatarOf } from "@/lib/avatars";
import { db } from "@/lib/db";
import type { ApplicationStatus } from "@/lib/generated/prisma/enums";
import { format, getMessages } from "@/lib/i18n";
import { formatFileSize } from "@/lib/teacher/document";
import { siteTimeZone } from "@/lib/site";
import {
  applicationTabs,
  isApplicationId,
  qaHistory,
  readChecks,
  signalLevel,
  similarSchools,
  tabFromParam,
  tabOf,
  tabStatus,
  type ApplicationTab,
} from "./application-rules";

/** Bekleyen ve bilgi istenen talepler hepsi listelenir (bu kadar birikmesi beklenmez). */
const openListLimit = 300;
/** Karar verilmiş talepler: en yeni 100. */
const decidedListLimit = 100;
/** "Bu okul mu?" için ilçedeki okullar en fazla bu kadar okunur. */
const districtSchoolLimit = 500;

const t = () => getMessages().adminApplications;

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: siteTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

const clock = (date: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: siteTimeZone, hour: "2-digit", minute: "2-digit" }).format(date);

/** "Bugün 21:12", "Dün 18:40"; daha eskiyse null. */
function recent(date: Date, now: Date): string | null {
  const m = t();
  if (dayKey(date) === dayKey(now)) return format(m.today, { time: clock(date) });
  if (dayKey(date) === dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return format(m.yesterday, { time: clock(date) });
  return null;
}

/** Listede: "Bugün 21:12", "Dün 18:40", "3 gün önce". */
function whenLabel(date: Date, now: Date) {
  return recent(date, now) ?? timeAgo(date, now) ?? format(t().today, { time: clock(date) });
}

/** Soru-cevap ve karar: "Bugün 21:12", "Dün 18:40", "7 Ekim". */
function dateLabel(date: Date, now: Date) {
  return recent(date, now) ?? dayMonth(date);
}

/** "3 aydır üye" */
function memberFor(createdAt: Date, now: Date) {
  const m = t().member;
  const days = Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 1) return m.today;
  if (days < 14) return format(m.days, { n: days });
  if (days < 60) return format(m.weeks, { n: Math.floor(days / 7) });
  if (days < 365) return format(m.months, { n: Math.floor(days / 30) });
  return format(m.years, { n: Math.floor(days / 365) });
}

/** Okulların onaylı öğretmen sayısı (öğretmen ya da okulu olan yönetici). */
async function teacherCounts(schoolIds: string[]): Promise<Map<string, number>> {
  const ids = [...new Set(schoolIds)];
  if (ids.length === 0) return new Map();
  const groups = await db.user.groupBy({
    by: ["schoolId"],
    where: { schoolId: { in: ids }, role: { not: "STUDENT" } },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.schoolId ?? "", g._count._all]));
}

async function tabCounts(): Promise<Record<ApplicationTab, number>> {
  const groups = await db.teacherApplication.groupBy({ by: ["status"], _count: { _all: true } });
  const byStatus = new Map<ApplicationStatus, number>(groups.map((g) => [g.status, g._count._all]));
  return Object.fromEntries(applicationTabs.map((tab) => [tab, byStatus.get(tabStatus[tab]) ?? 0])) as Record<ApplicationTab, number>;
}

const orderOf = {
  pending: { createdAt: "desc" },
  info: { questionAt: "desc" },
  approved: { decidedAt: "desc" },
  rejected: { decidedAt: "desc" },
} as const;

async function listRows(tab: ApplicationTab, now: Date): Promise<{ rows: ApplicationRow[]; limit: number | null }> {
  const take = tab === "pending" || tab === "info" ? openListLimit : decidedListLimit;
  const apps = await db.teacherApplication.findMany({
    where: { status: tabStatus[tab] },
    orderBy: [orderOf[tab], { id: "asc" }],
    take: take + 1,
    select: {
      id: true,
      status: true,
      createdAt: true,
      answeredAt: true,
      schoolId: true,
      newSchoolName: true,
      subject: true,
      institutionalEmail: true,
      documentName: true,
      user: { select: { id: true, displayName: true, avatar: true, birthYear: true } },
      school: { select: { name: true } },
    },
  });
  const shown = apps.slice(0, take);
  const teachers = await teacherCounts(shown.flatMap((a) => (a.schoolId ? [a.schoolId] : [])));
  const rows = shown.map((app): ApplicationRow => {
    const hasEmail = !!app.institutionalEmail;
    const hasDocument = !!app.documentName;
    const schoolListed = !!app.schoolId;
    return {
      id: app.id,
      name: app.user.displayName,
      avatar: avatarOf(app.user).emoji,
      when: whenLabel(app.createdAt, now),
      school: app.school?.name ?? app.newSchoolName ?? "",
      subject: app.subject,
      hasEmail,
      hasDocument,
      level: signalLevel({ hasEmail, hasDocument, schoolListed, colleagues: app.schoolId ? (teachers.get(app.schoolId) ?? 0) : 0 }),
      newSchool: !schoolListed,
      answered: app.status === "PENDING" && app.answeredAt !== null,
      minor: mayBeMinor(app.user.birthYear, now),
    };
  });
  return { rows, limit: apps.length > take ? take : null };
}

const detailAuditActions = [
  "application.info_requested",
  "application.undone",
  "application.endorsed",
  "application.not_recognized",
] as const satisfies readonly AuditAction[];

const documentKinds: Record<string, DocumentView["kind"]> = { "application/pdf": "pdf", "image/jpeg": "image", "image/png": "image" };

async function loadDetail(applicationId: string, viewerId: string, now: Date): Promise<ApplicationDetail | null> {
  const app = await db.teacherApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      userId: true,
      status: true,
      schoolId: true,
      newSchoolName: true,
      province: true,
      district: true,
      subject: true,
      institutionalEmail: true,
      documentName: true,
      documentSize: true,
      checks: true,
      question: true,
      questionAt: true,
      answer: true,
      answeredAt: true,
      coordinatorOpinion: true,
      decidedAt: true,
      rejectionNote: true,
      createdAt: true,
      // Hesap e-postası seçilmez.
      user: { select: { id: true, displayName: true, avatar: true, createdAt: true, birthYear: true } },
      school: {
        select: { id: true, name: true, coordinatorApproves: true, coordinator: { select: { id: true, displayName: true } } },
      },
      decidedBy: { select: { displayName: true } },
      // Belgenin yalnızca türü; baytlar okunmaz.
      document: { select: { mimeType: true } },
    },
  });
  if (!app) return null;

  const open = app.status === "PENDING" || app.status === "INFO_REQUESTED";
  const [finished, entries, districtSchools] = await Promise.all([
    db.labAttempt.findMany({
      where: { userId: app.userId, status: { in: ["COMPLETED", "HACKED"] } },
      distinct: ["labId"],
      select: { labId: true },
    }),
    db.auditLog.findMany({
      where: { target: auditTarget.application(app.id), action: { in: [...detailAuditActions] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, action: true, details: true, actor: { select: { displayName: true } } },
    }),
    !app.schoolId && open && app.newSchoolName
      ? db.school.findMany({
          where: { province: app.province, district: app.district },
          select: { id: true, name: true },
          take: districtSchoolLimit,
        })
      : Promise.resolve([]),
  ]);

  const similarRows = app.newSchoolName ? similarSchools(app.newSchoolName, districtSchools) : [];
  const teachers = await teacherCounts([...(app.schoolId ? [app.schoolId] : []), ...similarRows.map((s) => s.id)]);
  const similar: SimilarSchool[] = similarRows.map((s) => ({ id: s.id, name: s.name, teachers: teachers.get(s.id) ?? 0 }));

  const m = t();
  const history: QaView[] = qaHistory(entries, app).map((round) => ({
    question: round.question,
    askedAt: dateLabel(round.questionAt, now),
    answer: round.answer,
    answeredAt: round.answeredAt ? dateLabel(round.answeredAt, now) : null,
  }));

  // Görüşü kimin verdiği: geri alınmamış son görüş kaydı.
  const undone = new Set(
    entries
      .filter((e) => e.action === "application.undone")
      .flatMap((e) => ((e.details as { undone?: { id?: unknown }[] } | null)?.undone ?? []).map((u) => u?.id)),
  );
  const opinionEntry = entries.filter((e) => (e.action === "application.endorsed" || e.action === "application.not_recognized") && !undone.has(e.id)).at(-1);

  const document: DocumentView | null = app.documentName
    ? {
        name: app.documentName,
        size: formatFileSize(app.documentSize ?? 0),
        available: !!app.document && app.document.mimeType in documentKinds,
        kind: app.document ? (documentKinds[app.document.mimeType] ?? null) : null,
      }
    : null;

  const labs = finished.length;
  return {
    id: app.id,
    status: app.status,
    name: app.user.displayName,
    avatar: avatarOf(app.user).emoji,
    requested: format(m.requested, { date: dayMonth(app.createdAt), when: whenLabel(app.createdAt, now) }),
    school: app.school
      ? {
          id: app.school.id,
          name: app.school.name,
          teachers: teachers.get(app.school.id) ?? 0,
          // Sorumlu talebin sahibiyse kendi talebini Okulum'da görmez.
          coordinator: app.school.coordinator && app.school.coordinator.id !== app.userId ? app.school.coordinator.displayName : null,
          coordinatorApproves: app.school.coordinatorApproves,
        }
      : null,
    typedSchoolName: app.newSchoolName,
    place: format(m.place, { province: app.province, district: app.district }),
    province: app.province,
    district: app.district,
    subject: app.subject,
    institutionalEmail: app.institutionalEmail,
    document,
    account: format(m.accountLine, {
      member: memberFor(app.user.createdAt, now),
      labs: labs > 0 ? format(m.labs.some, { n: labs }) : m.labs.none,
    }),
    minorBirthYear: mayBeMinor(app.user.birthYear, now) ? app.user.birthYear : null,
    opinion: app.coordinatorOpinion ? { kind: app.coordinatorOpinion, by: opinionEntry?.actor.displayName ?? null } : null,
    history,
    checks: readChecks(app.checks),
    decided:
      (app.status === "APPROVED" || app.status === "REJECTED") && app.decidedAt
        ? app.decidedBy
          ? format(m.decided.by, { date: dateLabel(app.decidedAt, now), name: app.decidedBy.displayName })
          : dateLabel(app.decidedAt, now)
        : null,
    rejectionNote: app.status === "REJECTED" ? app.rejectionNote : null,
    similar,
    own: app.userId === viewerId,
  };
}

/**
 * Ekranın verisi. Adreste sekme yoksa ve talep seçiliyse sekme talebin durumundan gelir
 * (kayıt defterinden ya da özetten gelen bağlantı). Seçili talep sekmede değilse (bu arada karar
 * verildiyse) listenin ilki gösterilir; telefonda ayrıntı sayfası yalnızca adresteki talep
 * sekmedeyse açılır.
 */
export async function getApplicationsBoard(input: { tab: unknown; selected: unknown; viewerId: string }): Promise<ApplicationsBoard> {
  const now = new Date();
  const selectedId = isApplicationId(input.selected) ? input.selected : null;
  const selectedRow = selectedId
    ? await db.teacherApplication.findUnique({ where: { id: selectedId }, select: { id: true, status: true } })
    : null;
  const tab = tabFromParam(input.tab) ?? (selectedRow ? tabOf(selectedRow.status) : "pending");

  const [counts, { rows, limit }] = await Promise.all([tabCounts(), listRows(tab, now)]);
  const explicit = !!selectedRow && tabOf(selectedRow.status) === tab;
  const detailId = explicit ? selectedRow.id : (rows[0]?.id ?? null);
  const selected = detailId ? await loadDetail(detailId, input.viewerId, now) : null;
  return { tab, counts, rows, limit, selected, explicit };
}
