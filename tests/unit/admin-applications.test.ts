import { describe, expect, it } from "vitest";
import {
  documentContentSecurityPolicy,
  documentHeaders,
  isServableDocumentType,
} from "@/lib/admin/application-document";
import {
  applicationsHref,
  approveInputSchema,
  checksJson,
  countedChecks,
  documentHref,
  infoInputSchema,
  isApplicationId,
  matchesSearch,
  qaHistory,
  readChecks,
  rejectInputSchema,
  schoolKeywords,
  schoolSearchUrl,
  schoolSimilarity,
  signalLevel,
  signalsOf,
  similarSchools,
  tabFromParam,
  tabOf,
} from "@/lib/admin/application-rules";
import { auditKindOf } from "@/lib/audit";

describe("talepler: sekmeler ve adres", () => {
  it("adresteki sekme adını tanır, bilinmeyende null döner", () => {
    expect(tabFromParam("bekleyen")).toBe("pending");
    expect(tabFromParam("bilgi-istendi")).toBe("info");
    expect(tabFromParam("onaylanan")).toBe("approved");
    expect(tabFromParam("reddedilen")).toBe("rejected");
    expect(tabFromParam("pending")).toBeNull();
    expect(tabFromParam(undefined)).toBeNull();
    expect(tabFromParam(["bekleyen"])).toBeNull();
  });

  it("cevabı gelen talep (PENDING) Bekleyen sekmesindedir", () => {
    expect(tabOf("PENDING")).toBe("pending");
    expect(tabOf("INFO_REQUESTED")).toBe("info");
    expect(tabOf("APPROVED")).toBe("approved");
    expect(tabOf("REJECTED")).toBe("rejected");
  });

  it("sekme ve seçili talep adrese yazılır; belge adresi talebin altındadır", () => {
    expect(applicationsHref("info")).toBe("/yonetim/talepler?sekme=bilgi-istendi");
    expect(applicationsHref("pending", "cm123")).toBe("/yonetim/talepler?sekme=bekleyen&talep=cm123");
    expect(documentHref("cm123")).toBe("/yonetim/talepler/cm123/belge");
  });

  it("talep kimliği yalnızca harf, rakam, - ve _ olabilir", () => {
    expect(isApplicationId("cmabc123_x-y")).toBe(true);
    expect(isApplicationId("")).toBe(false);
    expect(isApplicationId("../belge")).toBe(false);
    expect(isApplicationId("a".repeat(65))).toBe(false);
    expect(isApplicationId(42)).toBe(false);
  });
});

describe("talepler: kontrol listesi", () => {
  const all = { hasEmail: true, hasDocument: true };
  const bare = { hasEmail: false, hasDocument: false };

  it("bilgisi olmayan madde sayılmaz, tekrar eden ve bilinmeyen anahtar atılır", () => {
    expect(countedChecks(["schoolReal", "emailDomain", "documentReadable"], all)).toEqual(["schoolReal", "emailDomain", "documentReadable"]);
    expect(countedChecks(["schoolReal", "emailDomain", "documentReadable"], bare)).toEqual(["schoolReal"]);
    expect(countedChecks(["subjectFits", "subjectFits", "nope"], bare)).toEqual(["subjectFits"]);
  });

  it("veritabanındaki biçimden okunur ve yazılır", () => {
    expect(checksJson(["schoolReal", "subjectFits"])).toEqual({ schoolReal: true, emailDomain: false, documentReadable: false, subjectFits: true });
    expect(readChecks(checksJson(["schoolReal", "subjectFits"]))).toEqual(["schoolReal", "subjectFits"]);
    expect(readChecks({})).toEqual([]);
    expect(readChecks(null)).toEqual([]);
    expect(readChecks(["schoolReal"])).toEqual([]);
    expect(readChecks({ schoolReal: "true", subjectFits: true })).toEqual(["subjectFits"]);
  });
});

describe("talepler: sinyaller ve Güçlü / Orta / Zayıf", () => {
  it("4 sinyal: kurumsal e-posta, belge, okul listede, aynı okuldan onaylı öğretmen", () => {
    const signals = signalsOf({ hasEmail: true, hasDocument: false, schoolListed: true, colleagues: 3 });
    expect(signals.map((s) => [s.key, s.ok])).toEqual([
      ["email", true],
      ["document", false],
      ["listed", true],
      ["colleagues", true],
    ]);
  });

  it("3 ve 4 sinyal Güçlü, 2 Orta, daha azı Zayıf (Talepler-Son örnekleri)", () => {
    // Selin Yıldız: e-posta, belge, listede, 3 öğretmen
    expect(signalLevel({ hasEmail: true, hasDocument: true, schoolListed: true, colleagues: 3 })).toBe("strong");
    // Hakan Demir: listede, 1 öğretmen
    expect(signalLevel({ hasEmail: false, hasDocument: false, schoolListed: true, colleagues: 1 })).toBe("medium");
    // Ece Arslan: yeni okul, yalnızca e-posta
    expect(signalLevel({ hasEmail: true, hasDocument: false, schoolListed: false, colleagues: 0 })).toBe("weak");
    expect(signalLevel({ hasEmail: false, hasDocument: false, schoolListed: false, colleagues: 0 })).toBe("weak");
  });

  it("listede olmayan okulda öğretmen sayısı sinyal sayılmaz", () => {
    expect(signalsOf({ hasEmail: false, hasDocument: false, schoolListed: false, colleagues: 5 })[3].ok).toBe(false);
  });
});

describe("talepler: Bu okul mu?", () => {
  const district = [
    { id: "a", name: "Bahçelievler Ortaokulu" },
    { id: "b", name: "Kadıköy Anadolu Lisesi" },
    { id: "c", name: "Şehit Ali Gaffar Okkan Ortaokulu" },
    { id: "d", name: "Bahçelievler Anadolu Lisesi" },
  ];

  it("genel kelimeler (ortaokulu, orta okulu, lisesi...) ayırt edici sayılmaz", () => {
    expect(schoolKeywords("bahçelievler orta okulu")).toEqual(["bahcelievler"]);
    expect(schoolKeywords("Nilüfer Fen Lisesi")).toEqual(["nilufer"]);
  });

  it("yazım farkına rağmen aynı okulu bulur, en benzeri önce", () => {
    expect(similarSchools("bahçelievler orta okulu", district).map((s) => s.id)).toEqual(["a", "d"]);
    expect(similarSchools("Bahçelievler Ortaokulu", district)[0].id).toBe("a");
    expect(schoolSimilarity("Bahçelievler Ortaokulu", "bahçelievler  ortaokulu")).toBe(3);
  });

  it("ortak ayırt edici kelime yoksa benzer sayılmaz", () => {
    expect(similarSchools("Çankaya Bilim ve Sanat Merkezi", district)).toEqual([]);
    expect(similarSchools("Bornova Ortaokulu", district)).toEqual([]);
  });

  it("kelimenin başı da eşleşir (Okkan / Okkan'ın gibi kısaltmalar)", () => {
    expect(similarSchools("Gaffar Okkan", district).map((s) => s.id)).toEqual(["c"]);
  });

  it("en fazla 5 aday döner", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: `Atatürk ${i}. Ortaokulu` }));
    expect(similarSchools("Atatürk Ortaokulu", many)).toHaveLength(5);
  });

  it("okulu internette ara: ad, ilçe ve il ile arama adresi", () => {
    expect(schoolSearchUrl("Bahçelievler Ortaokulu", "Bahçelievler", "İstanbul")).toBe(
      `https://www.google.com/search?q=${encodeURIComponent("Bahçelievler Ortaokulu Bahçelievler İstanbul")}`,
    );
  });
});

describe("talepler: bilgi isteme geçmişi", () => {
  const at = (s: string) => new Date(`2026-10-0${s}T10:00:00.000Z`);

  it("önceki turlar kayıt defterinden, son tur talep satırından gelir", () => {
    const entries = [
      { id: "e1", action: "application.info_requested", details: { previous: { question: null, questionAt: null, answer: null, answeredAt: null } } },
      {
        id: "e2",
        action: "application.info_requested",
        details: { previous: { question: "Kurumsal e-posta?", questionAt: at("1").toISOString(), answer: "Yok, belge ekledim.", answeredAt: at("2").toISOString() } },
      },
    ];
    const rounds = qaHistory(entries, { question: "Okulun tam adı?", questionAt: at("3"), answer: null, answeredAt: null });
    expect(rounds.map((r) => [r.question, r.answer])).toEqual([
      ["Kurumsal e-posta?", "Yok, belge ekledim."],
      ["Okulun tam adı?", null],
    ]);
  });

  it("geri alınmış bilgi isteme sayılmaz; aynı tur iki kez yazılmaz", () => {
    const previous = { question: "Belgen?", questionAt: at("1").toISOString(), answer: "Ekledim", answeredAt: at("2").toISOString() };
    const entries = [
      { id: "e1", action: "application.info_requested", details: { previous } },
      { id: "u1", action: "application.undone", details: { undone: [{ id: "e1", action: "application.info_requested" }] } },
    ];
    // Geri alınınca önceki tur talep satırına döndü.
    const rounds = qaHistory(entries, { question: "Belgen?", questionAt: at("1"), answer: "Ekledim", answeredAt: at("2") });
    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toMatchObject({ question: "Belgen?", answer: "Ekledim" });
  });

  it("yalnızca belgeyle cevaplanan turun cevabı boştur ama cevap zamanı vardır", () => {
    const rounds = qaHistory([], { question: "Belgen?", questionAt: at("1"), answer: null, answeredAt: at("2") });
    expect(rounds[0].answer).toBeNull();
    expect(rounds[0].answeredAt).toEqual(at("2"));
  });

  it("hiç soru yoksa boş", () => {
    expect(qaHistory([], { question: null, questionAt: null, answer: null, answeredAt: null })).toEqual([]);
  });
});

describe("talepler: arama", () => {
  const row = { name: "Selin Yıldız", school: "Bahçelievler Ortaokulu", subject: "Bilişim Teknolojileri" };
  it("ad, okul ya da branşta büyük-küçük harfe bakmadan arar", () => {
    expect(matchesSearch(row, "")).toBe(true);
    expect(matchesSearch(row, "SELİN")).toBe(true);
    expect(matchesSearch(row, "bahçe")).toBe(true);
    expect(matchesSearch(row, "bilişim")).toBe(true);
    expect(matchesSearch(row, "fizik")).toBe(false);
  });
});

describe("talepler: eylem girdileri", () => {
  it("onay: kimlik, bilinen kontrol anahtarları; fazladan alan kabul edilmez", () => {
    expect(approveInputSchema.safeParse({ applicationId: "cm1", checks: ["schoolReal", "subjectFits"] }).success).toBe(true);
    expect(approveInputSchema.safeParse({ applicationId: "cm1", checks: ["schoolReal"], matchSchoolId: "sc1" }).success).toBe(true);
    expect(approveInputSchema.safeParse({ applicationId: "cm1", checks: ["admin"] }).success).toBe(false);
    expect(approveInputSchema.safeParse({ applicationId: "cm1", checks: [], role: "ADMIN" }).success).toBe(false);
    expect(approveInputSchema.safeParse({ applicationId: "../x", checks: [] }).success).toBe(false);
    expect(approveInputSchema.safeParse({ applicationId: "cm1", checks: ["schoolReal", "schoolReal", "schoolReal", "schoolReal", "schoolReal"] }).success).toBe(false);
  });

  it("ret notu ve soru metindir; uzunluk kuralı çekirdekte (10-500)", () => {
    expect(rejectInputSchema.safeParse({ applicationId: "cm1", note: "Okul doğrulanamadı." }).success).toBe(true);
    expect(rejectInputSchema.safeParse({ applicationId: "cm1", note: 12 }).success).toBe(false);
    expect(infoInputSchema.safeParse({ applicationId: "cm1", question: "Belgeni ekler misin?" }).success).toBe(true);
    expect(infoInputSchema.safeParse({ applicationId: "cm1", question: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("talepler: belge", () => {
  it("yalnızca PDF, JPG ve PNG gösterilir", () => {
    expect(isServableDocumentType("application/pdf")).toBe(true);
    expect(isServableDocumentType("image/jpeg")).toBe(true);
    expect(isServableDocumentType("image/png")).toBe(true);
    expect(isServableDocumentType("image/svg+xml")).toBe(false);
    expect(isServableDocumentType("text/html")).toBe(false);
  });

  it("yanıt önbelleğe alınmaz, türü tahmin edilmez, betik çalıştıramaz, yalnızca site çerçeveler", () => {
    const headers = documentHeaders("application/pdf", 10);
    expect(headers).toMatchObject({
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": documentContentSecurityPolicy,
      "Cross-Origin-Resource-Policy": "same-origin",
    });
    expect(documentContentSecurityPolicy).toContain("sandbox");
    expect(documentContentSecurityPolicy).toContain("default-src 'none'");
    expect(documentContentSecurityPolicy).toContain("frame-ancestors 'self'");
  });

  it("belgeye bakmak kayıt defterinde Bakış türündedir", () => {
    expect(auditKindOf("application.document_viewed")).toBe("view");
    expect(auditKindOf("application.approved")).toBe("application");
  });
});
