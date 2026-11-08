// Öğretmenlik talebinin profildeki hali (Tur 4, 17 son hali). Kişinin son talebine ve rolüne
// bakılır: öğretmen ya da yöneticiyse hesap açıktır; değilse son talebin durumu gösterilir.
// Belgenin kendisi okunmaz, tarayıcıya yalnızca adı ve boyutu gider. Yalnızca sunucuda.

import "server-only";
import type { ApplicationDraft, ApplicationSummary, TeachingSectionData } from "@/components/profile/teaching/types";
import { dayMonth, dayOn } from "@/lib/account/dates";
import { db } from "@/lib/db";
import { format, getMessages } from "@/lib/i18n";
import { siteTimeZone } from "@/lib/site";
import { adminTeaches } from "./access";
import { isSchoolId } from "./application-rules";
import { formatFileSize } from "./document";

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: siteTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** "Bugün", "Dün" ya da "10 Ekim" (Türkiye saatiyle). */
export function dayLabel(date: Date, now = new Date()) {
  const t = getMessages().teaching;
  const key = dayKey(date);
  if (key === dayKey(now)) return t.today;
  if (key === dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return t.yesterday;
  return dayMonth(date);
}

/** "Dün 18:55" */
function dayTime(date: Date, now: Date) {
  const time = new Intl.DateTimeFormat("tr-TR", { timeZone: siteTimeZone, hour: "2-digit", minute: "2-digit" }).format(date);
  return format(getMessages().teaching.dayTime, { day: dayLabel(date, now), time });
}

const applicationSelect = {
  status: true,
  schoolId: true,
  newSchoolName: true,
  province: true,
  district: true,
  subject: true,
  institutionalEmail: true,
  documentName: true,
  documentSize: true,
  question: true,
  questionAt: true,
  answeredAt: true,
  decidedAt: true,
  rejectionNote: true,
  createdAt: true,
  school: { select: { name: true } },
  document: { select: { applicationId: true } },
} as const;

type Application = NonNullable<Awaited<ReturnType<typeof latestApplication>>>;

function latestApplication(userId: string) {
  return db.teacherApplication.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: applicationSelect });
}

function summaryOf(app: Application): ApplicationSummary {
  return {
    school: app.school?.name ?? app.newSchoolName ?? "",
    place: format(getMessages().teaching.place, { province: app.province, district: app.district }),
    subject: app.subject,
    institutionalEmail: app.institutionalEmail,
    document: app.documentName ? { name: app.documentName, size: formatFileSize(app.documentSize ?? 0), deleted: !app.document } : null,
    sentOn: dayMonth(app.createdAt),
  };
}

/** Karar verilince belge silinir; ekranda "gönderdiğin belge silindi" yalnızca gerçekten silindiyse yazar. */
const documentDeleted = (app: Application) => !!app.documentName && !app.document;

async function invitedSchool(id: string | null) {
  if (!isSchoolId(id)) return null;
  return db.school.findUnique({ where: { id }, select: { id: true, name: true, province: true, district: true } });
}

export async function getTeachingSection(userId: string, invitedSchoolId: string | null): Promise<TeachingSectionData> {
  const now = new Date();
  const [user, app] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { role: true, school: { select: { name: true } } } }),
    latestApplication(userId),
  ]);

  // Yönetici talep verip onaylanmadıysa öğretmen sayılmaz; formu görür (lib/teacher/access.ts).
  if (user && (user.role === "TEACHER" || (user.role === "ADMIN" && (await adminTeaches(db, userId))))) {
    const approved = app?.status === "APPROVED" ? app : null;
    // Arşivlenmiş sınıf da sayılır: o öğretmen için "ilk sınıf" değil.
    const classCount = await db.classroom.count({ where: { teacherId: userId } });
    return {
      state: "approved",
      approvedOn: approved?.decidedAt ? dayOn(approved.decidedAt) : null,
      school: user.school?.name ?? approved?.school?.name ?? approved?.newSchoolName ?? null,
      documentDeleted: approved ? documentDeleted(approved) : false,
      hasClass: classCount > 0,
    };
  }

  if (app?.status === "PENDING") {
    return { state: "pending", application: summaryOf(app), answeredOn: app.answeredAt ? dayLabel(app.answeredAt, now) : null };
  }
  if (app?.status === "INFO_REQUESTED") {
    return { state: "info", application: summaryOf(app), question: app.question ?? "", askedAt: dayTime(app.questionAt ?? app.createdAt, now) };
  }

  // Davet bağlantısındaki okul (Okulum): form o okul seçili açılır.
  const invited = await invitedSchool(invitedSchoolId);

  if (app?.status === "REJECTED") {
    const province = invited?.province ?? app.province;
    const district = invited?.district ?? app.district;
    const draft: ApplicationDraft = {
      province,
      district,
      school: invited ? { id: invited.id, name: invited.name } : app.schoolId && app.school ? { id: app.schoolId, name: app.school.name } : null,
      newSchoolName: invited ? "" : (app.newSchoolName ?? ""),
      subject: app.subject,
      institutionalEmail: app.institutionalEmail ?? "",
    };
    return {
      state: "rejected",
      decidedOn: app.decidedAt ? dayMonth(app.decidedAt) : null,
      note: app.rejectionNote,
      documentDeleted: documentDeleted(app),
      draft,
    };
  }

  // Talep yok (ya da onaylanmıştı ama öğretmenlikten çıkarıldı): yeni talep açılabilir.
  if (!invited) return { state: "none", draft: null, invited: false };
  return {
    state: "none",
    invited: true,
    draft: {
      province: invited.province,
      district: invited.district,
      school: { id: invited.id, name: invited.name },
      newSchoolName: "",
      subject: "",
      institutionalEmail: "",
    },
  };
}
