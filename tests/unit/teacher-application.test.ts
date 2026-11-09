import { describe, expect, it, vi } from "vitest";
import { isSchoolId, newSchoolChoice, parseAnswer, parseApplication, type RawApplication } from "@/lib/teacher/application-rules";
import { cleanDocumentName, detectDocumentType, documentRules, formatFileSize, readDocument } from "@/lib/teacher/document";

// lib/teacher/application.ts veritabanı istemcisini yükler; kurulmasın.
vi.mock("@/lib/db", () => ({ db: {} }));
const { dayLabel } = await import("@/lib/teacher/application");

const pdf = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];
const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46];
const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const bytes = (head: number[], size = 64) => {
  const data = new Uint8Array(size);
  data.set(head);
  return data;
};
const file = (data: Uint8Array | string, name: string, type = "") => new File([data as BlobPart], name, { type });

describe("belgenin türü ilk baytlarından bulunur", () => {
  it("PDF, JPEG ve PNG tanınır", () => {
    expect(detectDocumentType(bytes(pdf))).toBe("application/pdf");
    expect(detectDocumentType(bytes(jpeg))).toBe("image/jpeg");
    expect(detectDocumentType(bytes(png))).toBe("image/png");
  });

  it("başka dosya, eksik imza ve boş dosya tanınmaz", () => {
    expect(detectDocumentType(new TextEncoder().encode("Merhaba, bu bir PDF değil"))).toBeNull();
    expect(detectDocumentType(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull();
    expect(detectDocumentType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x00]))).toBeNull();
    expect(detectDocumentType(bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBeNull(); // GIF
    expect(detectDocumentType(new Uint8Array())).toBeNull();
  });
});

describe("formdan gelen belge", () => {
  it("alan boşsa belge yok sayılır (isteğe bağlı)", async () => {
    expect(await readDocument(null, "belge")).toEqual({ ok: true, document: null });
    expect(await readDocument("metin", "belge")).toEqual({ ok: true, document: null });
    expect(await readDocument(file(new Uint8Array(), ""), "belge")).toEqual({ ok: true, document: null });
  });

  it("uzantısı .pdf olan metin dosyası reddedilir; bildirilen türe güvenilmez", async () => {
    expect(await readDocument(file("bu bir metin dosyası", "gorev-yeri.pdf", "application/pdf"), "belge")).toEqual({ ok: false, error: "type" });
    expect(await readDocument(file(new Uint8Array(), "bos.pdf"), "belge")).toEqual({ ok: false, error: "type" });
  });

  it("5 MB'tan büyük dosya reddedilir", async () => {
    const big = bytes(pdf, documentRules.maxBytes + 1);
    expect(await readDocument(file(big, "buyuk.pdf"), "belge")).toEqual({ ok: false, error: "size" });
    const limit = await readDocument(file(bytes(pdf, documentRules.maxBytes), "tam.pdf"), "belge");
    expect(limit.ok && limit.document?.size).toBe(documentRules.maxBytes);
  });

  it("tür baytlardan yazılır, ad temizlenir", async () => {
    const result = await readDocument(file(bytes(png), "C:\\Users\\ayse\\belgem.pdf", "application/pdf"), "belge");
    expect(result).toMatchObject({ ok: true, document: { mimeType: "image/png", name: "belgem.png", size: 64 } });
    if (result.ok) expect(Array.from(result.document!.data.slice(0, 8))).toEqual(png);
  });
});

describe("belge adı", () => {
  it("klasör kısmı atılır, uzantı gerçek türe göre yazılır", () => {
    expect(cleanDocumentName("../../etc/passwd", "application/pdf", "belge")).toBe("passwd.pdf");
    expect(cleanDocumentName("/tmp/görev yeri belgesi.PDF", "application/pdf", "belge")).toBe("görev yeri belgesi.pdf");
    expect(cleanDocumentName("foto.jpeg", "image/jpeg", "belge")).toBe("foto.jpg");
    expect(cleanDocumentName("resim.exe", "image/png", "belge")).toBe("resim.png");
  });

  it("kontrol ve yön değiştiren karakterler atılır, ad boşsa yedek ad", () => {
    expect(cleanDocumentName("belge\u202Efdp.exe", "application/pdf", "belge")).toBe("belgefdp.pdf");
    expect(cleanDocumentName("a\u0000b\nc.pdf", "application/pdf", "belge")).toBe("abc.pdf");
    expect(cleanDocumentName("", "application/pdf", "belge")).toBe("belge.pdf");
    expect(cleanDocumentName(".pdf", "application/pdf", "belge")).toBe("belge.pdf");
    expect(cleanDocumentName("klasor/", "image/jpeg", "belge")).toBe("belge.jpg");
  });

  it("ad en fazla 100 karakter", () => {
    const name = cleanDocumentName(`${"a".repeat(300)}.pdf`, "application/pdf", "belge");
    expect(name).toHaveLength(documentRules.maxNameLength);
    expect(name.endsWith(".pdf")).toBe(true);
  });

  it("boyut okunur biçimde yazılır", () => {
    expect(formatFileSize(200)).toBe("1 KB");
    expect(formatFileSize(240 * 1024)).toBe("240 KB");
    expect(formatFileSize(1.25 * 1024 * 1024)).toMatch(/^1,[23] MB$/);
  });
});

describe("talep formu", () => {
  const valid: RawApplication = {
    province: "İstanbul",
    district: "Bahçelievler",
    school: "cmschool0000000000000001",
    newSchoolName: "",
    subject: "  Bilişim   Teknolojileri ",
    institutionalEmail: "",
  };

  it("listeden okul seçilen talep geçer, alanlar temizlenir", () => {
    expect(parseApplication(valid)).toEqual({
      ok: true,
      value: {
        province: "İstanbul",
        district: "Bahçelievler",
        school: { kind: "listed", id: "cmschool0000000000000001" },
        subject: "Bilişim Teknolojileri",
        institutionalEmail: null,
      },
    });
  });

  it("listede olmayan okul adıyla gider", () => {
    const result = parseApplication({ ...valid, school: newSchoolChoice, newSchoolName: "  Bornova   Ortaokulu " });
    expect(result).toMatchObject({ ok: true, value: { school: { kind: "new", name: "Bornova Ortaokulu" } } });
    expect(parseApplication({ ...valid, school: newSchoolChoice, newSchoolName: "Ok" })).toEqual({ ok: false, errors: ["newSchoolName"] });
    expect(parseApplication({ ...valid, school: newSchoolChoice, newSchoolName: "12345 678" })).toEqual({ ok: false, errors: ["newSchoolName"] });
  });

  it("il ve ilçe listeden olmalı; ilçe o ilin ilçesi olmalı", () => {
    expect(parseApplication({ ...valid, province: "Atlantis" })).toEqual({ ok: false, errors: ["place"] });
    expect(parseApplication({ ...valid, district: "Çankaya" })).toEqual({ ok: false, errors: ["place"] });
    expect(parseApplication({ ...valid, province: "", district: "", school: "" })).toEqual({ ok: false, errors: ["place"] });
  });

  it("okul seçilmeli; okul kimliği biçimi denetlenir", () => {
    expect(parseApplication({ ...valid, school: "" })).toEqual({ ok: false, errors: ["school"] });
    expect(parseApplication({ ...valid, school: "x'; DROP TABLE" })).toEqual({ ok: false, errors: ["school"] });
    expect(parseApplication({ ...valid, school: "a".repeat(65) })).toEqual({ ok: false, errors: ["school"] });
    expect(parseApplication({ ...valid, school: ["cm1"] })).toEqual({ ok: false, errors: ["school"] });
  });

  it("branş 2-60 karakter ve harf içerir", () => {
    expect(parseApplication({ ...valid, subject: "B" })).toEqual({ ok: false, errors: ["subject"] });
    expect(parseApplication({ ...valid, subject: "a".repeat(61) })).toEqual({ ok: false, errors: ["subject"] });
    expect(parseApplication({ ...valid, subject: "12" })).toEqual({ ok: false, errors: ["subject"] });
    expect(parseApplication({ ...valid, subject: undefined })).toEqual({ ok: false, errors: ["subject"] });
    expect(parseApplication({ ...valid, subject: "Fen" }).ok).toBe(true);
  });

  it("kurumsal e-posta isteğe bağlı; yazıldıysa biçimi doğru olmalı", () => {
    expect(parseApplication({ ...valid, institutionalEmail: "ayse.kaya@" })).toEqual({ ok: false, errors: ["institutionalEmail"] });
    expect(parseApplication({ ...valid, institutionalEmail: " Ayse.Kaya@Okul.k12.tr " })).toMatchObject({
      ok: true,
      value: { institutionalEmail: "ayse.kaya@okul.k12.tr" },
    });
  });

  it("birden çok hata birlikte döner", () => {
    expect(parseApplication({ ...valid, school: "", subject: "", institutionalEmail: "yanlis" })).toEqual({
      ok: false,
      errors: ["school", "subject", "institutionalEmail"],
    });
  });

  it("okul kimliği yalnızca harf, rakam, - ve _", () => {
    expect(isSchoolId("cm1abc_DEF-2")).toBe(true);
    expect(isSchoolId("../x")).toBe(false);
    expect(isSchoolId("")).toBe(false);
    expect(isSchoolId(null)).toBe(false);
  });
});

describe("bilgi istenince cevap", () => {
  it("belge yoksa en az 5 karakter; belge varsa cevap boş olabilir", () => {
    expect(parseAnswer("Tamam", false)).toEqual({ ok: true, value: "Tamam" });
    expect(parseAnswer("  ok ", false)).toEqual({ ok: false });
    expect(parseAnswer("", true)).toEqual({ ok: true, value: null });
    expect(parseAnswer(undefined, false)).toEqual({ ok: false });
  });

  it("en fazla 300 karakter", () => {
    expect(parseAnswer("a".repeat(300), false).ok).toBe(true);
    expect(parseAnswer("a".repeat(301), true)).toEqual({ ok: false });
  });

  it("satır sonları kalır, kontrol karakterleri ve fazla boşluk atılır", () => {
    expect(parseAnswer("Görev yeri\r\n\r\n\r\n\r\nbelgesi  ekledim\u0007", false)).toEqual({ ok: true, value: "Görev yeri\n\nbelgesi ekledim" });
  });
});

describe("tarih", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  it("bugün, dün, sonra gün ve ay (Türkiye saatiyle)", () => {
    expect(dayLabel(new Date("2026-10-11T08:00:00Z"), now)).toBe("Bugün");
    expect(dayLabel(new Date("2026-10-10T20:59:00Z"), now)).toBe("Dün");
    // 10 Ekim 21:30 UTC, Türkiye'de 11 Ekim 00:30.
    expect(dayLabel(new Date("2026-10-10T21:30:00Z"), now)).toBe("Bugün");
    expect(dayLabel(new Date("2026-10-02T09:00:00Z"), now)).toBe("2 Ekim");
  });
});
