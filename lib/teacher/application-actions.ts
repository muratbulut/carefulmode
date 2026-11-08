"use server";

// Öğretmenlik talebinin sunucu eylemleri (Tur 4, 17 son hali): talep gönderme, bilgi istenince
// cevap verme ve talebi geri çekme. Okul listesi eylemi yok (sabah soruları 26b): öğretmen okulun
// adını yazar, kimse ilçedeki okulları sorgulayamaz. Her eylem oturumu kendisi denetler
// ve kişiyi veritabanından yeniden okur (doğrulanmış e-posta, askıda değil); tarayıcıdan gelen
// hiçbir değere güvenilmez. Kişinin aynı anda en fazla bir açık talebi olur (PENDING ya da
// INFO_REQUESTED): kural, kişinin satırı kilitlenerek tek işlem içinde korunur.

import { refresh } from "next/cache";
import { formatClock, type FormState } from "@/lib/account/shared";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { format, getMessages } from "@/lib/i18n";
import { rateLimit, rateRules } from "@/lib/rate-limit";
import { cleanSchoolName, schoolNameKey } from "@/lib/school/names";
import { getUser } from "@/lib/session";
import { adminTeaches } from "./access";
import { parseAnswer, parseApplication, type ApplicationField } from "./application-rules";
import { readDocument, type CheckedDocument } from "./document";

const t = () => getMessages().teaching;

const generic = (): FormState => ({ status: "error", message: getMessages().auth.errors.generic });

function tooMany(retryAfterSec: number): FormState {
  return { status: "error", code: "rate_limited", retryAfterSec, message: format(getMessages().auth.errors.tooMany, { time: formatClock(retryAfterSec) }) };
}

/**
 * Kişinin satırını kilitleyerek okur: aynı kişinin aynı anda gelen iki isteği sırayla işlenir
 * (iki açık talep oluşmaz). Doğrulanmamış ya da askıya alınmış hesapta null.
 */
async function lockActiveUser(tx: Prisma.TransactionClient, userId: string) {
  const rows = await tx.$queryRaw<{ role: string; emailVerified: boolean; suspended: boolean }[]>`
    SELECT "role", "emailVerified", "suspended" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  const row = rows[0];
  return row && row.emailVerified && !row.suspended ? row : null;
}

const openStatuses = ["PENDING", "INFO_REQUESTED"] as const;

// ---------------------------------------------------------------------------
// Talep gönderme
// ---------------------------------------------------------------------------

function fieldErrors(fields: ApplicationField[]): FormState {
  const messages = t().errors;
  return { status: "error", fieldErrors: Object.fromEntries(fields.map((f) => [f, messages[f]])) };
}

function documentError(error: "size" | "type"): FormState {
  return { status: "error", fieldErrors: { document: t().document.errors[error] } };
}

type SubmitOutcome = "ok" | "forbidden" | "teacher" | "open" | "school";

export async function submitApplication(_prev: FormState, form: FormData): Promise<FormState> {
  const m = t();
  const session = await getUser();
  if (!session) return generic();

  const parsed = parseApplication({
    province: form.get("province"),
    district: form.get("district"),
    school: form.get("school"),
    newSchoolName: form.get("newSchoolName"),
    subject: form.get("subject"),
    institutionalEmail: form.get("institutionalEmail"),
  });
  if (!parsed.ok) return fieldErrors(parsed.errors);
  const input = parsed.value;
  const read = await readDocument(form.get("document"), m.document.fallbackName);
  if (!read.ok) return documentError(read.error);
  const document = read.document;

  const limit = await rateLimit.consume(rateRules.applicationActions, session.id);
  if (!limit.allowed) return tooMany(limit.retryAfterSec);

  const outcome = await db.$transaction(async (tx): Promise<SubmitOutcome> => {
    const user = await lockActiveUser(tx, session.id);
    if (!user) return "forbidden";
    if (user.role === "TEACHER" || (user.role === "ADMIN" && (await adminTeaches(tx, session.id)))) return "teacher";
    const open = await tx.teacherApplication.count({ where: { userId: session.id, status: { in: [...openStatuses] } } });
    if (open > 0) return "open";

    let schoolId: string | null = null;
    let newSchoolName: string | null = null;
    if (input.school.kind === "listed") {
      // Okul var olmalı ve seçilen il ve ilçede olmalı.
      const school = await tx.school.findUnique({ where: { id: input.school.id }, select: { province: true, district: true } });
      if (!school || school.province !== input.province || school.district !== input.district) return "school";
      schoolId = input.school.id;
    } else {
      // Yazılan ad ilçedeki bir okulun adıyla aynıysa (büyük-küçük harf ve boşluk farkı sayılmaz)
      // talep o okula bağlanır; değilse "yeni okul" olarak yönetime gider, yönetici eşler ya da ekler.
      const name = cleanSchoolName(input.school.name);
      const same = await tx.school.findUnique({
        where: { province_district_nameKey: { province: input.province, district: input.district, nameKey: schoolNameKey(name) } },
        select: { id: true },
      });
      if (same) schoolId = same.id;
      else newSchoolName = name;
    }

    await tx.teacherApplication.create({
      data: {
        userId: session.id,
        schoolId,
        newSchoolName,
        province: input.province,
        district: input.district,
        subject: input.subject,
        institutionalEmail: input.institutionalEmail,
        ...documentColumns(document),
      },
    });
    return "ok";
  });

  switch (outcome) {
    case "ok":
      refresh();
      return { status: "ok", message: m.sent };
    case "teacher":
      refresh();
      return { status: "error", message: m.errors.alreadyTeacher };
    case "open":
      refresh();
      return { status: "error", message: m.errors.alreadyOpen };
    case "school":
      return fieldErrors(["school"]);
    case "forbidden":
      return generic();
  }
}

/** Belge varsa talep satırına adı ve boyutu, ayrı tabloya içeriği yazılır. */
function documentColumns(document: CheckedDocument | null) {
  if (!document) return {};
  return {
    documentName: document.name,
    documentSize: document.size,
    document: { create: { mimeType: document.mimeType, data: document.data } },
  };
}

// ---------------------------------------------------------------------------
// Bilgi istendi: cevap
// ---------------------------------------------------------------------------

export async function answerApplication(_prev: FormState, form: FormData): Promise<FormState> {
  const m = t();
  const session = await getUser();
  if (!session) return generic();

  const read = await readDocument(form.get("document"), m.document.fallbackName);
  if (!read.ok) return documentError(read.error);
  const document = read.document;
  const answer = parseAnswer(form.get("answer"), !!document);
  if (!answer.ok) return { status: "error", fieldErrors: { answer: m.errors.answer } };

  const limit = await rateLimit.consume(rateRules.applicationActions, session.id);
  if (!limit.allowed) return tooMany(limit.retryAfterSec);

  const done = await db.$transaction(async (tx) => {
    if (!(await lockActiveUser(tx, session.id))) return false;
    // Yalnızca kişinin kendi, bilgi istenmiş talebi cevaplanır.
    const app = await tx.teacherApplication.findFirst({ where: { userId: session.id, status: "INFO_REQUESTED" }, select: { id: true } });
    if (!app) return false;
    // Durum koşulu güncellemede yeniden denetlenir: yönetici bu arada karar verdiyse karar ezilmez.
    const { count } = await tx.teacherApplication.updateMany({
      where: { id: app.id, status: "INFO_REQUESTED" },
      data: {
        status: "PENDING",
        answer: answer.value,
        answeredAt: new Date(),
        ...(document ? { documentName: document.name, documentSize: document.size } : {}),
      },
    });
    if (count === 0) return false;
    // Yeni belge eskisinin yerine geçer.
    if (document) {
      await tx.applicationDocument.upsert({
        where: { applicationId: app.id },
        create: { applicationId: app.id, mimeType: document.mimeType, data: document.data },
        update: { mimeType: document.mimeType, data: document.data, createdAt: new Date() },
      });
    }
    return true;
  });

  refresh();
  return done ? { status: "ok", message: m.answered } : generic();
}

// ---------------------------------------------------------------------------
// Talebi geri çekme
// ---------------------------------------------------------------------------

/** Açık talep silinir; belgesi de onunla birlikte silinir (ApplicationDocument, ON DELETE CASCADE). */
export async function withdrawApplication(): Promise<FormState> {
  const session = await getUser();
  if (!session) return generic();
  const limit = await rateLimit.consume(rateRules.applicationActions, session.id);
  if (!limit.allowed) return tooMany(limit.retryAfterSec);

  const count = await db.$transaction(async (tx) => {
    if (!(await lockActiveUser(tx, session.id))) return 0;
    // Durum koşulu silmede denetlenir: yönetici karar verdiyse talep artık açık değildir, silinmez.
    return (await tx.teacherApplication.deleteMany({ where: { userId: session.id, status: { in: [...openStatuses] } } })).count;
  });
  refresh();
  return count > 0 ? { status: "ok", message: t().withdrawn } : generic();
}
