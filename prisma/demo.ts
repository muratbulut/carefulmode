// Örnek veriyi (demo) ekler ya da siler. İçerik ve kuralları prisma/demo-data.ts'te.
//
//   node prisma/demo.ts add      şifre stdin'den (DEMO_PASSWORD; ekrana ve kayda yazılmaz)
//   node prisma/demo.ts remove
//
// Yerelde: npm run db:demo -- add < şifre-dosyası. Canlıda: GitHub → Actions → Yayın → Run workflow
// → demo-data ya da demo-data-remove (docker/server/demo-data.sh, migration imajında çalışır).
//
// "add" önce var olan örnek veriyi siler, sonra baştan ekler: tekrar çalıştırmak veriyi ilk haline
// döndürür ve tarihleri tazeler. Hepsi tek bir veritabanı işlemindedir; yarıda kalırsa hiçbir şey
// değişmez. Gerçek kullanıcıların verisine dokunulmaz: silinen her satır ya "demo-" kimlikli ya da
// bir örnek hesaba aittir (ör. örnek öğretmen hesabıyla açılan sınıf, örnek öğrencinin denemesi).
//
// Kayıt defteri silinmez. Örnek bir hesabın kayıt defterinde izi varsa (ör. örnek okul sorumlusuyla
// girilip bir talebe karar verildiyse) o hesap silinemez: askıya alınır, şifresi, oturumları, sınıf
// ve okul bağları kaldırılır, çıktıda "silinemedi" diye yazar. Aynı durum örnek bir hesabın gerçek
// bir talebe karar vermesinde ya da gerçek bir okulu, ipucunu, haberi eklemesinde de geçerlidir.
//
// Önkoşul: en az bir gerçek yönetici (ADMIN_EMAILS ile; örnek yönetici sayılmaz) ve başlangıç verisi (mahalleler, örnek lablar).
// Okulları, ipuçlarını ve haberleri ilk yönetici "eklemiş" görünür; talepleri o ya da örnek okul
// sorumlusu onaylamış görünür.

import { randomInt } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../lib/generated/prisma/client.ts";
import * as demo from "./demo-data.ts";
import type { DemoApplicant, DemoStudent } from "./demo-data.ts";

type Tx = Prisma.TransactionClient;

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const prefix = demo.demoIdPrefix;
const isDemo = { id: { startsWith: prefix } };
const notDemo = { NOT: isDemo };

/** Kullanıcıya gösterilen hata (yığın izi olmadan). */
class Refusal extends Error {}

// ---------------------------------------------------------------------------------------
// Silme
// ---------------------------------------------------------------------------------------

type Removed = {
  users: number;
  kept: string[];
  schools: number;
  keptSchools: string[];
  attempts: number;
  classes: number;
  applications: number;
  tips: number;
  news: number;
};

async function removeDemo(tx: Tx): Promise<Removed> {
  const demoUsers = await tx.user.findMany({ where: isDemo, select: { id: true, email: true } });
  const userIds = demoUsers.map((u) => u.id);
  const ownedOrDemo = (field: string) => ({ OR: [isDemo, { [field]: { in: userIds } }] });

  // Örnek hesaplara ait her şey: denemeler (olaylar onlarla gider), örnek öğretmenlerin sınıfları
  // (üyelikler ve ödevler onlarla gider), talepler (belgeler onlarla gider).
  const attempts = await tx.labAttempt.deleteMany({ where: ownedOrDemo("userId") });
  const classes = await tx.classroom.deleteMany({ where: ownedOrDemo("teacherId") });
  const applications = await tx.teacherApplication.deleteMany({ where: ownedOrDemo("userId") });
  const tipIds = (await tx.dailyTip.findMany({ where: isDemo, select: { id: true } })).map((t) => t.id);
  await tx.tipDay.deleteMany({ where: { tipId: { in: tipIds } } });
  const tips = await tx.dailyTip.deleteMany({ where: { id: { in: tipIds } } });
  const news = await tx.newsArticle.deleteMany({ where: isDemo });

  // Silinemeyecek hesaplar: kayıt defterinde ya da gerçek bir satırda (silinmeyen) izi olanlar.
  const referenced = new Set<string>();
  const collect = (ids: (string | null)[]) => ids.forEach((id) => id && referenced.add(id));
  const inUsers = { in: userIds };
  collect((await tx.auditLog.findMany({ where: { actorId: inUsers }, select: { actorId: true }, distinct: ["actorId"] })).map((r) => r.actorId));
  collect((await tx.teacherApplication.findMany({ where: { decidedById: inUsers }, select: { decidedById: true } })).map((r) => r.decidedById));
  collect((await tx.school.findMany({ where: { createdById: inUsers, ...notDemo }, select: { createdById: true } })).map((r) => r.createdById));
  collect((await tx.teamPermission.findMany({ where: { grantedById: inUsers }, select: { grantedById: true } })).map((r) => r.grantedById));
  collect((await tx.dailyTip.findMany({ where: { authorId: inUsers }, select: { authorId: true } })).map((r) => r.authorId));
  collect((await tx.newsArticle.findMany({ where: { authorId: inUsers }, select: { authorId: true } })).map((r) => r.authorId));
  const keptIds = userIds.filter((id) => referenced.has(id));
  const removable = userIds.filter((id) => !referenced.has(id));

  if (keptIds.length > 0) {
    const where = { userId: { in: keptIds } };
    await tx.session.deleteMany({ where });
    await tx.account.deleteMany({ where });
    await tx.teamPermission.deleteMany({ where });
    await tx.classroomMembership.deleteMany({ where });
    await tx.trainingProgress.deleteMany({ where });
    await tx.earnedBadge.deleteMany({ where });
    await tx.tipView.deleteMany({ where });
    await tx.school.updateMany({ where: { coordinatorId: { in: keptIds } }, data: { coordinatorId: null } });
    await tx.user.updateMany({
      where: { id: { in: keptIds } },
      data: { suspended: true, role: "STUDENT", schoolId: null, deletionScheduledAt: null, lastActiveAt: null },
    });
  }
  const users = await tx.user.deleteMany({ where: { id: { in: removable } } });

  // Okullar: örnek okullar ve örnek bir talebin onayıyla açılan okullar ("yeni okul" talebi).
  // Gerçek bir öğretmeni ya da talebi olan okul kalır.
  const created = await tx.auditLog.findMany({
    where: { action: "school.created", details: { path: ["applicationId"], string_starts_with: prefix } },
    select: { target: true },
  });
  const schoolIds = new Set([
    ...(await tx.school.findMany({ where: isDemo, select: { id: true } })).map((s) => s.id),
    ...created.map((r) => r.target.replace(/^school:/, "")),
  ]);
  let schools = 0;
  const keptSchools: string[] = [];
  for (const id of schoolIds) {
    const school = await tx.school.findUnique({ where: { id }, select: { name: true, _count: { select: { teachers: true, applications: true } } } });
    if (!school) continue;
    if (school._count.teachers > 0 || school._count.applications > 0) {
      keptSchools.push(school.name);
      continue;
    }
    await tx.school.delete({ where: { id } });
    schools++;
  }

  const kept = demoUsers.filter((u) => keptIds.includes(u.id)).map((u) => u.email);
  return { users: users.count, kept, schools, keptSchools, attempts: attempts.count, classes: classes.count, applications: applications.count, tips: tips.count, news: news.count };
}

// ---------------------------------------------------------------------------------------
// Ekleme
// ---------------------------------------------------------------------------------------

type Labs = {
  /** questions: soru kartlarının kimliği ve sırası (eğitim ancak hepsi cevaplanınca biter). */
  training: { id: string; version: number; total: number; questions: { id: string; index: number }[] } | null;
  scenario: { id: string; version: number } | null;
};

const ago = (now: Date, days: number) => new Date(now.getTime() - days * DAY);

async function freeJoinCode(tx: Tx): Promise<string> {
  const { joinCodeAlphabet: alphabet, joinCodeLength: length } = demo;
  for (;;) {
    const code = Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join("");
    if (!(await tx.classroom.findUnique({ where: { joinCode: code }, select: { id: true } }))) return code;
  }
}

/** Yayındaki eğitim ve senaryo labı; senaryo içeriği örnek dosyayla aynı değilse denemeler eklenmez. */
async function readLabs(db: PrismaClient): Promise<{ labs: Labs; notes: string[] }> {
  const notes: string[] = [];
  const published = async (slug: string) => {
    const lab = await db.lab.findUnique({ where: { slug }, select: { id: true, status: true, publishedVersion: true } });
    if (!lab || lab.status !== "PUBLISHED" || lab.publishedVersion === null) return null;
    const version = await db.labVersion.findUnique({ where: { labId_version: { labId: lab.id, version: lab.publishedVersion } }, select: { content: true } });
    return version ? { id: lab.id, version: lab.publishedVersion, content: version.content as Record<string, unknown> } : null;
  };

  let training: Labs["training"] = null;
  const t = await published(demo.trainingSlug);
  const cards = t && Array.isArray(t.content.cards) ? (t.content.cards as demo.TrainingCard[]) : [];
  if (t && cards.length > 0) {
    training = { id: t.id, version: t.version, total: cards.length, questions: demo.questionCards(cards) };
  } else notes.push(`Eğitim labı (${demo.trainingSlug}) yayında değil; eğitim ilerlemesi eklenmedi.`);

  let scenario: Labs["scenario"] = null;
  const s = await published(demo.scenarioSlug);
  const example = JSON.parse(await readFile(path.join(import.meta.dirname, "..", "labs", "examples", `${demo.scenarioSlug}.json`), "utf8")) as { content: unknown };
  if (s && isDeepStrictEqual(s.content, example.content)) scenario = { id: s.id, version: s.version };
  else if (s) notes.push(`Senaryo labının (${demo.scenarioSlug}) yayındaki içeriği örnek dosyadan farklı; raporlar tutmayacağı için denemeler eklenmedi.`);
  else notes.push(`Senaryo labı (${demo.scenarioSlug}) yayında değil; denemeler eklenmedi.`);
  if (!training) scenario = null;
  return { labs: { training, scenario }, notes };
}

function allEmails(): string[] {
  return [
    ...demo.demoTeachers.map((t) => t.email),
    ...demo.demoApplicants.map((a) => `${demo.emailSlug(a.name)}@${demo.demoEmailDomain}`),
    ...demo.demoClasses.flatMap((c) => c.students.map(demo.studentEmail)),
    ...demo.demoLoneStudents.map(demo.studentEmail),
    demo.demoAdmin.email,
  ];
}

async function addDemo(db: PrismaClient, password: string) {
  const now = new Date();

  // --- Önkoşullar ve çakışmalar (hiçbir şey yazılmadan) -----------------------------------
  const admin = await db.user.findFirst({ where: { role: "ADMIN", ...notDemo }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!admin) throw new Refusal("Yönetici hesabı yok. Önce ADMIN_EMAILS'teki adresle kayıt olup yönetim paneline bir kez girilmeli.");

  const neighborhoods = new Map((await db.neighborhood.findMany({ select: { id: true, slug: true } })).map((n) => [n.slug, n.id]));
  const needed = new Set([demo.assignmentNeighborhood, ...demo.demoTips.map((t) => t.neighborhood), ...demo.demoArticles.flatMap((a) => (a.neighborhood ? [a.neighborhood] : []))]);
  const missing = [...needed].filter((slug) => !neighborhoods.has(slug));
  if (missing.length > 0) throw new Refusal(`Başlangıç verisi eksik (mahalle: ${missing.join(", ")}). Önce prisma db seed çalışmalı.`);
  const neighborhood = (slug: string) => neighborhoods.get(slug)!;

  const emails = allEmails();
  if (new Set(emails).size !== emails.length) throw new Refusal("Örnek verideki e-postalar tekrar ediyor.");
  const taken = await db.user.findMany({ where: { email: { in: emails }, ...notDemo }, select: { email: true } });
  if (taken.length > 0) throw new Refusal(`Bu adreslerle örnek olmayan hesap var: ${taken.map((u) => u.email).join(", ")}. Örnek veri eklenmedi.`);
  for (const school of demo.demoSchools) {
    const same = await db.school.findFirst({ where: { province: school.province, district: school.district, nameKey: demo.nameKeyOf(school.name), ...notDemo }, select: { id: true } });
    if (same) throw new Refusal(`${school.province} / ${school.district} içinde "${school.name}" adlı gerçek bir okul var. Örnek veri eklenmedi.`);
  }
  const slugTaken = await db.newsArticle.findMany({ where: { slug: { in: demo.demoArticles.map((a) => a.slug) }, ...notDemo }, select: { slug: true } });
  if (slugTaken.length > 0) throw new Refusal(`Bu adreslerde gerçek haber var: ${slugTaken.map((a) => a.slug).join(", ")}. Örnek veri eklenmedi.`);

  const { labs, notes } = await readLabs(db);
  // Her hesabın kendi tuzu olsun diye şifre hesap başına ayrı özetlenir.
  const passwordHashes = new Map(await Promise.all(demo.demoLogins.map(async (key) => [key, await demo.hashPassword(password)] as const)));

  // Gerçek bir haberin olduğu yayın haftasına örnek haber konmaz.
  const articleWeeks = new Map<string, Date | null>();
  for (const article of demo.demoArticles) {
    if (article.week === null) {
      articleWeeks.set(article.key, null);
      continue;
    }
    const at = demo.fridayAt(now, article.week);
    const busy = await db.newsArticle.findFirst({
      where: { status: { in: ["SCHEDULED", "PUBLISHED"] }, publishedAt: { gte: new Date(at.getTime() - DAY), lt: new Date(at.getTime() + DAY) }, ...notDemo },
      select: { id: true },
    });
    if (busy) notes.push(`"${article.title}" eklenmedi: o hafta gerçek bir haber var.`);
    else articleWeeks.set(article.key, at);
  }

  return db.$transaction(
    async (tx) => {
      const removed = await removeDemo(tx);
      const counts = { admins: 0, schools: 0, teachers: 0, applicants: 0, students: 0, classes: 0, attempts: 0, live: 0, tips: 0, news: 0 };

      // --- Okullar ----------------------------------------------------------------------------
      const schoolIds = new Map<string, string>();
      for (const school of demo.demoSchools) {
        const id = demo.demoId("school", school.key);
        await tx.school.create({
          data: { id, name: school.name, nameKey: demo.nameKeyOf(school.name), province: school.province, district: school.district, createdById: admin.id, createdAt: ago(now, school.createdDaysAgo) },
        });
        schoolIds.set(school.key, id);
        counts.schools++;
      }
      const schoolOf = (key: string) => demo.demoSchools.find((s) => s.key === key)!;

      // Kullanıcı: önceki silmede kalan (askıya alınmış) örnek hesap varsa yeniden kurulur.
      const putUser = async (data: Prisma.UserUncheckedCreateInput & { id: string }) => {
        const row = { theme: "DARK" as const, suspended: false, deletionScheduledAt: null, ...data, emailVerified: true };
        await tx.user.upsert({ where: { id: data.id }, create: row, update: row });
      };
      const putLogin = async (userId: string, key: string) => {
        const password = passwordHashes.get(key as (typeof demo.demoLogins)[number]);
        if (!password) return;
        await tx.account.create({ data: { id: demo.demoId("account", key), accountId: userId, providerId: "credential", userId, password } });
      };

      // --- Örnek yönetici (sunum için; kayıt defterine yazılmaz) -------------------------------
      {
        const id = demo.demoId("user", demo.demoAdmin.key);
        const createdAt = ago(now, 40);
        await putUser({
          id,
          displayName: demo.demoAdmin.name,
          email: demo.demoAdmin.email,
          role: "ADMIN",
          birthYear: demo.demoAdmin.birthYear,
          educationStatus: "GRADUATED",
          gradeLevel: "Lisans mezunu",
          avatar: demo.demoAdmin.avatar,
          kvkkConsentAt: createdAt,
          createdAt,
          lastActiveAt: new Date(now.getTime() - 3 * HOUR),
        });
        await putLogin(id, demo.demoAdmin.key);
        counts.admins++;
      }

      // --- Öğretmenler ve onaylanmış talepleri ---------------------------------------------------
      const teacherIds = new Map<string, string>();
      const coordinatorId = demo.demoId("user", demo.demoCoordinator.teacher);
      for (const teacher of demo.demoTeachers) {
        const id = demo.demoId("user", teacher.key);
        const createdAt = ago(now, teacher.approvedDaysAgo + 2);
        await putUser({
          id,
          displayName: teacher.name,
          email: teacher.email,
          role: "TEACHER",
          birthYear: teacher.birthYear,
          educationStatus: "GRADUATED",
          gradeLevel: "Lisans mezunu",
          schoolId: schoolIds.get(teacher.school)!,
          avatar: teacher.avatar,
          kvkkConsentAt: createdAt,
          createdAt,
          lastActiveAt: new Date(now.getTime() - (2 + teacher.approvedDaysAgo) * HOUR),
        });
        await putLogin(id, teacher.key);
        teacherIds.set(teacher.key, id);
        counts.teachers++;
      }
      // Okul sorumlusu (onay ondadır); sorumlunun kendi talebini yönetim onaylamıştır.
      await tx.school.update({ where: { id: schoolIds.get(demo.demoCoordinator.school)! }, data: { coordinatorId, coordinatorApproves: true } });
      for (const teacher of demo.demoTeachers) {
        const school = schoolOf(teacher.school);
        const decidedAt = ago(now, teacher.approvedDaysAgo);
        await tx.teacherApplication.create({
          data: {
            id: demo.demoId("application", teacher.key),
            userId: teacherIds.get(teacher.key)!,
            schoolId: schoolIds.get(teacher.school)!,
            province: school.province,
            district: school.district,
            subject: teacher.subject,
            documentName: "gorev-yeri-belgesi.pdf",
            documentSize: 48_213,
            status: "APPROVED",
            checks: { schoolReal: true, emailDomain: false, documentReadable: true, subjectFits: true },
            decidedById: teacher.approvedBy === "admin" ? admin.id : coordinatorId,
            decidedAt,
            createdAt: new Date(decidedAt.getTime() - 20 * HOUR),
            updatedAt: decidedAt,
          },
        });
      }

      // --- Bekleyen, bilgi istenen, reddedilen talepler ------------------------------------------
      for (const applicant of demo.demoApplicants) {
        const id = demo.demoId("user", applicant.key);
        const createdAt = ago(now, applicant.createdDaysAgo);
        await putUser({
          id,
          displayName: applicant.name,
          email: `${demo.emailSlug(applicant.name)}@${demo.demoEmailDomain}`,
          role: "STUDENT",
          birthYear: applicant.birthYear,
          educationStatus: "GRADUATED",
          gradeLevel: "Lisans mezunu",
          avatar: applicant.avatar,
          kvkkConsentAt: createdAt,
          createdAt,
          lastActiveAt: new Date(now.getTime() - (applicant.application.sentHoursAgo - 1) * HOUR),
        });
        await createApplication(tx, applicant, id, schoolIds, admin.id, now);
        counts.applicants++;
      }

      // --- Sınıflar ve öğrenciler ---------------------------------------------------------------
      let studentIndex = 0;
      const studentIds: string[] = [];
      const putStudent = async (student: DemoStudent, level: string, classCreatedAt: Date) => {
        const id = demo.demoId("user", student.key);
        const timeline = demo.studentTimeline(student, classCreatedAt, 1000 + studentIndex, now);
        const profile = demo.studentProfile(level, now);
        await putUser({
          id,
          displayName: student.name,
          email: demo.studentEmail(student),
          role: "STUDENT",
          birthYear: profile.birthYear,
          educationStatus: "STUDYING",
          gradeLevel: profile.gradeLevel,
          avatar: demo.studentAvatars[studentIndex % demo.studentAvatars.length],
          theme: student.theme ?? "DARK",
          kvkkConsentAt: timeline.createdAt,
          createdAt: timeline.createdAt,
          lastActiveAt: timeline.lastActiveAt,
        });
        await putLogin(id, student.key);
        const created = await createProgress(tx, id, student.key, timeline, labs);
        counts.attempts += created.finished;
        counts.live += created.live;
        studentIds.push(id);
        studentIndex++;
        counts.students++;
        return { id, joinedAt: timeline.joinedAt };
      };

      for (const group of demo.demoClasses) {
        const classId = demo.demoId("class", group.key);
        const createdAt = ago(now, group.createdDaysAgo);
        await tx.classroom.create({
          data: { id: classId, name: group.name, level: group.level, teacherId: teacherIds.get(group.teacher)!, joinCode: await freeJoinCode(tx), createdAt },
        });
        counts.classes++;
        for (const student of group.students) {
          const { id, joinedAt } = await putStudent(student, group.level, createdAt);
          await tx.classroomMembership.create({ data: { classroomId: classId, userId: id, joinedAt } });
        }
        if (group.assignmentDueInDays !== null) {
          await tx.assignment.create({
            data: {
              id: demo.demoId("assignment", group.key),
              classroomId: classId,
              neighborhoodId: neighborhood(demo.assignmentNeighborhood),
              dueDate: demo.dueDateIn(now, group.assignmentDueInDays),
              createdAt: new Date(createdAt.getTime() + 2 * DAY),
            },
          });
        }
      }
      for (const student of demo.demoLoneStudents) await putStudent(student, "7", ago(now, student.createdDaysAgo));

      // --- Günün ipucu: havuz, geçmiş günler, öğrencilerin bakışları -------------------------------
      const tipIds = new Map<string, string>();
      for (const [index, tip] of demo.demoTips.entries()) {
        const id = demo.demoId("tip", tip.key);
        const labId = tip.lab === demo.trainingSlug ? (labs.training?.id ?? null) : null;
        await tx.dailyTip.create({
          data: { id, text: tip.text, reason: tip.reason, neighborhoodId: neighborhood(tip.neighborhood), labId, status: tip.status, authorId: admin.id, createdAt: ago(now, 20 - index), updatedAt: ago(now, 20 - index) },
        });
        tipIds.set(tip.key, id);
        counts.tips++;
      }
      const pool = demo.demoTips.filter((t) => t.status === "POOL").map((t) => tipIds.get(t.key)!);
      const shown = Array.from({ length: demo.tipHistoryDays }, (_, i) => ({ date: demo.dayKeyToDate(demo.turkeyDayKey(ago(now, i + 1))), tipId: pool[i % pool.length] }));
      await tx.tipDay.createMany({ data: shown, skipDuplicates: true });
      const days = await tx.tipDay.findMany({ where: { date: { in: shown.map((s) => s.date) } }, select: { date: true, tipId: true } });
      await tx.tipView.createMany({
        data: studentIds.flatMap((userId, i) =>
          days.filter((_, d) => (i + d) % 3 === 0).map((day) => ({ userId, tipId: day.tipId, date: day.date, reasonViewed: i % 2 === 0 })),
        ),
        skipDuplicates: true,
      });

      // --- Gündem -------------------------------------------------------------------------------
      for (const article of demo.demoArticles) {
        if (!articleWeeks.has(article.key)) continue;
        const publishedAt = articleWeeks.get(article.key)!;
        const createdAt = publishedAt ? new Date(Math.min(publishedAt.getTime(), now.getTime()) - 3 * DAY) : ago(now, 2);
        await tx.newsArticle.create({
          data: {
            id: demo.demoId("news", article.key),
            slug: article.slug,
            title: article.title,
            summary: article.summary,
            content: article.content,
            sourceName: article.sourceName,
            sourceUrl: article.sourceUrl,
            neighborhoodId: article.neighborhood ? neighborhood(article.neighborhood) : null,
            relatedLabId: article.relatedLab === demo.scenarioSlug ? (labs.scenario?.id ?? null) : null,
            status: article.status,
            publishedAt,
            readCount: article.readCount,
            authorId: admin.id,
            createdAt,
            updatedAt: createdAt,
          },
        });
        counts.news++;
      }

      return { removed, counts, notes };
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}

async function createApplication(tx: Tx, applicant: DemoApplicant, userId: string, schoolIds: Map<string, string>, adminId: string, now: Date) {
  const a = applicant.application;
  const listed = "listed" in a.school ? demo.demoSchools.find((s) => s.key === (a.school as { listed: string }).listed)! : null;
  const place = listed ? { province: listed.province, district: listed.district } : (a.school as { province: string; district: string });
  const schoolName = listed ? listed.name : (a.school as { newName: string }).newName;
  const createdAt = new Date(now.getTime() - a.sentHoursAgo * HOUR);
  const document = demo.applicationDocument(applicant, schoolName, `${place.province} / ${place.district}`);
  const questionAt = a.question ? ago(now, a.question.daysAgo) : null;
  const decidedAt = a.rejection ? ago(now, a.rejection.daysAgo) : null;
  const id = demo.demoId("application", applicant.key);
  await tx.teacherApplication.create({
    data: {
      id,
      userId,
      schoolId: listed ? schoolIds.get(listed.key)! : null,
      newSchoolName: listed ? null : schoolName,
      province: place.province,
      district: place.district,
      subject: a.subject,
      institutionalEmail: a.institutionalEmail,
      documentName: a.document?.name ?? a.rejection?.documentName ?? null,
      documentSize: document?.data.length ?? a.rejection?.documentSize ?? null,
      status: a.status,
      question: a.question?.text ?? null,
      questionAt,
      decidedById: decidedAt ? adminId : null,
      decidedAt,
      rejectionNote: a.rejection?.note ?? null,
      createdAt,
      updatedAt: decidedAt ?? questionAt ?? createdAt,
    },
  });
  if (document) await tx.applicationDocument.create({ data: { applicationId: id, mimeType: document.mimeType, data: new Uint8Array(document.data), createdAt } });
}

/** Eğitim ilerlemesi ve senaryo denemeleri; eklenen biten ve yarım deneme sayısını döner. */
async function createProgress(tx: Tx, userId: string, key: string, timeline: demo.Timeline, labs: Labs) {
  const none = { finished: 0, live: 0 };
  const training = labs.training;
  const progress = timeline.training;
  if (!training || !progress) return none;
  const done = progress.completedAt !== null;
  const cardIndex = done ? training.total : Math.floor(training.total * progress.cardFraction);
  // Geçtiği soru kartları cevaplanmıştır (oynatıcı cevapsız ilerletmez).
  const answeredCards = training.questions.filter((q) => done || q.index < cardIndex).map((q) => q.id);
  await tx.trainingProgress.create({
    data: { userId, labId: training.id, cardIndex, answeredCards, completedAt: progress.completedAt, updatedAt: progress.updatedAt },
  });

  const scenario = labs.scenario;
  if (!scenario) return none;
  const writeEvents = async (attemptId: string, events: demo.DemoEvent[], startedAt: Date, gaps: number[]) => {
    let at = startedAt.getTime();
    await tx.labEvent.createMany({
      data: events.map((event, seq) => {
        at += gaps[seq] * 1000;
        const { type, ...data } = event;
        return { attemptId, seq, type, data, createdAt: new Date(at) };
      }),
    });
  };
  for (const [index, attempt] of timeline.attempts.entries()) {
    const profile = demo.attemptProfiles[attempt.profile];
    const report = profile.report as { score: number };
    const id = demo.demoId("attempt", `${key}-${index + 1}`);
    await tx.labAttempt.create({
      data: {
        id,
        userId,
        labId: scenario.id,
        labVersion: scenario.version,
        status: profile.status,
        reportScore: report.score,
        startedAt: attempt.startedAt,
        endedAt: attempt.endedAt,
        resultReport: profile.report as Prisma.InputJsonValue,
      },
    });
    await writeEvents(id, profile.events, attempt.startedAt, attempt.eventGapsSec);
  }
  if (timeline.inProgress) {
    const id = demo.demoId("attempt", `${key}-live`);
    await tx.labAttempt.create({ data: { id, userId, labId: scenario.id, labVersion: scenario.version, status: "IN_PROGRESS", startedAt: timeline.inProgress.startedAt } });
    await writeEvents(id, demo.inProgressEvents, timeline.inProgress.startedAt, timeline.inProgress.eventGapsSec);
  }
  return { finished: timeline.attempts.length, live: timeline.inProgress ? 1 : 0 };
}

// ---------------------------------------------------------------------------------------
// Komut satırı
// ---------------------------------------------------------------------------------------

async function readPassword(): Promise<string> {
  const { min, max } = demo.demoPasswordLimits;
  if (process.stdin.isTTY) throw new Refusal(`Şifre stdin'den gelmeli (DEMO_PASSWORD, en az ${min} karakter).`);
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const password = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
  if (password.length < min || password.length > max) {
    throw new Refusal(`DEMO_PASSWORD ${min}-${max} karakter olmalı (gelen: ${password.length === 0 ? "boş" : "uygun değil"}). Örnek veri eklenmedi.`);
  }
  return password;
}

function printRemoved(removed: Removed, title: string) {
  console.log(
    `${title}: ${removed.users} hesap, ${removed.schools} okul, ${removed.classes} sınıf, ${removed.applications} talep, ${removed.attempts} deneme, ${removed.tips} ipucu, ${removed.news} haber.`,
  );
  if (removed.kept.length > 0) {
    console.log(`Silinemeyen örnek hesaplar (kayıt defterinde izi var; askıya alındı, şifresi ve bağları kaldırıldı): ${removed.kept.join(", ")}`);
  }
  if (removed.keptSchools.length > 0) console.log(`Silinmeyen okullar (gerçek öğretmeni ya da talebi var): ${removed.keptSchools.join(", ")}`);
}

async function main() {
  const command = process.argv[2];
  if (command !== "add" && command !== "remove") throw new Refusal("Kullanım: node prisma/demo.ts add|remove (add, şifreyi stdin'den okur).");
  // Yerelde adres .env'den gelir (prisma.config.ts gibi); ortamda tanımlıysa o geçerlidir.
  if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Refusal("DATABASE_URL tanımlı değil.");
  const password = command === "add" ? await readPassword() : "";
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    if (command === "remove") {
      printRemoved(await db.$transaction((tx) => removeDemo(tx), { timeout: 120_000, maxWait: 10_000 }), "Örnek veri silindi");
      return;
    }
    const { removed, counts, notes } = await addDemo(db, password);
    if (removed.users + removed.schools + removed.tips + removed.news > 0 || removed.kept.length > 0) printRemoved(removed, "Önceki örnek veri silindi");
    console.log(
      `Örnek veri eklendi: ${counts.admins} yönetici, ${counts.schools} okul, ${counts.teachers} öğretmen, ${counts.applicants} başvuran, ${counts.students} öğrenci, ${counts.classes} sınıf, ${counts.attempts} biten ve ${counts.live} yarım lab denemesi, ${counts.tips} ipucu, ${counts.news} haber.`,
    );
    for (const note of notes) console.log(`Not: ${note}`);
    console.log(`Giriş yapılabilen hesaplar (şifre: DEMO_PASSWORD): ${demo.demoLogins.map((key) => `${key}@${demo.demoEmailDomain}`).join(", ")}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Refusal) console.error(error.message);
  else console.error("Örnek veri işlemi başarısız:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
