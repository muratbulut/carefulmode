import { describe, expect, it } from "vitest";
import { auditKinds, type AuditAction } from "@/lib/audit";
import {
  actorName,
  auditKindOf,
  auditSentence,
  knownActions,
  matchesKind,
  parseTarget,
  personLabel,
  referencedTargets,
  shortName,
  type TargetInfo,
} from "@/lib/admin/audit-sentences";
import { auditHref, auditKindList, kindFromParam, kindParams, parseAuditFilters } from "@/lib/admin/audit-url";

const lookup = (entries: Record<string, TargetInfo>) => new Map(Object.entries(entries));
const sentence = (action: string, details: unknown = {}, target = "x:1", targets: Record<string, TargetInfo> = {}, anonymize = false) =>
  auditSentence({ action, target, details }, lookup(targets), { anonymizeStudents: anonymize });

// lib/audit.ts'teki bütün kayıt adları (birleşik türden elle; yeni ad eklenince burası da büyür).
const allActions: AuditAction[] = [
  "application.approved",
  "application.rejected",
  "application.info_requested",
  "application.endorsed",
  "application.not_recognized",
  "application.school_matched",
  "application.undone",
  "application.mail_sent",
  "application.document_viewed",
  "teacher.reminded",
  "teacher.removed",
  "teacher.restored",
  "school.created",
  "school.updated",
  "school.coordinator_set",
  "school.coordinator_removed",
  "user.promote_admin",
  "team.added",
  "team.permissions_changed",
  "team.removed",
  "user.suspended",
  "user.unsuspended",
  "lab.create",
  "lab.save_draft",
  "lab.publish",
  "lab.unpublish",
  "lab.hide",
  "lab.unhide",
  "lab.reorder",
  "lab.gate_changed",
  "tip.created",
  "tip.updated",
  "tip.pooled",
  "tip.archived",
  "tip.pinned",
  "news.created",
  "news.updated",
  "news.scheduled",
  "news.unscheduled",
  "news.deleted",
  "student.profile_viewed",
  "teacher.viewed_as",
];

describe("kayıt defteri: adlar", () => {
  it("kısa ad: ad ve soyadın baş harfi", () => {
    expect(shortName("Ayşe Yılmaz")).toBe("Ayşe Y.");
    expect(shortName("  Mehmet Ali   İnce ")).toBe("Mehmet İ.");
    expect(shortName("ılgaz ırmak")).toBe("ılgaz I.");
    expect(shortName("Deniz")).toBe("Deniz");
    expect(shortName("   ")).toBe("");
  });

  it("hedef kişi: öğretmen tam adıyla, öğrenci kısa, toplu ekranda öğrenci hiç", () => {
    expect(personLabel({ name: "Hakan Demir", role: "TEACHER" })).toBe("Hakan Demir");
    expect(personLabel({ name: "Elif Su Kara", role: "STUDENT" })).toBe("Elif K.");
    expect(personLabel({ name: "Elif Su Kara", role: "STUDENT" }, { anonymizeStudents: true })).toBe("bir öğrenci");
    expect(personLabel({ name: "Murat Bulut", role: "ADMIN" }, { anonymizeStudents: true })).toBe("Murat B.");
    expect(personLabel(undefined)).toBe("silinmiş bir hesap");
    expect(personLabel({ name: " ", role: "STUDENT" })).toBe("silinmiş bir hesap");
  });

  it("yapan kişi: kısa ad; toplu ekranda ekipteki öğrenci hesabının adı yazılmaz", () => {
    expect(actorName({ name: "Deniz Arslan", role: "ADMIN" })).toBe("Deniz A.");
    expect(actorName({ name: "Deniz Arslan", role: "STUDENT" })).toBe("Deniz A.");
    expect(actorName({ name: "Deniz Arslan", role: "STUDENT" }, { anonymizeStudents: true })).toBe("Ekipten bir öğrenci");
    expect(actorName({ name: "", role: "ADMIN" })).toBe("silinmiş bir hesap");
  });

  it("hedef biçimi: tür ve kimlik", () => {
    expect(parseTarget("user:abc")).toEqual({ kind: "user", id: "abc" });
    expect(parseTarget("lab:a:b")).toEqual({ kind: "lab", id: "a:b" });
    expect(parseTarget("bozuk")).toBeNull();
    expect(parseTarget(":abc")).toBeNull();
    expect(parseTarget("user:")).toBeNull();
  });

  it("adı aranacak hedefler: kaydın hedefi, ayrıntıdaki kişi ve okul (tekrarsız)", () => {
    const keys = referencedTargets([
      { action: "application.approved", target: "application:a1", details: { userId: "u1", schoolId: "s1" } },
      { action: "school.coordinator_set", target: "school:s1", details: { coordinatorId: "u2" } },
      { action: "x", target: "bozuk", details: "metin" },
      { action: "x", target: "user:u1", details: null },
    ]);
    expect(keys.sort()).toEqual(["application:a1", "school:s1", "user:u1", "user:u2"].sort());
  });
});

describe("kayıt defteri: türler", () => {
  it("veritabanı süzgecinin kuralı auditKindOf ile aynı (bütün kayıt adları ve bilinmeyenler)", () => {
    const actions = [...allActions, ...knownActions, "foo.bar", "school.anything", "application.yeni", "teacher.other", "lab", "tipx.created", ""];
    for (const action of actions) {
      const kind = auditKindOf(action);
      for (const k of auditKinds) expect(matchesKind(action, k), `${action} -> ${k}`).toBe(k === kind);
    }
  });

  it("öneklere göre türler", () => {
    expect(auditKindOf("teacher.reminded")).toBe("application");
    expect(auditKindOf("teacher.viewed_as")).toBe("view");
    expect(auditKindOf("school.created")).toBe("role");
    expect(auditKindOf("news.deleted")).toBe("content");
  });

  it("belgeye bakış Bakış süzgecinde çıkar, Talep süzgecinde çıkmaz (güvenlik turu 4)", () => {
    expect(matchesKind("application.document_viewed", "view")).toBe(true);
    expect(matchesKind("application.document_viewed", "application")).toBe(false);
    expect(matchesKind("application.document_viewed", "role")).toBe(false);
    expect(matchesKind("application.approved", "application")).toBe(true);
  });
});

describe("kayıt defteri: cümleler", () => {
  it("her kayıt adının cümlesi var; ayrıntı ve adlar eksikken de bozulmaz", () => {
    expect(new Set(knownActions)).toEqual(new Set(allActions));
    for (const action of knownActions) {
      for (const details of [{}, null, "metin", [1, 2], { version: "iki", from: null, note: 5, permissions: "hepsi" }]) {
        const text = sentence(action, details, "bozuk");
        expect(text, action).not.toMatch(/^Yönetim işlemi/);
        expect(text, action).not.toMatch(/\{|\}|undefined|null|NaN/);
        expect(text.trim(), action).not.toBe("");
      }
    }
  });

  it("bilinmeyen kayıt adı genel cümleyle", () => {
    expect(sentence("billing.refund")).toBe("Yönetim işlemi: billing.refund");
  });

  it("öğretmenlik talebi: başvuran ve okul", () => {
    const targets = {
      "application:a1": { kind: "application", name: "Hakan Demir", role: "STUDENT", school: "Nilüfer Ortaokulu" },
      "school:s1": { kind: "school", name: "Bahçelievler Ortaokulu" },
    } satisfies Record<string, TargetInfo>;
    expect(sentence("application.approved", { schoolId: "s1" }, "application:a1", targets)).toBe(
      "Hakan D. öğretmen olarak onaylandı · Bahçelievler Ortaokulu",
    );
    expect(sentence("application.approved", {}, "application:a1", targets)).toBe("Hakan D. öğretmen olarak onaylandı · Nilüfer Ortaokulu");
    expect(sentence("application.info_requested", {}, "application:a1", targets)).toBe("Hakan D. için öğretmenlik talebinde bilgi istendi");
    expect(sentence("application.info_requested", {}, "application:a1", targets, true)).toBe("bir öğrenci için öğretmenlik talebinde bilgi istendi");
    // Talep silinmişse ayrıntıdaki kişi
    expect(sentence("application.rejected", { userId: "u9" }, "application:yok", { "user:u9": { kind: "user", name: "Ali Veli", role: "STUDENT" } })).toBe(
      "Ali V. için öğretmenlik talebi reddedildi",
    );
    expect(sentence("application.undone", {}, "application:a1", targets)).toBe("Hakan D. için talep kararı geri alındı");
  });

  it("öğrenci hedef kısa adla, toplu ekranda hiç; e-posta hiçbir zaman", () => {
    const targets = { "user:s1": { kind: "user", name: "Zeynep Ak", role: "STUDENT" } } satisfies Record<string, TargetInfo>;
    expect(sentence("student.profile_viewed", {}, "user:s1", targets)).toBe("Öğrenci profiline bakıldı: Zeynep A.");
    expect(sentence("student.profile_viewed", {}, "user:s1", targets, true)).toBe("Öğrenci profiline bakıldı: bir öğrenci");
    expect(sentence("student.profile_viewed", { email: "zeynep@ornek.com" }, "user:yok")).toBe("Öğrenci profiline bakıldı: silinmiş bir hesap");
  });

  it("lablar: sürüm, not, sıra, örnek içerik ve mahalle", () => {
    const targets = { "lab:l1": { kind: "lab", name: "Sahte kargo maili", neighborhood: "Oltalama Limanı" } } satisfies Record<string, TargetInfo>;
    expect(sentence("lab.publish", { slug: "sahte-kargo-maili", version: 2 }, "lab:l1", targets)).toBe('"Sahte kargo maili" v2 yayınlandı');
    expect(sentence("lab.unpublish", { version: 2, restoredVersion: 1 }, "lab:l1", targets)).toBe('"Sahte kargo maili" v2 yayını geri alındı');
    expect(sentence("lab.hide", { note: "Metin  güncelleniyor" }, "lab:l1", targets)).toBe('"Sahte kargo maili" gizlendi · not: Metin güncelleniyor');
    expect(sentence("lab.hide", { note: "" }, "lab:l1", targets)).toBe('"Sahte kargo maili" gizlendi');
    expect(sentence("lab.reorder", { from: 2, to: 3 }, "lab:l1", targets)).toBe('"Sahte kargo maili" sırası değişti: 2 → 3');
    expect(sentence("lab.gate_changed", { gate: "Bağlantı ve cihaz" }, "lab:l1", targets)).toBe(
      '"Sahte kargo maili" artık "Bağlantı ve cihaz" eğitimi bitince açılır',
    );
    expect(sentence("lab.gate_changed", { gate: null }, "lab:l1", targets)).toBe('"Sahte kargo maili" artık mahallenin temel eğitimi bitince açılır');
    expect(sentence("lab.create", { example: true }, "lab:l1", targets)).toBe('"Sahte kargo maili" taslağı örnek içerikle açıldı · Oltalama Limanı');
    // Silinmiş lab: ayrıntıdaki adres
    expect(sentence("lab.save_draft", { slug: "e2e-eski" }, "lab:silindi")).toBe('"e2e-eski" taslağı kaydedildi');
    expect(sentence("lab.unhide", {}, "lab:silindi")).toBe('"silinmiş bir oda" yeniden yayında');
  });

  it("ekip, roller ve okullar", () => {
    const targets = {
      "user:t1": { kind: "user", name: "Ayşe Kaya", role: "ADMIN" },
      "user:c1": { kind: "user", name: "Selin Öz", role: "TEACHER" },
      "school:s1": { kind: "school", name: "Nilüfer Ortaokulu" },
    } satisfies Record<string, TargetInfo>;
    expect(sentence("team.added", { permissions: ["APPLICATIONS", "NEWS", "BILINMEYEN"] }, "user:t1", targets)).toBe(
      "Ayşe K. ekibe eklendi · Sorumlu: Öğretmen talepleri, Gündem",
    );
    expect(sentence("team.permissions_changed", { role: "ADMIN" }, "user:t1", targets)).toBe("Ayşe K. için ekip izinleri değişti · Yönetici");
    expect(sentence("user.promote_admin", { source: "ADMIN_EMAILS" }, "user:t1", targets)).toBe("Ayşe K. yönetici yapıldı · ADMIN_EMAILS listesinden");
    expect(sentence("school.coordinator_set", { coordinatorId: "c1" }, "school:s1", targets)).toBe("Nilüfer Ortaokulu okul sorumlusu: Selin Öz");
    expect(sentence("school.created", { name: "Yeni Okul" }, "school:yok")).toBe("Yeni Okul okul listesine eklendi");
    expect(sentence("teacher.reminded", { schoolId: "s1" }, "user:c1", targets)).toBe("Selin Öz öğretmene hatırlatma gönderildi");
    // Karar maili kararın türünü söyler; türü olmayan eski kayıtta genel cümle.
    expect(sentence("application.mail_sent", { kind: "infoRequested", userId: "c1" }, "application:a1", targets)).toBe("Selin Öz için bilgi isteme maili gönderildi");
    expect(sentence("application.mail_sent", { kind: "approved", userId: "c1" }, "application:a1", targets)).toBe("Selin Öz için onay maili gönderildi");
    expect(sentence("application.mail_sent", { kind: "rejected", userId: "c1" }, "application:a1", targets)).toBe("Selin Öz için ret maili gönderildi");
    expect(sentence("application.mail_sent", { userId: "c1" }, "application:a1", targets)).toBe("Selin Öz için karar maili gönderildi");
  });

  it("içerik: ipucu ve gündem, uzun metin kısaltılır, tarih Türkçe", () => {
    const long = "Doğrulama kodunu isteyen kişi banka ya da öğretmen olsa bile kodu kimseye söyleme, hiçbir zaman.";
    const targets = {
      "tip:t1": { kind: "tip", text: long },
      "news:n1": { kind: "news", title: "Sahte kargo SMS'leri yine arttı" },
    } satisfies Record<string, TargetInfo>;
    const tip = sentence("tip.pinned", { date: "2026-10-12" }, "tip:t1", targets);
    expect(tip).toMatch(/^Günün ipucu: "Doğrulama kodunu .*…" bir güne sabitlendi · 12 Ekim$/);
    // pinTipDay'in yazdığı biçim: gün "day" alanında, "Otomatik" seçimi "auto" ile.
    const change = (before: string | null, after: string | null) => ({ id: "t1", before: { pinnedDay: before }, after: { pinnedDay: after } });
    expect(sentence("tip.pinned", { day: "2026-10-14", auto: false, changes: [change(null, "2026-10-14")] }, "tip:t1", targets)).toMatch(
      /bir güne sabitlendi · 14 Ekim$/,
    );
    expect(sentence("tip.pinned", { day: "2026-10-14", auto: true, changes: [change("2026-10-14", null)] }, "tip:t1", targets)).toMatch(
      /gününden kaldırıldı, gün otomatiğe döndü · 14 Ekim$/,
    );
    // Düzenleme formunda yalnızca gün boşaldıysa da (day yok) günden kaldırıldı yazar.
    expect(sentence("tip.pinned", { changes: [change("2026-10-20", null)] }, "tip:t1", targets)).toMatch(/gününden kaldırıldı, gün otomatiğe döndü · 20 Ekim$/);
    expect(sentence("news.scheduled", { publishedAt: "2026-10-16T09:00:00.000Z" }, "news:n1", targets)).toBe(
      "Gündem: \"Sahte kargo SMS'leri yine arttı\" planlandı · 16 Ekim",
    );
    expect(sentence("news.deleted", { title: "Eski haber" }, "news:silindi")).toBe('Gündem: "Eski haber" silindi');
    expect(sentence("news.updated", { title: "Eski haber", cover: "uploaded" }, "news:silindi")).toBe('Gündem: "Eski haber" kapak görseli eklendi');
    expect(sentence("news.updated", { title: "Eski haber", cover: "removed" }, "news:silindi")).toBe('Gündem: "Eski haber" kapak görseli kaldırıldı');
    expect(sentence("news.updated", { title: "Eski haber" }, "news:silindi")).toBe('Gündem: "Eski haber" düzenlendi');
    expect(sentence("news.scheduled", { publishedAt: "tarih değil" }, "news:n1", targets)).toBe("Gündem: \"Sahte kargo SMS'leri yine arttı\" planlandı");
  });
});

describe("kayıt defteri: süzgeçler ve adres", () => {
  it("tür adları adreste Türkçe; her türün bir adı var", () => {
    expect(auditKindList.sort()).toEqual([...auditKinds].sort());
    for (const kind of auditKinds) expect(kindFromParam(kindParams[kind])).toBe(kind);
    expect(kindFromParam("oda")).toBe("lab");
    expect(kindFromParam("application")).toBeNull();
    expect(kindFromParam(undefined)).toBeNull();
  });

  it("adresteki süzgeçler okunur; bozuk değer yok sayılır", () => {
    expect(parseAuditFilters({ tur: "icerik", kisi: "cmabc123", ara: "  Sahte   kargo ", sonraki: "cmx_9-1" })).toEqual({
      kind: "content",
      person: "cmabc123",
      query: "Sahte kargo",
      cursor: "cmx_9-1",
    });
    expect(parseAuditFilters({ tur: "bilinmeyen", kisi: "a b", ara: undefined, sonraki: "x'; DROP" })).toEqual({
      kind: null,
      person: null,
      query: "",
      cursor: null,
    });
    expect(parseAuditFilters({ tur: ["oda", "rol"], ara: "x".repeat(200) }).query).toHaveLength(80);
    expect(parseAuditFilters({ tur: ["oda", "rol"] }).kind).toBe("lab");
    // "Oda" adından önce kaydedilmiş bağlantılar da aynı listeyi açar.
    expect(parseAuditFilters({ tur: "lab" }).kind).toBe("lab");
    expect(parseAuditFilters({ tur: "constructor" }).kind).toBeNull();
  });

  it("süzgeçlerden adres; boş süzgeç yazılmaz", () => {
    expect(auditHref({})).toBe("/yonetim/kayit-defteri");
    expect(auditHref({ kind: "view", query: " ", person: null })).toBe("/yonetim/kayit-defteri?tur=bakis");
    const href = auditHref({ kind: "lab", person: "u1", query: "Kargo maili", cursor: "c1" });
    expect(href).toBe("/yonetim/kayit-defteri?tur=oda&kisi=u1&ara=Kargo+maili&sonraki=c1");
    const params = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(parseAuditFilters(params)).toEqual({ kind: "lab", person: "u1", query: "Kargo maili", cursor: "c1" });
  });
});
