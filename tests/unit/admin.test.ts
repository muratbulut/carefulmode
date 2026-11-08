import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  allowedPermissions,
  effectivePermissions,
  grantablePermissions,
  hasLabAccess,
  isStudentAccount,
  labPermissions,
  mightBeMinor,
  minorBirthYearFloor,
  teamPermissionList,
} from "@/lib/admin/access";
import { isConfiguredAdminEmail, parseAdminEmails } from "@/lib/admin/admin-emails";
import { canonical, isPublishable, sameContent } from "@/lib/admin/compare";
import { emptyContent, exampleContent } from "@/lib/admin/drafts";
import { blankTask, freeSignPlaces, moveItem, nextId, taskMax } from "@/lib/admin/editor-model";
import { slugify, slugMaxLength, uniqueSlug } from "@/lib/admin/slug";
import { defaultTryPath, fakeChoices, mergeTryPath, outcomePoints, realChoices, reportForPath, type TryPath } from "@/lib/admin/try-path";
import { draftIssues, validateContent } from "@/lib/admin/validate";
import { maskEmail, personShown, typedEmailOf } from "@/lib/admin/users-model";
import { parseScenario, type ScenarioContent } from "@/lib/lab/content";

const example = (file: string) => JSON.parse(readFileSync(`labs/examples/${file}.json`, "utf8"));
const kargo = parseScenario(example("sahte-kargo-maili").content)!;
const sms = parseScenario(example("kodu-soran-arkadas").content)!;

describe("lab adresi (slug)", () => {
  it("Türkçe harfleri çevirir, boşluk ve işaretleri tireye indirir", () => {
    expect(slugify('Kodu soran "arkadaş"')).toBe("kodu-soran-arkadas");
    expect(slugify("Şifreni İSTEYEN Öğretmen!")).toBe("sifreni-isteyen-ogretmen");
    expect(slugify("  Çığ ünlü  ")).toBe("cig-unlu");
    expect(slugify("Kargo: 2. deneme")).toBe("kargo-2-deneme");
  });

  it("boş ya da yalnız işaretten oluşan adda 'oda' döner", () => {
    expect(slugify("")).toBe("oda");
    expect(slugify("!!! ???")).toBe("oda");
  });

  it("uzun adı kısaltır, sonda tire bırakmaz", () => {
    const slug = slugify("Çok uzun bir lab adı ".repeat(10));
    expect(slug.length).toBeLessThanOrEqual(slugMaxLength);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("alınmış adreslerle çakışmayan ilk adresi bulur", () => {
    expect(uniqueSlug("kargo", [])).toBe("kargo");
    expect(uniqueSlug("kargo", ["kargo"])).toBe("kargo-2");
    expect(uniqueSlug("kargo", ["kargo", "kargo-2", "kargo-3"])).toBe("kargo-4");
    const long = "a".repeat(slugMaxLength);
    expect(uniqueSlug(long, [long]).length).toBeLessThanOrEqual(slugMaxLength);
  });
});

describe("yönetim izinleri", () => {
  const adult = (role: string) => ({ role, birthYear: 1990 });
  const child = { role: "STUDENT", birthYear: new Date().getFullYear() - 13 };

  it("yönetici her şeyi yapar", () => {
    expect(labPermissions(adult("ADMIN"), [])).toEqual({ canEdit: true, canPublish: true });
    expect(effectivePermissions(adult("ADMIN"), [])).toEqual([...teamPermissionList]);
  });

  it("ekip sorumlusu yalnızca izni olan işi yapar", () => {
    expect(labPermissions(adult("STUDENT"), ["LAB_EDITING"])).toEqual({ canEdit: true, canPublish: false });
    expect(labPermissions(adult("TEACHER"), ["LAB_PUBLISHING"])).toEqual({ canEdit: false, canPublish: true });
    expect(labPermissions(adult("STUDENT"), ["LAB_EDITING", "LAB_PUBLISHING"])).toEqual({ canEdit: true, canPublish: true });
  });

  it("izni olmayan panele giremez (başka ekip izinleri lab izni vermez)", () => {
    expect(hasLabAccess(labPermissions(adult("STUDENT"), []))).toBe(false);
    expect(hasLabAccess(labPermissions(adult("TEACHER"), ["NEWS", "TIPS"]))).toBe(false);
    expect(hasLabAccess(labPermissions(adult("STUDENT"), ["LAB_EDITING"]))).toBe(true);
  });

  it("Roller izni sorumluya verilemez; yalnızca yöneticide", () => {
    expect(effectivePermissions(adult("TEACHER"), ["ROLES", "NEWS"])).toEqual(["NEWS"]);
    expect(grantablePermissions).not.toContain("ROLES");
  });

  it("öğrenci hesabı ekipte yalnızca İpucu ve Gündem iznini kullanır", () => {
    expect(effectivePermissions(child, ["APPLICATIONS", "AUDIT_LOG", "LAB_EDITING", "TIPS", "NEWS"])).toEqual(["TIPS", "NEWS"]);
    expect(effectivePermissions({ role: "STUDENT", birthYear: null }, ["AUDIT_LOG", "TIPS"])).toEqual(["TIPS"]);
    expect(allowedPermissions(child)).toEqual(["TIPS", "NEWS"]);
    expect(allowedPermissions(adult("STUDENT"))).toEqual(grantablePermissions);
  });

  it("bilinmeyen izin adı sayılmaz", () => {
    expect(effectivePermissions(adult("TEACHER"), ["SUPERUSER", "TIPS"])).toEqual(["TIPS"]);
  });

  it("bu yıl 18'ini dolduran öğrenci de öğrenci hesabıdır: doğum günü gelmemiş olabilir (güvenlik turu 4)", () => {
    const year = new Date().getFullYear();
    const turning18 = { role: "STUDENT", birthYear: year - 18 };
    expect(isStudentAccount(turning18)).toBe(true);
    expect(effectivePermissions(turning18, ["AUDIT_LOG", "APPLICATIONS", "LAB_EDITING", "TIPS"])).toEqual(["TIPS"]);
    expect(allowedPermissions(turning18)).toEqual(["TIPS", "NEWS"]);
    // Geçen yıl 18'ini dolduran kesin yetişkindir.
    expect(isStudentAccount({ role: "STUDENT", birthYear: year - 19 })).toBe(false);
    expect(mightBeMinor(2008, new Date("2026-12-31T12:00:00Z"))).toBe(true);
    expect(mightBeMinor(2007, new Date("2026-01-01T12:00:00Z"))).toBe(false);
    // Öğretmen ve yönetici rolü öğrenci hesabı sayılmaz.
    expect(isStudentAccount({ role: "TEACHER", birthYear: year - 18 })).toBe(false);
    // SQL süzgeçlerinin sınırı aynı kuraldan gelir.
    expect(minorBirthYearFloor(new Date("2026-06-01T12:00:00Z"))).toBe(2008);
  });
});

describe("ADMIN_EMAILS", () => {
  it("virgülle ayrılmış adresleri temizler, küçültür, tekrarı ve geçersizi atar", () => {
    expect(parseAdminEmails(" Murat@Ornek.com, ekip@ornek.com ,, yanlis, murat@ornek.com, a b@c.com ")).toEqual([
      "murat@ornek.com",
      "ekip@ornek.com",
    ]);
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails("")).toEqual([]);
  });

  it("adres büyük-küçük harf farkı gözetmeden eşleşir; liste boşsa kimse eşleşmez", () => {
    expect(isConfiguredAdminEmail("MURAT@ornek.com", "murat@ornek.com")).toBe(true);
    expect(isConfiguredAdminEmail(" murat@ornek.com ", "x@y.com,murat@ornek.com")).toBe(true);
    expect(isConfiguredAdminEmail("baska@ornek.com", "murat@ornek.com")).toBe(false);
    expect(isConfiguredAdminEmail("murat@ornek.com", "")).toBe(false);
    expect(isConfiguredAdminEmail("", "murat@ornek.com")).toBe(false);
  });
});

describe("Öğrenci gibi dene", () => {
  it("seçimlerin puanı öğrencinin raporundaki puan tablosuyla aynı", () => {
    for (const template of ["INBOX", "MESSAGING"] as const) {
      expect(Object.fromEntries(fakeChoices.map((o) => [o, outcomePoints("fake", o, template)]))).toEqual({
        reported: 4,
        deleted: 2,
        ignored: 1,
        reportedAfterEngaging: 2,
        engagedLeft: 0,
        hacked: 0,
      });
      expect(Object.fromEntries(realChoices.map((o) => [o, outcomePoints("real", o, template)]))).toEqual({
        kept: 1,
        deleted: 1,
        reported: 0,
      });
    }
  });

  it.each([
    ["sahte-kargo-maili", kargo, "INBOX"],
    ["kodu-soran-arkadas", sms, "MESSAGING"],
  ] as const)("varsayılan yol (her şey doğru) %s labında 100 puan ve güvende", (_name, content, template) => {
    const report = reportForPath(content, template, defaultTryPath(content));
    expect(report.score).toBe(100);
    expect(report.status).toBe("safe");
    expect(report.compromise).toBeNull();
  });

  it("sahte öğede 'bilgi girdi' seçilince rapor 'hacklendin' olur", () => {
    const fake = kargo.items.find((i) => i.kind === "fake")!;
    const path = defaultTryPath(kargo);
    path.items[fake.id] = "hacked";
    const report = reportForPath(kargo, "INBOX", path);
    expect(report.status).toBe("hacked");
    expect(report.score).toBeLessThan(100);
  });

  it("cevaplanmayan soru puan getirmez", () => {
    const question = kargo.tasks.find((t) => t.type === "question")!;
    const best = reportForPath(kargo, "INBOX", defaultTryPath(kargo)).score;
    const path = defaultTryPath(kargo);
    path.answers[question.id] = null;
    expect(reportForPath(kargo, "INBOX", path).score).toBe(best - Math.max(...question.options.map((o) => o.points)) * 10);
  });

  it("içerik değişince geçersiz kalan seçim varsayılana döner, geçerli seçim kalır", () => {
    const content: ScenarioContent = structuredClone(kargo);
    const fake = content.items.find((i) => i.kind === "fake")!;
    const real = content.items.find((i) => i.kind === "real")!;
    const previous: TryPath = { items: { [fake.id]: "hacked", [real.id]: "deleted" }, answers: {} };
    fake.kind = "real"; // "hacked" artık geçersiz
    const merged = mergeTryPath(content, previous);
    expect(merged.items[fake.id]).toBe("kept");
    expect(merged.items[real.id]).toBe("deleted");
  });
});

describe("lab içeriği denetimi", () => {
  it("örnek lablar geçer", () => {
    expect(validateContent("INBOX", example("sahte-kargo-maili").content).ok).toBe(true);
    expect(validateContent("MESSAGING", example("kodu-soran-arkadas").content).ok).toBe(true);
    expect(validateContent("TRAINING", example("oltalama-egitimi").content).ok).toBe(true);
  });

  it("biçimi bozuk içerik reddedilir", () => {
    expect(validateContent("INBOX", { items: "yok" }).ok).toBe(false);
    expect(validateContent("TRAINING", null).ok).toBe(false);
  });

  it("aynı kimlikli iki öğe reddedilir", () => {
    const content = structuredClone(kargo);
    content.items[1].id = content.items[0].id;
    const result = validateContent("INBOX", content);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContain(`items.${content.items[0].id}`);
  });

  it("işaretin yeri şablona uymalı (gelen kutusunda 'İstek' yok)", () => {
    const content = structuredClone(kargo);
    const fake = content.items.findIndex((i) => i.kind === "fake");
    content.items[fake].signs[0].at = "ask";
    const result = validateContent("INBOX", content);
    expect(result.ok).toBe(false);
  });

  it("test kartının cevabı seçeneklerin içinde olmalı", () => {
    const content = structuredClone(example("oltalama-egitimi").content);
    const quiz = content.cards.findIndex((c: { type: string }) => c.type === "quiz");
    content.cards[quiz].answer = 9;
    expect(validateContent("TRAINING", content).ok).toBe(false);
  });
});

describe("okunamayan taslak (güvenlik turu 2, D8)", () => {
  it("şemaya uyan taslak okunur; aynı kimlik gibi formda düzeltilebilen sorun okunmayı engellemez", () => {
    expect(draftIssues("INBOX", example("sahte-kargo-maili").content)).toBeNull();
    expect(draftIssues("TRAINING", example("oltalama-egitimi").content)).toBeNull();
    const twins = structuredClone(kargo);
    twins.items[1].id = twins.items[0].id;
    expect(draftIssues("INBOX", twins)).toBeNull();
  });

  it("şema sıkılaşınca eski taslak okunamaz; uymayan alanların yolu döner", () => {
    const content = structuredClone(example("sahte-kargo-maili").content);
    content.items[0].link.url = "kargo teslimat tr.xyz/adres";
    expect(draftIssues("INBOX", content)).toEqual(["items.0.link.url"]);

    const video = structuredClone(example("oltalama-egitimi").content);
    video.cards.push({ id: "video", type: "video", title: "Video", src: "//baska-site/video.mp4" });
    expect(draftIssues("TRAINING", video)).toEqual([`cards.${video.cards.length - 1}.src`]);
  });

  it("boş ya da bozuk içerik okunamaz; yol listesi kısa kalır", () => {
    expect(draftIssues("INBOX", {})).toEqual(["meta"]);
    expect(draftIssues("TRAINING", null)).toEqual(["content"]);
    const many = structuredClone(example("sahte-kargo-maili").content);
    for (const item of many.items) item.sender = 42;
    for (const task of many.tasks) task.text = 42;
    many.reminders = many.reminders.map(() => 42);
    expect(draftIssues("INBOX", many)?.length).toBe(10);
  });
});

describe("taslak ve yayına hazırlık", () => {
  it("alan sırası farklı iki içerik aynı sayılır", () => {
    expect(sameContent({ a: 1, b: { c: [1, 2], d: "x" } }, { b: { d: "x", c: [1, 2] }, a: 1 })).toBe(true);
    expect(sameContent({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(canonical({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("boş taslak geçerli ama yayına hazır değil; örnek içerik yayına hazır", () => {
    for (const template of ["TRAINING", "INBOX", "MESSAGING"] as const) {
      const empty = emptyContent(template, "Yeni lab");
      expect(empty.meta.name).toBe("Yeni lab");
      expect(validateContent(template, empty).ok).toBe(true);
      expect(isPublishable(template, empty)).toBe(false);

      const filled = exampleContent(template, "Kopya lab");
      expect(filled.meta.name).toBe("Kopya lab");
      expect(isPublishable(template, filled)).toBe(true);
    }
  });
});

describe("lab düzenleme formu yardımcıları", () => {
  it("tekil kimlik üretir", () => {
    expect(nextId("item", [])).toBe("item-1");
    expect(nextId("item", ["item-1", "item-3"])).toBe("item-2");
  });

  it("sırayı değiştirir, sınırda olduğu gibi bırakır", () => {
    expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
  });

  it("yeni soru görevi 3 boş seçenekle başlar", () => {
    expect(blankTask("question-1", "question").options).toHaveLength(3);
    expect(blankTask("action-1", "action").options).toHaveLength(0);
  });

  it("işaret yerleri şablona göre", () => {
    expect(freeSignPlaces("INBOX", { signs: [] })).toEqual(["sender", "text", "link"]);
    expect(freeSignPlaces("MESSAGING", { signs: [{ at: "sender", text: "", quote: "" }] })).toEqual(["text", "ask"]);
  });

  it("görevin en yüksek puanı", () => {
    const items = [{ kind: "fake" as const }, { kind: "real" as const }, { kind: "real" as const }];
    expect(taskMax({ type: "review", options: [] }, items)).toBe(6);
    expect(taskMax({ type: "action", options: [] }, items)).toBe(0);
    expect(taskMax({ type: "question", options: [{ text: "", points: 1 }, { text: "", points: 3 }] }, items)).toBe(3);
  });
});

describe("kişi aramasında öğrenci hesabı (güvenlik turu 4)", () => {
  it("öğrenci hesabı 'Ad S.' ve maskeli e-postayla görünür; e-postanın tamamı yazıldıysa e-posta açık", () => {
    const student = { displayName: "Kerem Tunalı", email: "kerem.t@okulmail.com" };
    expect(personShown(student, true, "")).toEqual({ name: "Kerem T.", email: "ke•••@okulmail.com" });
    expect(personShown(student, true, typedEmailOf(" KEREM.T@okulmail.com "))).toEqual({ name: "Kerem T.", email: "kerem.t@okulmail.com" });
    // Yetişkin üye ve öğretmen olduğu gibi.
    expect(personShown(student, false, "")).toEqual({ name: "Kerem Tunalı", email: "kerem.t@okulmail.com" });
  });

  it("e-posta maskesi ve yazılan e-posta", () => {
    expect(maskEmail("a@b.com")).toBe("a•••@b.com");
    expect(maskEmail("ab@b.com")).toBe("a•••@b.com");
    expect(maskEmail("abc@b.com")).toBe("ab•••@b.com");
    expect(maskEmail("bozuk")).toBe("•••");
    expect(maskEmail("@b.com")).toBe("•••");
    expect(typedEmailOf("kerem")).toBe("");
    expect(typedEmailOf("Kerem@Okul.com")).toBe("kerem@okul.com");
  });
});
