// Örnek veri (prisma/demo-data.ts) uygulamanın kurallarıyla tutarlı mı? Betik migration imajında
// lib/'e bağlanmadan çalıştığı için kuralları kendisi tekrarlar; bu test ikisini karşılaştırır.

import { readFileSync } from "node:fs";
import { verifyPassword } from "better-auth/crypto";
import { describe, expect, it } from "vitest";
import { avatars, isAvatarCode } from "@/lib/avatars";
import { trapMinSample } from "@/lib/admin/overview-model";
import { classLevels, classNameOk, isJoinCode, joinCodeAlphabet, joinCodeLength } from "@/lib/classroom/rules";
import { parseDueDate } from "@/lib/classroom/teacher-rules";
import { parseScenario, parseTraining } from "@/lib/lab/content";
import { batchEventSchema, reduceEvents } from "@/lib/lab/events";
import { scoreScenario } from "@/lib/lab/scoring";
import { quizOf } from "@/lib/lab/training";
import { isUndeliverable } from "@/lib/mail";
import {
  articleContentSchema,
  articleDraftContentSchema,
  fridayPublishTime,
  isDraftSlug,
  isTrustedSourceUrl,
  newsLimits,
  readiness,
  turkeyDateKey,
  upcomingFridays,
} from "@/lib/news/content";
import { isPlace } from "@/lib/school/places";
import { schoolNameKey, schoolNameOk } from "@/lib/school/names";
import { applicationLimits } from "@/lib/teacher/application-rules";
import { questionLimits, rejectionNoteLimits } from "@/lib/teacher/decision-rules";
import { detectDocumentType, documentRules } from "@/lib/teacher/document";
import { reasonError, textError } from "@/lib/tips/rules";
import { turkeyDay } from "@/lib/tips/schedule";
import * as demo from "@/prisma/demo-data";

const example = (slug: string) => JSON.parse(readFileSync(`labs/examples/${slug}.json`, "utf8")) as { content: unknown };
const now = new Date("2026-10-12T09:30:00Z");
const allStudents = [...demo.demoClasses.flatMap((c) => c.students), ...demo.demoLoneStudents];
const applicantEmail = (a: demo.DemoApplicant) => `${demo.emailSlug(a.name)}@${demo.demoEmailDomain}`;
const allEmails = [...demo.demoTeachers.map((t) => t.email), ...demo.demoApplicants.map(applicantEmail), ...allStudents.map(demo.studentEmail), demo.demoAdmin.email];
const userKeys = [...demo.demoTeachers, ...demo.demoApplicants, ...allStudents, demo.demoAdmin].map((u) => u.key);

describe("örnek veri: lab denemeleri", () => {
  const content = parseScenario(example(demo.scenarioSlug).content);

  it("raporlar puanlamanın bu olaylardan çıkardığıyla aynı", () => {
    expect(content).not.toBeNull();
    for (const [key, profile] of Object.entries(demo.attemptProfiles)) {
      const report = scoreScenario(content!, reduceEvents(profile.events));
      expect(profile.report, key).toEqual(report);
      expect(profile.status, key).toBe(report.status === "hacked" ? "HACKED" : "COMPLETED");
    }
  });

  it("olaylar oynatıcının gönderebildiği biçimde, öğeler ve görevler içerikte var", () => {
    const items = new Set(content!.items.map((i) => i.id));
    const tasks = new Set(content!.tasks.map((t) => t.id));
    for (const event of [...Object.values(demo.attemptProfiles).flatMap((p) => p.events), ...demo.inProgressEvents]) {
      if (event.type === "link_clicked" || event.type === "info_entered") expect(items.has(event.item)).toBe(true);
      else expect(batchEventSchema.safeParse(event).success, JSON.stringify(event)).toBe(true);
      if ("item" in event) expect(items.has(event.item)).toBe(true);
      if (event.type === "answer") expect(tasks.has(event.task)).toBe(true);
    }
  });

  it("eğitimin soru kartları oynatıcınınkiyle aynı", () => {
    const training = parseTraining(example(demo.trainingSlug).content);
    expect(training).not.toBeNull();
    const expected = training!.cards.flatMap((card, index) => (quizOf(card) ? [{ id: card.id, index }] : []));
    expect(demo.questionCards(training!.cards)).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
  });

  it("yönetim özetinde \"en çok tuzağa düşülen\" ve sınıf oranları dolu görünür", () => {
    const finished = allStudents.flatMap((s) => s.attempts ?? []);
    expect(finished.length).toBeGreaterThanOrEqual(trapMinSample);
    expect(finished.filter((p) => demo.attemptProfiles[p].status === "HACKED").length).toBeGreaterThan(0);
    // 7-A ödevin yarısından fazlasını bitirmiş (Okulum'da 5. adım), 5-A yarısının altında.
    const share = (key: string) => {
      const group = demo.demoClasses.find((c) => c.key === key)!;
      return group.students.filter((s) => s.training === "done" && (s.attempts?.length ?? 0) > 0).length / group.students.length;
    };
    expect(share("7a")).toBeGreaterThanOrEqual(0.5);
    expect(share("5a")).toBeLessThan(0.5);
    // Senaryo denemesi olan herkes eğitimi bitirmiş (senaryo eğitimden sonra açılır).
    for (const s of allStudents) if (s.attempts?.length || s.inProgress) expect(s.training, s.key).toBe("done");
  });

  it("zaman çizelgesi sıralı ve geçmişte", () => {
    allStudents.forEach((student, index) => {
      const group = demo.demoClasses.find((c) => c.students.includes(student));
      const created = new Date(now.getTime() - (group?.createdDaysAgo ?? 6) * 86_400_000);
      const t = demo.studentTimeline(student, created, 1000 + index, now);
      expect(t.createdAt < t.joinedAt, student.key).toBe(true);
      if (t.training) expect(t.training.updatedAt > t.joinedAt, student.key).toBe(true);
      let previous = t.training?.updatedAt ?? t.joinedAt;
      for (const a of t.attempts) {
        expect(a.startedAt > previous, student.key).toBe(true);
        expect(a.endedAt > a.startedAt && a.endedAt < now, student.key).toBe(true);
        previous = a.endedAt;
      }
      if (student.today) expect(now.getTime() - t.attempts.at(-1)!.endedAt.getTime()).toBeLessThan(6 * 3_600_000);
      expect(t.lastActiveAt <= now).toBe(true);
    });
  });
});

describe("örnek veri: hesaplar, okullar, sınıflar", () => {
  it("kimlikler \"demo-\" önekli, uygulamanın kimlik kuralına uyuyor ve tekrar etmiyor", () => {
    expect(new Set(userKeys).size).toBe(userKeys.length);
    const ids = [
      ...userKeys.map((k) => demo.demoId("user", k)),
      ...allStudents.flatMap((s) => [demo.demoId("attempt", `${s.key}-live`), ...(s.attempts ?? []).map((_, i) => demo.demoId("attempt", `${s.key}-${i + 1}`))]),
      ...demo.demoClasses.map((c) => demo.demoId("class", c.key)),
      ...demo.demoSchools.map((s) => demo.demoId("school", s.key)),
      ...demo.demoTips.map((t) => demo.demoId("tip", t.key)),
      ...demo.demoArticles.map((a) => demo.demoId("news", a.key)),
    ];
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
      expect(demo.isDemoId(id)).toBe(true);
    }
    // Uygulamanın ürettiği kimlikler (cuid) örnek sayılmaz.
    expect(demo.isDemoId("cmgz8x2k10000qv7k3f1d9a2b")).toBe(false);
  });

  it("e-postalar tekrar etmiyor, hepsi teslim edilemeyen ornek.invalid adresi", () => {
    expect(new Set(allEmails).size).toBe(allEmails.length);
    for (const email of allEmails) {
      expect(email).toMatch(/^[a-z0-9.]+@ornek\.invalid$/);
      expect(isUndeliverable(email)).toBe(true);
    }
    for (const key of demo.demoLogins) expect(allEmails).toContain(`${key}@${demo.demoEmailDomain}`);
  });

  it("e-posta adı Türkçe harfleri sadeleştirir", () => {
    expect(demo.emailSlug("Elif Nur Şen")).toBe("elif.nur.sen");
    expect(demo.emailSlug("İkra Bilgin")).toBe("ikra.bilgin");
    expect(demo.emailSlug("Göktuğ Avcı")).toBe("goktug.avci");
  });

  it("okullar listedeki il ve ilçede, adları kurala uyuyor", () => {
    for (const school of demo.demoSchools) {
      expect(isPlace(school.province, school.district)).toBe(true);
      expect(schoolNameOk(school.name)).toBe(true);
      expect(demo.nameKeyOf(school.name)).toBe(schoolNameKey(school.name));
    }
    expect(demo.nameKeyOf("  Örnek   İLKOKULU ")).toBe(schoolNameKey("  Örnek   İLKOKULU "));
    expect(demo.demoTeachers.some((t) => t.key === demo.demoCoordinator.teacher && t.school === demo.demoCoordinator.school)).toBe(true);
  });

  it("sınıflar: ad, düzey, kod alfabesi; öğretmen onaylandıktan sonra açılmış", () => {
    expect(demo.joinCodeAlphabet).toBe(joinCodeAlphabet);
    expect(demo.joinCodeLength).toBe(joinCodeLength);
    expect(isJoinCode(demo.joinCodeAlphabet.slice(0, demo.joinCodeLength))).toBe(true);
    for (const group of demo.demoClasses) {
      expect(classNameOk(group.name)).toBe(true);
      expect((classLevels as readonly string[]).includes(group.level)).toBe(true);
      const teacher = demo.demoTeachers.find((t) => t.key === group.teacher);
      expect(teacher, group.key).toBeDefined();
      expect(group.createdDaysAgo).toBeLessThan(teacher!.approvedDaysAgo);
    }
  });

  it("ödevin son günü öğretmenin seçtiği günle aynı saklanır", () => {
    for (const days of [0, 3, 5]) {
      const key = turkeyDateKey(new Date(now.getTime() + days * 86_400_000));
      const parsed = parseDueDate(key, now);
      expect(parsed.ok && parsed.date?.toISOString()).toBe(demo.dueDateIn(now, days).toISOString());
    }
  });

  it("avatarlar ve öğrenci profili kayıt formunun değerleri", () => {
    expect([...demo.studentAvatars]).toEqual(avatars.map((a) => a.code));
    for (const code of [...demo.demoTeachers.map((t) => t.avatar), ...demo.demoApplicants.map((a) => a.avatar)]) expect(isAvatarCode(code)).toBe(true);
    expect(demo.studentProfile("7", now)).toEqual({ birthYear: 2013, gradeLevel: "Ortaokul" });
    expect(demo.studentProfile("10", now)).toEqual({ birthYear: 2010, gradeLevel: "Lise" });
  });

  it("talepler: alanlar kurallara uyuyor, belgeler gerçek PDF ve PNG", () => {
    for (const teacher of demo.demoTeachers) {
      expect(teacher.subject.length).toBeGreaterThanOrEqual(applicationLimits.subject.min);
      expect(teacher.subject.length).toBeLessThanOrEqual(applicationLimits.subject.max);
      // Karar maili yalnızca son 7 günün kararları için gider; örnek kararlar daha eski.
      expect(teacher.approvedDaysAgo).toBeGreaterThan(7);
    }
    for (const applicant of demo.demoApplicants) {
      const a = applicant.application;
      expect(a.subject.length).toBeLessThanOrEqual(applicationLimits.subject.max);
      if ("newName" in a.school) {
        expect(isPlace(a.school.province, a.school.district)).toBe(true);
        expect(schoolNameOk(a.school.newName)).toBe(true);
      }
      if (a.question) {
        expect(a.question.text.length).toBeGreaterThanOrEqual(questionLimits.min);
        expect(a.question.text.length).toBeLessThanOrEqual(questionLimits.max);
        expect(a.question.daysAgo).toBeGreaterThan(7);
      }
      if (a.rejection) {
        expect(a.rejection.note.length).toBeGreaterThanOrEqual(rejectionNoteLimits.min);
        expect(a.rejection.note.length).toBeLessThanOrEqual(rejectionNoteLimits.max);
        expect(a.rejection.daysAgo).toBeGreaterThan(7);
      }
      const document = demo.applicationDocument(applicant, "Örnek Ortaokulu", "İzmir / Bornova");
      if (!a.document) {
        expect(document).toBeNull();
        continue;
      }
      expect(document).not.toBeNull();
      expect(detectDocumentType(new Uint8Array(document!.data))).toBe(document!.mimeType);
      expect(document!.data.length).toBeLessThan(documentRules.maxBytes);
      expect(a.document.name.length).toBeLessThanOrEqual(documentRules.maxNameLength);
    }
  });

  it("PDF'in çapraz başvuru tablosu doğru (görüntüleyiciler onarmadan açar)", () => {
    const pdf = demo.pdfDocument([{ text: "ÖRNEK BELGE: ğüşıöç İĞŞ (deneme)", size: 12 }]).toString("latin1");
    const start = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(start, start + 4)).toBe("xref");
    const offsets = [...pdf.slice(start).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((offset, index) => expect(pdf.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`));
    expect(() => demo.pdfDocument([{ text: "€ olmaz → 😀", size: 12 }])).toThrow();
  });

  it("şifre Better Auth'un doğrulayabileceği biçimde", async () => {
    const hash = await demo.hashPassword("örnek-şifre-1234");
    expect(await verifyPassword({ hash, password: "örnek-şifre-1234" })).toBe(true);
    expect(await verifyPassword({ hash, password: "örnek-şifre-1235" })).toBe(false);
    expect(await demo.hashPassword("örnek-şifre-1234")).not.toBe(hash);
  });
});

describe("örnek veri: ipuçları ve gündem", () => {
  it("ipuçları formun sınırlarında", () => {
    for (const tip of demo.demoTips) {
      expect(textError(tip.text), tip.key).toBeNull();
      expect(reasonError(tip.reason), tip.key).toBeNull();
    }
    expect(demo.demoTips.filter((t) => t.status === "POOL").length).toBeGreaterThanOrEqual(3);
  });

  it("Türkiye günü sitenin günüyle aynı", () => {
    for (const at of ["2026-10-12T20:59:00Z", "2026-10-12T21:00:00Z", "2026-10-12T00:30:00Z"]) {
      expect(demo.turkeyDayKey(new Date(at))).toBe(turkeyDay(new Date(at)));
    }
  });

  it("yayındaki ve planlı haberler yayına hazır, kaynak güvenilir; taslak taslak adresinde", () => {
    for (const article of demo.demoArticles) {
      expect(article.title.startsWith("Örnek:")).toBe(true);
      expect(article.title.length).toBeLessThanOrEqual(newsLimits.title);
      expect(article.summary.length).toBeLessThanOrEqual(newsLimits.summary);
      if (article.status === "DRAFT") {
        expect(isDraftSlug(article.slug)).toBe(true);
        expect(article.week).toBeNull();
        expect(articleDraftContentSchema.safeParse(article.content).success).toBe(true);
        continue;
      }
      expect(article.slug).toMatch(/^[a-z0-9-]+$/);
      expect(articleContentSchema.safeParse(article.content).success, article.key).toBe(true);
      expect(isTrustedSourceUrl(article.sourceUrl)).toBe(true);
      const week = turkeyDateKey(demo.fridayAt(now, article.week!));
      const check = readiness({ ...article, neighborhoodId: article.neighborhood, relatedLabId: article.relatedLab, week });
      expect(check.missing, article.key).toEqual([]);
      expect(check.ready).toBe(true);
    }
    expect(new Set(demo.demoArticles.map((a) => a.slug)).size).toBe(demo.demoArticles.length);
  });

  it("yayın haftası Cuma 08.00 (Türkiye); 0 son yayın, 1 sıradaki", () => {
    for (const at of ["2026-10-12T09:30:00Z", "2026-10-16T04:59:00Z", "2026-10-16T05:00:00Z", "2026-10-17T22:00:00Z"]) {
      const when = new Date(at);
      const last = demo.fridayAt(when, 0);
      const next = demo.fridayAt(when, 1);
      expect(fridayPublishTime(turkeyDateKey(last))?.getTime()).toBe(last.getTime());
      expect(last.getTime()).toBeLessThanOrEqual(when.getTime());
      expect(turkeyDateKey(next)).toBe(upcomingFridays(when, 1)[0]);
    }
  });
});
