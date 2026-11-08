// Öğretmen talebi kararlarının ortak çekirdeği: onayla, reddet, bilgi iste, okul sorumlusunun
// görüşü ve bunların 5 saniyelik "Geri al"ı. Okulum (lib/teacher/school-actions.ts) bugün, yönetimin
// "Öğretmen talepleri" ekranı Faz 5'te buradan karar verir. Yalnızca sunucuda.
//
// YETKİ BURADA DENETLENMEZ. Bu fonksiyonlar yalnızca talebin durum kurallarını uygular (bekleyen
// talep onaylanır, karar verilmiş talep yeniden onaylanmaz...). Kimin karar verebileceğini çağıran
// denetler: Okulum'da okulun sorumlusu ve talep o okuldan; yönetimde APPLICATIONS izni ya da
// yönetici. Onaydaki "en az 2 kontrol işareti" kuralı da yönetim ekranınındır (Okulum'da kontrol
// listesi yoktur). actorId her zaman veritabanından yeniden okunmuş, yetkisi denetlenmiş kişidir.
//
// Her karar tek bir veritabanı işleminde (transaction) yazılır: başvuranın ve talebin satırı bu
// sırayla kilitlenir (SELECT ... FOR UPDATE; aynı anda iki karar ya da karar ile başvuranın geri
// çekmesi çakışmaz), değişiklik ve kayıt defteri satırı birlikte yazılır.
//
// Kararın sonuçları ertelenir: karar maili ve talebe eklenen belgenin silinmesi geri al süresi
// (decision-rules.ts undoWindowMs) bitmeden yapılmaz; yoksa "Geri al" gönderilmiş bir mail ya da
// silinmiş bir belge bırakırdı. Karar verilince finalizeDecision süre bitiminden biraz sonrasına
// kurulur (after()); sunucu o arada kapanırsa saatlik temizlik (lib/cleanup.ts) aynı işi yapar.
// Mailin gittiği, kayıt defterindeki "application.mail_sent" satırından anlaşılır (veri modelinde
// ayrı bir alan yok); böylece aynı karar için ikinci mail gitmez.
//
// Rol değişikliği oturumları etkilemez: rol her istekte veritabanından okunur (lib/teacher/access.ts).

import "server-only";
import { after } from "next/server";
import { auditTarget, writeAudit, type AuditAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import type { ApplicationStatus, CoordinatorOpinion, Role } from "@/lib/generated/prisma/enums";
import { sendMail } from "@/lib/mail";
import { approvedMail, infoRequestedMail, rejectedMail } from "@/lib/mail/teacher-mail";
import { cleanSchoolName, schoolNameKey, schoolNameOk } from "@/lib/school/names";
import { siteUrl } from "@/lib/site";
import {
  cleanText,
  decisionActions,
  decisionOf,
  deletesDocument,
  entriesToUndo,
  finalizeDelayMs,
  mailRetryMs,
  questionLimits,
  rejectionNoteLimits,
  textOk,
  undoWindowMs,
  undoWindowOver,
  type DecisionAction,
} from "./decision-rules";

export { finalizeDelayMs, questionLimits, rejectionNoteLimits, undoWindowMs } from "./decision-rules";

export type DecideError =
  /** Talep yok (silinmiş ya da geri çekilmiş olabilir). */
  | "notFound"
  /** Talep bu karara uygun durumda değil: karar verilmiş, ya da bilgi isteme yalnızca bekleyende. */
  | "invalidState"
  /** Ret notu, soru ya da yeni okulun adı kurallara uymuyor. */
  | "invalidInput"
  /** Eşlenmek istenen okul yok ya da talebin il ve ilçesinde değil. */
  | "schoolMismatch"
  /** Geri al süresi geçti, geri alınacak karar yok ya da arada başka bir değişiklik oldu. */
  | "tooLate"
  | "failed";

export type DecideResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: DecideError };

type Tx = Prisma.TransactionClient;

/** İşlemin içinden kuralla geri çevirme: işlem geri döner, çağırana hata kodu gider. */
class Refusal extends Error {
  constructor(readonly code: DecideError) {
    super(code);
  }
}

const openStatuses: readonly ApplicationStatus[] = ["PENDING", "INFO_REQUESTED"];
const isOpen = (status: ApplicationStatus) => openStatuses.includes(status);

const applicationSelect = {
  id: true,
  userId: true,
  schoolId: true,
  newSchoolName: true,
  province: true,
  district: true,
  status: true,
  documentName: true,
  question: true,
  questionAt: true,
  coordinatorOpinion: true,
  decidedById: true,
  decidedAt: true,
  rejectionNote: true,
} as const satisfies Prisma.TeacherApplicationSelect;

/**
 * Talep satırını işlem bitene kadar kilitler ve okur; yoksa null. Önce başvuranın kullanıcı satırı
 * kilitlenir, sonra talep: başvuranın kendi işleri (talep gönderme, cevap, geri çekme;
 * application-actions.ts) de bu sırayla kilitler. Sıra ters olsaydı aynı anda gelen karar ve geri
 * çekme birbirini bekleyip kilitlenirdi (deadlock) ve karar hata verirdi. Talebin sahibi değişmez;
 * bu yüzden sahibi kilitsiz okunabilir. Kullanıcı satırı NO KEY UPDATE ile kilitlenir: oturum açmak
 * gibi o satıra yalnızca bağlanan yazımlar beklemez.
 */
async function lockApplication(tx: Tx, applicationId: string) {
  const owner = await tx.$queryRaw<{ userId: string }[]>`SELECT "userId" FROM "TeacherApplication" WHERE "id" = ${applicationId}`;
  if (owner.length === 0) return null;
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${owner[0].userId} FOR NO KEY UPDATE`;
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "TeacherApplication" WHERE "id" = ${applicationId} FOR UPDATE`;
  if (rows.length === 0) return null;
  return tx.teacherApplication.findUniqueOrThrow({ where: { id: applicationId }, select: applicationSelect });
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** İşlemi çalıştırır; kural geri çevirmesini sonuca, beklenmeyen hatayı "failed"a çevirir. */
async function run<T extends object>(label: string, work: () => Promise<T>): Promise<DecideResult<T>> {
  try {
    return { ok: true, ...(await work()) };
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, error: error.code };
    console.error(`[talep] ${label}:`, errorText(error));
    return { ok: false, error: "failed" };
  }
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);
const parseDate = (value: unknown) => (typeof value === "string" ? new Date(value) : null);
const sameTime = (date: Date | null, value: unknown) => (date === null ? value === null : typeof value === "string" && date.toISOString() === value);

// ---------------------------------------------------------------------------------------
// Onayla
// ---------------------------------------------------------------------------------------

export type ApproveInput = {
  applicationId: string;
  actorId: string;
  /**
   * Yalnızca "Yeni okul" talebinde (schoolId boş): okulun düzeltilmiş adı. Verilmezse talepteki ad
   * kullanılır. Aynı ilçede aynı karşılaştırma adıyla (nameKey) okul varsa yenisi açılmaz, o kullanılır.
   */
  schoolName?: string;
  /** Yalnızca "Yeni okul" talebinde: "Bu okul mu?" eşlemesi; okul talebin il ve ilçesinde olmalı. */
  matchSchoolId?: string;
};

export type ApproveResult = DecideResult<{ userId: string; schoolId: string; schoolCreated: boolean; decidedAt: Date }>;

/**
 * Talebi onaylar: durum APPROVED olur, kişinin rolü öğrenciyse öğretmen olur (yönetici yönetici
 * kalır; önceki rol kayda yazılır) ve okulu talebin okulu olur. "Yeni okul" talebinde okul
 * eşlenir ya da listeye eklenir (kayıt defterine "school.created"). Talebi okulda bırakılmışsa
 * (schoolId dolu) schoolName ve matchSchoolId dikkate alınmaz. Mail ve belge silme ertelenir.
 */
export async function approveApplication(input: ApproveInput): Promise<ApproveResult> {
  const { applicationId } = input;
  const result = await run("onaylanamadı", async () => {
    // Aynı ilçede aynı adla iki okul aynı anda açılırsa ikinci işlem benzersizlik hatası alır;
    // ikinci denemede okul artık vardır ve o kullanılır.
    for (let attempt = 0; ; attempt++) {
      try {
        return await db.$transaction((tx) => approveIn(tx, input));
      } catch (error) {
        if (attempt === 0 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
        throw error;
      }
    }
  });
  if (result.ok) scheduleFinalize(applicationId);
  return result;
}

async function approveIn(tx: Tx, { applicationId, actorId, schoolName, matchSchoolId }: ApproveInput) {
  const app = await lockApplication(tx, applicationId);
  if (!app) throw new Refusal("notFound");
  if (!isOpen(app.status)) throw new Refusal("invalidState");
  const user = await tx.user.findUniqueOrThrow({ where: { id: app.userId }, select: { role: true, schoolId: true } });

  let schoolId: string;
  let schoolCreated = false;
  if (app.schoolId) {
    schoolId = app.schoolId;
  } else if (matchSchoolId) {
    const school = await tx.school.findUnique({ where: { id: matchSchoolId }, select: { id: true, province: true, district: true } });
    if (!school || school.province !== app.province || school.district !== app.district) throw new Refusal("schoolMismatch");
    schoolId = school.id;
  } else {
    const name = cleanSchoolName(schoolName ?? app.newSchoolName ?? "");
    if (!schoolNameOk(name)) throw new Refusal("invalidInput");
    const nameKey = schoolNameKey(name);
    const existing = await tx.school.findUnique({
      where: { province_district_nameKey: { province: app.province, district: app.district, nameKey } },
      select: { id: true },
    });
    if (existing) {
      schoolId = existing.id;
    } else {
      const created = await tx.school.create({
        data: { name, nameKey, province: app.province, district: app.district, createdById: actorId },
        select: { id: true },
      });
      schoolId = created.id;
      schoolCreated = true;
      await writeAudit(tx, {
        actorId,
        action: "school.created",
        target: auditTarget.school(created.id),
        details: { name, province: app.province, district: app.district, applicationId },
      });
    }
  }

  const decidedAt = new Date();
  const role: Role = user.role === "STUDENT" ? "TEACHER" : user.role;
  await tx.user.update({ where: { id: app.userId }, data: { role, schoolId } });
  await tx.teacherApplication.update({
    where: { id: applicationId },
    data: { status: "APPROVED", decidedById: actorId, decidedAt, schoolId, rejectionNote: null },
  });
  await writeAudit(tx, {
    actorId,
    action: "application.approved",
    target: auditTarget.application(applicationId),
    // Geri al bu satırdan önceki hali kurar.
    details: {
      userId: app.userId,
      schoolId,
      schoolCreated,
      decidedAt: decidedAt.toISOString(),
      previousStatus: app.status,
      previousRole: user.role,
      role,
      previousSchoolId: user.schoolId,
      previousApplicationSchoolId: app.schoolId,
    },
  });
  return { userId: app.userId, schoolId, schoolCreated, decidedAt };
}

// ---------------------------------------------------------------------------------------
// Reddet, bilgi iste, okul sorumlusunun görüşü
// ---------------------------------------------------------------------------------------

/** Talebi reddeder. Not (10-500 karakter) öğretmenin profiline ve mailine gider. */
export async function rejectApplication(input: { applicationId: string; actorId: string; note: string }): Promise<DecideResult<{ decidedAt: Date }>> {
  const { applicationId, actorId } = input;
  const note = cleanText(typeof input.note === "string" ? input.note : "");
  if (!textOk(note, rejectionNoteLimits)) return { ok: false, error: "invalidInput" };
  const result = await run("reddedilemedi", () =>
    db.$transaction(async (tx) => {
      const app = await lockApplication(tx, applicationId);
      if (!app) throw new Refusal("notFound");
      if (!isOpen(app.status)) throw new Refusal("invalidState");
      const decidedAt = new Date();
      await tx.teacherApplication.update({
        where: { id: applicationId },
        data: { status: "REJECTED", rejectionNote: note, decidedById: actorId, decidedAt },
      });
      await writeAudit(tx, {
        actorId,
        action: "application.rejected",
        target: auditTarget.application(applicationId),
        details: { userId: app.userId, decidedAt: decidedAt.toISOString(), previousStatus: app.status },
      });
      return { decidedAt };
    }),
  );
  if (result.ok) scheduleFinalize(applicationId);
  return result;
}

/**
 * Bekleyen talep için öğretmenden bilgi ister: durum INFO_REQUESTED, soru profiline ve mailine
 * gider. Geri alınabilsin diye önceki soru kayıt defterine yazılır. Önceki cevap satırda kalır
 * (yeni cevap gelince üstüne yazılır; yeni cevabı answeredAt > questionAt gösterir): başvuranın
 * yazdığı metin silinemeyen kayıt defterine girmez, hesap silinince onunla birlikte gider.
 */
export async function requestInfo(input: { applicationId: string; actorId: string; question: string }): Promise<DecideResult<{ questionAt: Date }>> {
  const { applicationId, actorId } = input;
  const question = cleanText(typeof input.question === "string" ? input.question : "");
  if (!textOk(question, questionLimits)) return { ok: false, error: "invalidInput" };
  const result = await run("bilgi istenemedi", () =>
    db.$transaction(async (tx) => {
      const app = await lockApplication(tx, applicationId);
      if (!app) throw new Refusal("notFound");
      if (app.status !== "PENDING") throw new Refusal("invalidState");
      const questionAt = new Date();
      await tx.teacherApplication.update({
        where: { id: applicationId },
        data: { status: "INFO_REQUESTED", question, questionAt },
      });
      await writeAudit(tx, {
        actorId,
        action: "application.info_requested",
        target: auditTarget.application(applicationId),
        details: {
          userId: app.userId,
          questionAt: questionAt.toISOString(),
          previous: { question: app.question, questionAt: iso(app.questionAt) },
        },
      });
      return { questionAt };
    }),
  );
  if (result.ok) scheduleFinalize(applicationId);
  return result;
}

/**
 * Okul sorumlusunun görüşü: "Okulumda çalışıyor" (ENDORSED) ya da "Tanımıyorum" (NOT_RECOGNIZED).
 * Talep bekler; kararı yönetici (ya da onay yetkisi olan sorumlu, approveApplication ile) verir.
 * Aynı görüş zaten yazılıysa hiçbir şey yazılmaz (changed: false).
 */
export async function setCoordinatorOpinion(input: {
  applicationId: string;
  actorId: string;
  opinion: CoordinatorOpinion;
}): Promise<DecideResult<{ changed: boolean }>> {
  const { applicationId, actorId, opinion } = input;
  if (opinion !== "ENDORSED" && opinion !== "NOT_RECOGNIZED") return { ok: false, error: "invalidInput" };
  return run("görüş yazılamadı", () =>
    db.$transaction(async (tx) => {
      const app = await lockApplication(tx, applicationId);
      if (!app) throw new Refusal("notFound");
      if (!isOpen(app.status)) throw new Refusal("invalidState");
      if (app.coordinatorOpinion === opinion) return { changed: false };
      await tx.teacherApplication.update({ where: { id: applicationId }, data: { coordinatorOpinion: opinion } });
      await writeAudit(tx, {
        actorId,
        action: opinion === "ENDORSED" ? "application.endorsed" : "application.not_recognized",
        target: auditTarget.application(applicationId),
        details: { userId: app.userId, opinion, previousOpinion: app.coordinatorOpinion },
      });
      return { changed: true };
    }),
  );
}

// ---------------------------------------------------------------------------------------
// Geri al
// ---------------------------------------------------------------------------------------

type AppState = NonNullable<Awaited<ReturnType<typeof lockApplication>>>;
type Details = Record<string, unknown>;

const asStatus = (value: unknown): ApplicationStatus => (value === "INFO_REQUESTED" ? "INFO_REQUESTED" : "PENDING");
const asOpinion = (value: unknown): CoordinatorOpinion | null => (value === "ENDORSED" || value === "NOT_RECOGNIZED" ? value : null);
const asRole = (value: unknown): Role | null => (value === "STUDENT" || value === "TEACHER" || value === "ADMIN" ? value : null);
const asString = (value: unknown) => (typeof value === "string" ? value : null);

/** Bir kaydı geri alır; talebin hali kayıttaki gibi değilse (arada değiştiyse) geri çevirir. */
async function revert(tx: Tx, app: AppState, action: DecisionAction, details: Details): Promise<AppState> {
  switch (action) {
    case "application.approved": {
      if (app.status !== "APPROVED" || !sameTime(app.decidedAt, details.decidedAt)) throw new Refusal("tooLate");
      const user = await tx.user.findUniqueOrThrow({ where: { id: app.userId }, select: { role: true, schoolId: true } });
      const previousRole = asRole(details.previousRole);
      if (!previousRole || user.role !== details.role || user.schoolId !== details.schoolId) throw new Refusal("tooLate");
      // O arada sınıf açtıysa rolü geri almak sınıfı sahipsiz bırakırdı.
      if (app.decidedAt && (await tx.classroom.count({ where: { teacherId: app.userId, createdAt: { gte: app.decidedAt } } })) > 0) {
        throw new Refusal("tooLate");
      }
      await tx.user.update({ where: { id: app.userId }, data: { role: previousRole, schoolId: asString(details.previousSchoolId) } });
      const data = { status: asStatus(details.previousStatus), decidedById: null, decidedAt: null, schoolId: asString(details.previousApplicationSchoolId) };
      await tx.teacherApplication.update({ where: { id: app.id }, data });
      // Açılan okul kalır: listede bir okul daha olması zararsızdır, kaydı da defterde durur.
      return { ...app, ...data };
    }
    case "application.rejected": {
      if (app.status !== "REJECTED" || !sameTime(app.decidedAt, details.decidedAt)) throw new Refusal("tooLate");
      const data = { status: asStatus(details.previousStatus), rejectionNote: null, decidedById: null, decidedAt: null };
      await tx.teacherApplication.update({ where: { id: app.id }, data });
      return { ...app, ...data };
    }
    case "application.info_requested": {
      // Öğretmen o arada cevap verdiyse durum değişmiştir; geri alınmaz. Cevap alanlarına bilgi
      // isteme dokunmadığı için geri alma da dokunmaz.
      if (app.status !== "INFO_REQUESTED" || !sameTime(app.questionAt, details.questionAt)) throw new Refusal("tooLate");
      const previous = (details.previous ?? {}) as Details;
      const data = {
        status: "PENDING" as const,
        question: asString(previous.question),
        questionAt: parseDate(previous.questionAt),
      };
      await tx.teacherApplication.update({ where: { id: app.id }, data });
      return { ...app, ...data };
    }
    case "application.endorsed":
    case "application.not_recognized": {
      if (app.coordinatorOpinion !== asOpinion(details.opinion)) throw new Refusal("tooLate");
      const coordinatorOpinion = asOpinion(details.previousOpinion);
      await tx.teacherApplication.update({ where: { id: app.id }, data: { coordinatorOpinion } });
      return { ...app, coordinatorOpinion };
    }
  }
}

/**
 * "Geri al" (her kararın 5 saniyelik bildirimi): aynı kişinin bu talepteki son kararlarını, en
 * fazla undoWindowMs öncesine kadar, birlikte geri alır (decision-rules.ts entriesToUndo). Okulum'un
 * "onayla"sı görüş ve onayı birlikte yazar; ikisi birden döner. Onayda önceki rol ve okul geri
 * gelir, açılan okul kalır. Mail ve belge silme henüz yapılmadığı için geri alınacak yan etki yoktur.
 * Kayıt defterine "application.undone" yazılır.
 */
export async function undoDecision(input: { applicationId: string; actorId: string }): Promise<DecideResult<{ undone: DecisionAction[] }>> {
  const { applicationId, actorId } = input;
  return run("geri alınamadı", () =>
    db.$transaction(async (tx) => {
      let app = await lockApplication(tx, applicationId);
      if (!app) throw new Refusal("notFound");
      const now = new Date();
      const entries = await tx.auditLog.findMany({
        where: {
          target: auditTarget.application(applicationId),
          action: { in: [...decisionActions, "application.undone", "application.mail_sent"] satisfies AuditAction[] },
          createdAt: { gte: new Date(now.getTime() - 10 * undoWindowMs) },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
        select: { id: true, actorId: true, action: true, createdAt: true, details: true },
      });
      const batch = entriesToUndo(entries, actorId, now);
      if (batch.length === 0) throw new Refusal("tooLate");
      const undone: DecisionAction[] = [];
      for (const entry of batch) {
        const action = entry.action as DecisionAction;
        app = await revert(tx, app, action, (entry.details ?? {}) as Details);
        undone.push(action);
      }
      await writeAudit(tx, {
        actorId,
        action: "application.undone",
        target: auditTarget.application(applicationId),
        details: { userId: app.userId, undone: batch.map((e) => ({ id: e.id, action: e.action })) },
      });
      return { undone };
    }),
  );
}

// ---------------------------------------------------------------------------------------
// Kararın sonuçları: belge silme ve mail (ertelenmiş)
// ---------------------------------------------------------------------------------------

export type FinalizeResult = {
  /** Talep kesin kararda değil ya da geri al süresi bitmedi: hiçbir şey yapılmadı. */
  due: boolean;
  documentDeleted: boolean;
  mailSent: boolean;
};

/**
 * Kararı kesinleştirir (idempotent; kaç kez çağrılırsa çağrılsın bir kez etki eder):
 * talep hâlâ kararlı haldeyse ve geri al süresi bittiyse onay ya da retten sonra eklenen belgeyi
 * siler, karara uygun maili (onay, ret, bilgi isteme) bir kez gönderir ve "application.mail_sent"
 * yazar. Mail gönderilemezse işaret yazılmaz; saatlik temizlik mailRetryMs boyunca yeniden dener.
 */
export async function finalizeDecision(applicationId: string, now = new Date()): Promise<FinalizeResult> {
  // 1. Belge: kesin kararda her zaman silinir (mail gitmese de).
  let first: { decision: NonNullable<ReturnType<typeof decisionOf>>; documentDeleted: boolean } | null;
  try {
    first = await db.$transaction(async (tx) => {
      const app = await lockApplication(tx, applicationId);
      const decision = app ? decisionOf(app) : null;
      if (!app || !decision || !undoWindowOver(decision.at, now)) return null;
      const documentDeleted = deletesDocument(decision.kind)
        ? (await tx.applicationDocument.deleteMany({ where: { applicationId } })).count > 0
        : false;
      return { decision, documentDeleted };
    });
  } catch (error) {
    console.error("[talep] karar kesinleşemedi:", applicationId, errorText(error));
    return { due: false, documentDeleted: false, mailSent: false };
  }
  if (!first) return { due: false, documentDeleted: false, mailSent: false };
  const { decision: decided, documentDeleted } = first;
  if (now.getTime() - decided.at.getTime() > mailRetryMs) return { due: true, documentDeleted, mailSent: false };

  // 2. Mail: satır kilitliyken gönderilir ve işaret yazılır; aynı anda çalışan ikinci çağrı
  // kilidi bekler, sonra işareti görür ve göndermez.
  try {
    const mailSent = await db.$transaction(
      async (tx) => {
        const app = await lockApplication(tx, applicationId);
        const decision = app ? decisionOf(app) : null;
        if (!app || !decision || decision.at.getTime() !== decided.at.getTime()) return false;
        const target = auditTarget.application(applicationId);
        const sent = await tx.auditLog.findFirst({
          where: { action: "application.mail_sent", target, createdAt: { gte: decision.at } },
          select: { id: true },
        });
        if (sent) return false;

        const actorId =
          decision.kind === "infoRequested"
            ? (
                await tx.auditLog.findFirst({
                  where: { action: "application.info_requested", target },
                  orderBy: { createdAt: "desc" },
                  select: { actorId: true },
                })
              )?.actorId
            : app.decidedById;
        if (!actorId) return false;

        const user = await tx.user.findUniqueOrThrow({ where: { id: app.userId }, select: { email: true, displayName: true } });
        const school = app.schoolId ? await tx.school.findUnique({ where: { id: app.schoolId }, select: { name: true } }) : null;
        const recipient = { to: user.email, name: user.displayName, siteUrl: siteUrl() };
        const hadDocument = app.documentName !== null;
        const mail =
          decision.kind === "approved"
            ? approvedMail({ ...recipient, schoolName: school?.name ?? null, documentDeleted: hadDocument })
            : decision.kind === "rejected"
              ? rejectedMail({ ...recipient, note: app.rejectionNote ?? "", documentDeleted: hadDocument })
              : infoRequestedMail({ ...recipient, question: app.question ?? "" });
        await sendMail(mail);
        await writeAudit(tx, { actorId, action: "application.mail_sent", target, details: { kind: decision.kind, at: decision.at.toISOString() } });
        return true;
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
    return { due: true, documentDeleted, mailSent };
  } catch (error) {
    // Mail içeriği kayda yazılmaz; yalnızca talebin kimliği ve hatanın kısa adı.
    console.error("[talep] karar maili gönderilemedi:", applicationId, errorText(error));
    return { due: true, documentDeleted, mailSent: false };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * finalizeDecision'ı geri al süresinden biraz sonrasına kurar. İstek içindeyse after() ile (yanıt
 * gönderildikten sonra çalışır), istek dışındaysa (betik, test) zamanlayıcıyla. Sunucu o arada
 * kapanırsa iş saatlik temizlikte yapılır (finalizeDueDecisions).
 */
export function scheduleFinalize(applicationId: string, delayMs = finalizeDelayMs) {
  const task = async () => {
    await sleep(delayMs);
    await finalizeDecision(applicationId);
  };
  const report = (error: unknown) => console.error("[talep] karar kesinleşemedi:", applicationId, errorText(error));
  try {
    after(() => task().catch(report));
  } catch {
    setTimeout(() => void finalizeDecision(applicationId).catch(report), delayMs).unref();
  }
}

/**
 * Saatlik temizliğin güvenlik ağı: geri al süresi geçmiş kararlardan belgesi hâlâ duran ya da maili
 * henüz gitmemiş olanları kesinleştirir. Kaç talebe dokunulduğunu döner.
 */
export async function finalizeDueDecisions(now = new Date()): Promise<number> {
  const windowStart = new Date(now.getTime() - undoWindowMs);
  const mailSince = new Date(now.getTime() - mailRetryMs);
  const candidates = await db.teacherApplication.findMany({
    where: {
      OR: [
        { status: { in: ["APPROVED", "REJECTED"] }, decidedAt: { lte: windowStart }, document: { isNot: null } },
        { status: { in: ["APPROVED", "REJECTED"] }, decidedAt: { lte: windowStart, gte: mailSince } },
        { status: "INFO_REQUESTED", questionAt: { lte: windowStart, gte: mailSince } },
      ],
    },
    select: { id: true, status: true, decidedAt: true, questionAt: true, document: { select: { applicationId: true } } },
  });
  if (candidates.length === 0) return 0;
  const markers = await db.auditLog.findMany({
    where: { action: "application.mail_sent", target: { in: candidates.map((c) => auditTarget.application(c.id)) } },
    select: { target: true, createdAt: true },
  });
  let touched = 0;
  for (const candidate of candidates) {
    const decision = decisionOf(candidate);
    if (!decision) continue;
    const target = auditTarget.application(candidate.id);
    const mailed = markers.some((m) => m.target === target && m.createdAt >= decision.at);
    const needsMail = !mailed && decision.at >= mailSince;
    if (!candidate.document && !needsMail) continue;
    const result = await finalizeDecision(candidate.id, now);
    if (result.documentDeleted || result.mailSent) touched++;
  }
  return touched;
}
