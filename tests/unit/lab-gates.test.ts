import { describe, expect, it } from "vitest";
import { homeworkLabs, homeworkSelection } from "@/lib/classroom/homework";
import { basicTrainingOf, gateOf, isBasicPath, routeOrder, trainingsOf, withGates, type GateLab } from "@/lib/lab/gates";

// Mahalle içindeki eğitimler ve kilitler (15 Ekim, Murat): temel eğitim her zaman açık, ileri
// eğitim temelden sonra açılır, her senaryoyu kendi eğitimi açar. Ödevde seçilen odayı açan
// eğitim kendiliğinden ödeve girer.

const lab = (id: string, type: GateLab["type"], sortOrder: number, unlockedById: string | null = null, neighborhoodId = "hesap"): GateLab => ({
  id,
  neighborhoodId,
  type,
  sortOrder,
  unlockedById,
});

// Hesap Kalesi: temel eğitim (şifre), ileri eğitim (mahremiyet). İki senaryo temelin, biri ilerinin.
const labs: GateLab[] = [
  lab("profil", "SCENARIO", 3, "mahremiyet"),
  lab("mahremiyet", "TRAINING", 1),
  lab("kod", "SCENARIO", 1),
  lab("sifre", "TRAINING", 0),
  lab("sms", "SCENARIO", 2, "sifre"),
  lab("baska", "TRAINING", 0, null, "olta"),
];
const ids = (list: GateLab[]) => list.map((l) => l.id);

describe("mahalle kilitleri", () => {
  it("sırası en küçük eğitim temel eğitimdir", () => {
    expect(ids(trainingsOf(labs, "hesap"))).toEqual(["sifre", "mahremiyet"]);
    expect(basicTrainingOf(labs, "hesap")?.id).toBe("sifre");
    expect(basicTrainingOf(labs, "yok")).toBeNull();
  });

  it("temel eğitim açık, ileri eğitimi temel, senaryoyu kendi eğitimi açar", () => {
    const by = (id: string) => gateOf(labs.find((l) => l.id === id)!, labs)?.id ?? null;
    expect(by("sifre")).toBeNull();
    expect(by("mahremiyet")).toBe("sifre");
    expect(by("kod")).toBe("sifre"); // boşsa temel eğitim
    expect(by("sms")).toBe("sifre");
    expect(by("profil")).toBe("mahremiyet");
  });

  it("açan eğitim listede yoksa ya da başka mahalleninse temel eğitim açar", () => {
    const withoutAdvanced = labs.filter((l) => l.id !== "mahremiyet");
    expect(gateOf(labs[0], withoutAdvanced)?.id).toBe("sifre");
    expect(gateOf(lab("x", "SCENARIO", 9, "baska"), labs)?.id).toBe("sifre");
    // Mahallede hiç eğitim yoksa senaryo açıktır.
    expect(gateOf(lab("y", "SCENARIO", 0, null, "bos"), labs)).toBeNull();
  });

  it("rota: her eğitim, ardından açtığı senaryolar", () => {
    expect(ids(routeOrder(labs, "hesap"))).toEqual(["sifre", "kod", "sms", "mahremiyet", "profil"]);
    expect(ids(routeOrder([lab("s2", "SCENARIO", 2, null, "bos"), lab("s1", "SCENARIO", 1, null, "bos")], "bos"))).toEqual(["s1", "s2"]);
  });

  it("temel yol: temel eğitim ve onun senaryoları", () => {
    expect(labs.filter((l) => l.neighborhoodId === "hesap" && isBasicPath(l, labs)).map((l) => l.id).sort()).toEqual(["kod", "sifre", "sms"]);
  });

  it("açan eğitimler kendiliğinden eklenir, rota sırasıyla", () => {
    expect(ids(withGates(["profil"], labs, "hesap"))).toEqual(["sifre", "mahremiyet", "profil"]);
    expect(ids(withGates(["sms"], labs, "hesap"))).toEqual(["sifre", "sms"]);
    // Bilinmeyen ya da başka mahallenin kimliği düşer.
    expect(ids(withGates(["sms", "baska", "silinmis"], labs, "hesap"))).toEqual(["sifre", "sms"]);
  });
});

describe("ödevin odaları", () => {
  it("oda seçimi olmayan ödev mahallenin bütün odalarıdır", () => {
    expect(ids(homeworkLabs({ neighborhoodId: "hesap", labIds: [] }, labs))).toEqual(["sifre", "kod", "sms", "mahremiyet", "profil"]);
  });

  it("seçilen odalar ve açan eğitimleri; yayından kalkan oda düşer", () => {
    expect(ids(homeworkLabs({ neighborhoodId: "hesap", labIds: ["profil"] }, labs))).toEqual(["sifre", "mahremiyet", "profil"]);
    expect(ids(homeworkLabs({ neighborhoodId: "hesap", labIds: ["sifre", "kod"] }, labs.filter((l) => l.id !== "kod")))).toEqual(["sifre"]);
  });

  it("öğretmenin seçimi: boş, başka mahallenin ya da yayında olmayan oda geçersiz", () => {
    expect(homeworkSelection("hesap", ["profil"], labs)).toEqual(["sifre", "mahremiyet", "profil"]);
    expect(homeworkSelection("hesap", [], labs)).toBeNull();
    expect(homeworkSelection("hesap", ["baska"], labs)).toBeNull();
    expect(homeworkSelection("hesap", ["sms", "silinmis"], labs)).toBeNull();
  });
});
