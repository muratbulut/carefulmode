import { describe, expect, it } from "vitest";
import { allowedPermissions, grantablePermissions, teamPermissionList } from "@/lib/admin/access";
import {
  checkSchoolName,
  cleanQuery,
  coordinatorRefusal,
  entryMeta,
  formerRole,
  grantableOrder,
  grantRefusal,
  permissionDiff,
  permissionOrder,
  personKind,
  roleLabelOf,
  samePermissions,
  sortPermissions,
  teamUndoWindowMs,
  undoBatch,
  type UndoEntry,
} from "@/lib/admin/team-rules";
import { brand } from "@/lib/brand";
import { coordinatorMail, teamAddedMail } from "@/lib/mail/team-mail";

// Üst şeritteki logo resmi (lib/mail/logo.ts) maildeki tek <img> olabilir; gerisi kaçışlı metin olmalı.
const withoutMailLogo = (html: string) => html.replace(/<img src="[^"]*\/mail\/logo\.png"[^>]*>/, "");

const adult = { role: "STUDENT", birthYear: 1990 };
const minor = { role: "STUDENT", birthYear: new Date().getFullYear() - 13 };

describe("yönetim ekibi: izinler ve roller", () => {
  it("tarayıcıdaki izin sırası access.ts ile aynı; ROLES verilebilenlerde yok", () => {
    expect([...grantableOrder]).toEqual([...grantablePermissions]);
    expect([...permissionOrder]).toEqual([...teamPermissionList]);
    expect(grantableOrder).not.toContain("ROLES");
  });

  it("rol etiketi: Yönetici, Sorumlu, Sorumlu · öğrenci", () => {
    expect(roleLabelOf({ role: "ADMIN", studentAccount: false })).toBe("admin");
    expect(roleLabelOf({ role: "MEMBER", studentAccount: false })).toBe("member");
    expect(roleLabelOf({ role: "MEMBER", studentAccount: true })).toBe("studentMember");
  });

  it("izinleri ekran sırasına koyar, bilinmeyeni ve tekrarı atar; farkı bulur", () => {
    expect(sortPermissions(["NEWS", "APPLICATIONS", "NEWS", "OWNER"])).toEqual(["APPLICATIONS", "NEWS"]);
    expect(samePermissions(["NEWS", "TIPS"], ["TIPS", "NEWS"])).toBe(true);
    expect(samePermissions(["NEWS"], ["NEWS", "TIPS"])).toBe(false);
    expect(permissionDiff(["NEWS", "TIPS"], ["TIPS", "APPLICATIONS"])).toEqual({ added: ["APPLICATIONS"], removed: ["NEWS"] });
  });

  it("sorumluya en az bir izin verilir; ROLES hiç verilmez", () => {
    const allowed = allowedPermissions(adult);
    expect(grantRefusal({ role: "MEMBER", permissions: ["NEWS"], studentAccount: false, allowed })).toBeNull();
    expect(grantRefusal({ role: "MEMBER", permissions: [], studentAccount: false, allowed })).toBe("noPermission");
    expect(grantRefusal({ role: "MEMBER", permissions: ["NEWS", "ROLES"], studentAccount: false, allowed })).toBe("permissionNotAllowed");
    expect(grantRefusal({ role: "ADMIN", permissions: [], studentAccount: false, allowed })).toBeNull();
  });

  it("öğrenci hesabı yalnız İpucu ve Gündem alır, yönetici olamaz", () => {
    const allowed = allowedPermissions(minor);
    expect(grantRefusal({ role: "MEMBER", permissions: ["TIPS", "NEWS"], studentAccount: true, allowed })).toBeNull();
    for (const p of ["APPLICATIONS", "AUDIT_LOG", "LAB_EDITING", "LAB_PUBLISHING"] as const) {
      expect(grantRefusal({ role: "MEMBER", permissions: ["NEWS", p], studentAccount: true, allowed })).toBe("permissionNotAllowed");
    }
    expect(grantRefusal({ role: "ADMIN", permissions: [], studentAccount: true, allowed })).toBe("studentAccount");
  });

  it("yöneticilikten çıkan: öğretmenlik izi varsa öğretmen, yoksa önceki rolü, o da yoksa öğrenci", () => {
    expect(formerRole({ recorded: "TEACHER", teacherEvidence: false })).toBe("TEACHER");
    expect(formerRole({ recorded: "STUDENT", teacherEvidence: true })).toBe("TEACHER");
    expect(formerRole({ recorded: "STUDENT", teacherEvidence: false })).toBe("STUDENT");
    expect(formerRole({ recorded: null, teacherEvidence: false })).toBe("STUDENT");
    // Kayıtta "ADMIN" yazsa bile yönetici olarak kalmaz.
    expect(formerRole({ recorded: "ADMIN", teacherEvidence: false })).toBe("STUDENT");
  });
});

describe("geri al", () => {
  const now = new Date("2026-10-12T10:00:30Z");
  const entry = (id: string, op: string, secondsAgo: number, extra: Partial<UndoEntry> = {}, details: Record<string, unknown> = {}): UndoEntry => ({
    id,
    actorId: "admin",
    action: "team.added",
    createdAt: new Date(now.getTime() - secondsAgo * 1000),
    details: { op, ...details },
    ...extra,
  });

  it("işlem kimliğini ve geri alma işaretini okur", () => {
    expect(entryMeta({ op: "a", undo: true })).toEqual({ op: "a", undo: true });
    expect(entryMeta(null)).toEqual({ op: null, undo: false });
    expect(entryMeta(["op"])).toEqual({ op: null, undo: false });
  });

  it("en yeni kayıtlar bu işlemin: hepsini en yeniden geriye verir", () => {
    const entries = [entry("1", "old", 20), entry("2", "a", 3), entry("3", "a", 2)];
    expect(undoBatch(entries, "a", "admin", now).map((e) => e.id)).toEqual(["3", "2"]);
  });

  it("sonra başka bir işlem yapıldıysa, başkası yaptıysa, süre geçtiyse ya da kayıt bir geri almaysa boş", () => {
    expect(undoBatch([entry("1", "a", 5), entry("2", "b", 2)], "a", "admin", now)).toEqual([]);
    expect(undoBatch([entry("1", "a", 5)], "a", "other", now)).toEqual([]);
    expect(undoBatch([entry("1", "a", teamUndoWindowMs / 1000 + 1)], "a", "admin", now)).toEqual([]);
    expect(undoBatch([entry("1", "a", 1, {}, { undo: true })], "a", "admin", now)).toEqual([]);
    expect(undoBatch([], "a", "admin", now)).toEqual([]);
  });
});

describe("okul sorumlusu ve okul ekle", () => {
  it("kişi türü", () => {
    expect(personKind("ADMIN", false)).toBe("admin");
    expect(personKind("TEACHER", false)).toBe("teacher");
    expect(personKind("STUDENT", true)).toBe("student");
    expect(personKind("STUDENT", false)).toBe("member");
  });

  it("sorumlu öğretmen ya da yönetici olur; öğrenci ve başka okulun öğretmeni olamaz", () => {
    const teacher = { kind: "teacher" as const, schoolId: "s1", coordinatedSchoolId: null };
    expect(coordinatorRefusal(teacher, "s1")).toBeNull();
    expect(coordinatorRefusal({ ...teacher, schoolId: null }, "s1")).toBeNull();
    expect(coordinatorRefusal({ ...teacher, schoolId: null }, null)).toBeNull();
    expect(coordinatorRefusal(teacher, "s2")).toBe("otherSchool");
    expect(coordinatorRefusal({ ...teacher, coordinatedSchoolId: "s3" }, "s1")).toBe("coordinatesOther");
    expect(coordinatorRefusal({ ...teacher, coordinatedSchoolId: "s1" }, "s1")).toBeNull();
    expect(coordinatorRefusal({ kind: "admin", schoolId: null, coordinatedSchoolId: null }, "s1")).toBeNull();
    expect(coordinatorRefusal({ kind: "student", schoolId: null, coordinatedSchoolId: null }, "s1")).toBe("studentAccount");
    expect(coordinatorRefusal({ kind: "member", schoolId: null, coordinatedSchoolId: null }, "s1")).toBe("notTeacher");
  });

  it("arama metni: boşluk sadeleşir, LIKE jokerleri atılır, uzunluk sınırlı", () => {
    expect(cleanQuery("  ali   veli ")).toBe("ali veli");
    expect(cleanQuery("%_\\a")).toBe("a");
    expect(cleanQuery("x".repeat(200))).toHaveLength(80);
  });

  it("okul adı: birebir aynısı eklenmez, benzeri uyarı ister", () => {
    const existing = ["Atatürk Ortaokulu", "Cumhuriyet Anadolu Lisesi"];
    expect(checkSchoolName("  atatürk   ortaokulu ", existing)).toEqual({ status: "duplicate", name: "Atatürk Ortaokulu" });
    expect(checkSchoolName("Atatürk Ortaokulu Şubesi", existing)).toEqual({ status: "similar", names: ["Atatürk Ortaokulu"] });
    expect(checkSchoolName("Cumhuriyet Anadolu İmam Hatip Lisesi", existing)).toEqual({ status: "similar", names: ["Cumhuriyet Anadolu Lisesi"] });
    expect(checkSchoolName("Yunus Emre İlkokulu", existing)).toEqual({ status: "ok" });
    expect(checkSchoolName("Abc", existing)).toEqual({ status: "invalid" });
    expect(checkSchoolName("12345", existing)).toEqual({ status: "invalid" });
  });
});

describe("ekip ve okul sorumlusu mailleri", () => {
  const evil = '<img src=x onerror="a()">';
  const links = (html: string) => [...html.matchAll(/<a href="([^"]*)"/g)].map((m) => m[1]);

  it("ekibe eklendin (sorumlu): izinler, kayıt defteri notu, yalnızca sitenin bağlantıları", () => {
    const mail = teamAddedMail({ to: "uye@ornek.com", name: evil, siteUrl: "https://ornek.com", actorName: evil, role: "MEMBER", permissions: ["NEWS", "TIPS"] });
    expect(mail.to).toBe("uye@ornek.com");
    expect(mail.subject).toBe(`${brand.name} yönetim ekibine eklendin`);
    expect(mail.text).toContain("sorumlu olarak ekledi");
    expect(mail.text).toContain("İZİNLERİN\n- Gündem\n- Günün ipucu");
    expect(mail.text).toContain("kayıt defterine yazılır");
    expect(mail.text).not.toContain("iki adımlı");
    expect(withoutMailLogo(mail.html)).not.toContain("<img");
    expect(mail.html).toContain("&#60;img");
    expect(links(mail.html)).toEqual(["https://ornek.com/yonetim", "https://ornek.com/kvkk"]);
  });

  it("ekibe eklendin (yönetici): izin listesi yok, her şeyi yapar", () => {
    const mail = teamAddedMail({ to: "y@ornek.com", name: "Ayşe", siteUrl: "https://ornek.com", actorName: "Murat", role: "ADMIN", permissions: [] });
    expect(mail.text).toContain("Murat seni");
    expect(mail.text).toContain("yönetici olarak ekledi");
    expect(mail.text).not.toContain("İZİNLERİN");
  });

  it("okul sorumlusu oldun: okul adı kaçışlı, onay tikine göre cümle, Okulum bağlantısı", () => {
    const on = coordinatorMail({ to: "o@ornek.com", name: "Selin", siteUrl: "https://ornek.com", actorName: "Murat", schoolName: evil, coordinatorApproves: true });
    expect(withoutMailLogo(on.html)).not.toContain("<img");
    expect(on.text).toContain("sen onaylayabilirsin");
    expect(links(on.html)).toEqual(["https://ornek.com/okulum", "https://ornek.com/kvkk"]);
    const off = coordinatorMail({ to: "o@ornek.com", name: null, siteUrl: "https://ornek.com", actorName: "Murat", schoolName: "Atatürk Ortaokulu", coordinatorApproves: false });
    expect(off.subject).toBe("Atatürk Ortaokulu okul sorumlusu oldun");
    expect(off.text).toContain("kararı yönetim verir");
  });
});
