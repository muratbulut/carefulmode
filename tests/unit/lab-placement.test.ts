import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { localTrainingDriver } from "@/components/lab/preview/local-driver";
import { isReady, trainingChecklist } from "@/lib/lab/checklist";
import { toClientCard } from "@/lib/lab/client";
import { fillParts, parseTraining, type Card, type TrainingContent } from "@/lib/lab/content";
import { checkPlacement, firstUnanswered, placementBank, validPicks, type PlacementCard } from "@/lib/lab/training";

// Eşleştirme ve boşluk doldurma kartları (Para Çarşısı, 1 Kasım): şema, tarayıcıya giden içerik,
// sunucudaki denetim, bitiş kuralı ve "Yayına hazır mı?".

const meta = { name: "Kişisel veri", summary: "Kısa açıklama" };

const match: Card = {
  id: "eslestir",
  type: "match",
  title: "Hangi bilgi ne işe yarar?",
  hint: "",
  pairs: [
    { left: "Ev adresin", right: "Seni bulmaya yarar" },
    { left: "Şifren", right: "Hesabına girmeye yarar" },
    { left: "Onay kodu", right: "Bir işlemi onaylamaya yarar" },
  ],
  explain: "Her bilgi başka bir kapıyı açar.",
};

const boxes: Card = {
  id: "kutular",
  type: "match",
  title: "Hangi kutuya?",
  hint: "",
  pairs: [
    { left: "En sevdiğin oyun", right: "Yeşil" },
    { left: "Ev adresin", right: "Kırmızı" },
    { left: "Şifren", right: "Kırmızı" },
  ],
  explain: "",
};

const fill: Card = {
  id: "bosluk",
  type: "fill",
  title: "Boşlukları doldur",
  hint: "",
  sentences: ["Kartın arkasındaki koda [CVV] denir.", "SMS kodu bir [imza] gibidir, [kimseye] söylenmez."],
  extra: ["herkese", "CVV"],
  explain: "Kod imzadır.",
};

function training(cards: Card[]): TrainingContent {
  return parseTraining({ meta, cards })!;
}

const placement = (card: Card) => card as PlacementCard;
/** Doğru seçimler, öğrencinin gördüğü kutudaki sırayla. */
const rightPicks = (card: PlacementCard) => checkPlacement(card, []).answer;

describe("eşleştirme ve boşluk doldurma: şema", () => {
  it("iki tür de şemaya uyar; eski kartlar etkilenmez", () => {
    const content = training([match, boxes, fill]);
    expect(content.cards.map((c) => c.type)).toEqual(["match", "match", "fill"]);
  });

  it("eksik alanlar varsayılanla okunur (hint, explain, extra)", () => {
    const content = parseTraining({ meta, cards: [{ id: "e", type: "match", title: "E", pairs: [] }, { id: "b", type: "fill", title: "B" }] })!;
    expect(content.cards[0]).toMatchObject({ hint: "", explain: "", pairs: [] });
    expect(content.cards[1]).toMatchObject({ sentences: [], extra: [] });
  });

  it("sınırlar: en fazla 6 eş, 6 cümle, 6 yanıltıcı kelime", () => {
    const pairs = Array.from({ length: 7 }, (_, i) => ({ left: `a${i}`, right: `b${i}` }));
    expect(parseTraining({ meta, cards: [{ ...match, pairs }] })).toBeNull();
    expect(parseTraining({ meta, cards: [{ ...fill, sentences: Array(7).fill("a [b]") }] })).toBeNull();
    expect(parseTraining({ meta, cards: [{ ...fill, extra: Array(7).fill("x") }] })).toBeNull();
  });

  it("boşluklar köşeli parantezden çıkar", () => {
    expect(fillParts("SMS kodu bir [imza] gibidir, [ kimseye ] söylenmez.")).toEqual({
      texts: ["SMS kodu bir ", " gibidir, ", " söylenmez."],
      answers: ["imza", "kimseye"],
    });
    expect(fillParts("Boşluk yok.")).toEqual({ texts: ["Boşluk yok."], answers: [] });
    // 40 harften uzun parantez boşluk sayılmaz.
    expect(fillParts(`[${"a".repeat(41)}]`).answers).toEqual([]);
  });
});

describe("eşleştirme ve boşluk doldurma: tarayıcıya giden içerik (Lab güvenliği)", () => {
  it("eşleştirmede doğru eşler ve açıklama gitmez; sağ sütun alfabetik bir kutudur", () => {
    const client = toClientCard(match);
    expect(client).toEqual({
      id: "eslestir",
      type: "match",
      title: "Hangi bilgi ne işe yarar?",
      hint: "",
      lefts: ["Ev adresin", "Şifren", "Onay kodu"],
      icons: [null, null, null],
      bank: ["Bir işlemi onaylamaya yarar", "Hesabına girmeye yarar", "Seni bulmaya yarar"],
    });
    const text = JSON.stringify(client);
    for (const secret of ['"pairs"', '"right"', '"explain"', '"answer"', "kapıyı"]) expect(text, secret).not.toContain(secret);
  });

  it("kutulara ayırmada aynı sağ kutuda bir kez görünür", () => {
    expect(toClientCard(boxes)).toMatchObject({ bank: ["Kırmızı", "Yeşil"] });
  });

  it("boşluk doldurmada cevaplar yerlerinden çıkarılır; kelimeler yalnızca alfabetik kutuda", () => {
    const client = toClientCard(fill);
    expect(client).toEqual({
      id: "bosluk",
      type: "fill",
      title: "Boşlukları doldur",
      hint: "",
      sentences: [["Kartın arkasındaki koda ", " denir."], ["SMS kodu bir ", " gibidir, ", " söylenmez."]],
      bank: ["CVV", "herkese", "imza", "kimseye"],
    });
    const text = JSON.stringify(client);
    for (const secret of ["[CVV]", "[imza]", '"extra"', '"explain"', "Kod imzadır"]) expect(text, secret).not.toContain(secret);
  });

  it("kutunun sırası yazarın sırasını ele vermez (Türkçe alfabe)", () => {
    const card = placement({ ...fill, sentences: ["[çanta] [ceket] [şapka] [sabun] [ızgara] [ilaç]"], extra: [] });
    expect(placementBank(card)).toEqual(["ceket", "çanta", "ızgara", "ilaç", "sabun", "şapka"]);
  });
});

describe("eşleştirme ve boşluk doldurma: sunucuda denetim", () => {
  it("eşleştirme: her yer ayrı denetlenir, doğrular kutudaki sırayla döner", () => {
    const card = placement(match);
    // Kutu: [onaylamaya, girmeye, bulmaya]; doğrusu adres -> bulmaya (2), şifre -> girmeye (1), kod -> onaylamaya (0).
    expect(checkPlacement(card, [2, 1, 0])).toEqual({ correct: true, slots: [true, true, true], answer: [2, 1, 0], explain: "Her bilgi başka bir kapıyı açar." });
    expect(checkPlacement(card, [1, 2, 0])).toMatchObject({ correct: false, slots: [false, false, true], answer: [2, 1, 0] });
  });

  it("kutulara ayırma: aynı kutu birden çok yere konabilir", () => {
    const card = placement(boxes);
    expect(checkPlacement(card, [1, 0, 0]).correct).toBe(true);
    expect(checkPlacement(card, [0, 0, 0]).slots).toEqual([false, true, true]);
  });

  it("boşluk doldurma: yanıltıcı kelime ve cevapla aynı yanıltıcı kelime tek kez sayılır", () => {
    const card = placement(fill);
    expect(rightPicks(card)).toEqual([0, 2, 3]);
    expect(checkPlacement(card, [0, 2, 3]).correct).toBe(true);
    expect(checkPlacement(card, [0, 2, 1])).toMatchObject({ correct: false, slots: [true, true, false] });
  });

  it("biçimce bozuk seçimler reddedilir (eksik, fazla, kesirli, kutu dışı)", () => {
    const card = placement(fill);
    expect(validPicks(card, [0, 2, 3])).toBe(true);
    for (const picks of [[0, 2], [0, 2, 3, 1], [0, 2, 3.5], [0, 2, 4], [0, 2, -1], ["0", 2, 3], null, "0,2,3", { 0: 0 }]) {
      expect(validPicks(card, picks), JSON.stringify(picks)).toBe(false);
    }
  });

  it("eğitim, eşleştirme ve boşluk doldurma cevaplanmadan bitmez (B1)", () => {
    const content = training([{ id: "bilgi", type: "info", title: "Bilgi", paragraphs: ["a"], points: [] }, match, fill]);
    expect(firstUnanswered(content.cards, [])).toBe(1);
    expect(firstUnanswered(content.cards, ["eslestir"])).toBe(2);
    expect(firstUnanswered(content.cards, ["eslestir", "bosluk"])).toBeNull();
  });

  it("önizleme sürücüsü sunucuyla aynı denetler ve bitiş kuralını uygular", async () => {
    const content = training([match, fill]);
    const driver = localTrainingDriver(content);
    expect(await driver.save(2)).toEqual({ ok: false, reason: "unanswered", card: 0 });
    expect(await driver.place("eslestir", [2, 1, 0])).toEqual({ ok: true, result: checkPlacement(placement(match), [2, 1, 0]) });
    expect(await driver.place("eslestir", [2, 1])).toEqual({ ok: false, reason: "invalid" });
    expect(await driver.place("yok", [0])).toEqual({ ok: false, reason: "invalid" });
    expect(await driver.save(2)).toEqual({ ok: false, reason: "unanswered", card: 1 });
    // Yanlış yerleştirme de cevaptır.
    expect(await driver.place("bosluk", [1, 1, 1])).toMatchObject({ ok: true, result: { correct: false } });
    expect(await driver.save(2)).toEqual({ ok: true });
  });
});

describe("eşleştirme ve boşluk doldurma: yayına hazır mı", () => {
  const ready = (card: Card) =>
    isReady(trainingChecklist(training([{ id: "bilgi", type: "info", title: "Bilgi", paragraphs: ["a"], points: [] }, card, { ...fill, id: "son" }])));

  it("dolu kartlar hazır; kutulara ayırma (aynı sağ) da hazır", () => {
    expect(ready(match)).toBe(true);
    expect(ready(boxes)).toBe(true);
  });

  it("eksik eşleştirme hazır değil", () => {
    expect(ready({ ...match, title: " " })).toBe(false);
    expect(ready({ ...match, pairs: [match.pairs[0]] })).toBe(false);
    expect(ready({ ...match, pairs: [...match.pairs.slice(1), { left: "Adres", right: " " }] })).toBe(false);
  });

  it("boşluksuz ya da boş cümleli boşluk doldurma hazır değil", () => {
    expect(ready({ ...fill, sentences: ["Boşluk yok."] })).toBe(false);
    expect(ready({ ...fill, sentences: ["Kod [imza] gibidir.", ""] })).toBe(false);
    expect(ready({ ...fill, sentences: ["Kod [ ] gibidir."] })).toBe(false);
    expect(ready({ ...fill, extra: [""] })).toBe(false);
  });
});

describe("Para Çarşısı temel eğitimi (oda dosyası)", () => {
  const file = JSON.parse(readFileSync("labs/rooms/para-carsisi/kisisel-veri-ve-para-guvenligi.json", "utf8"));
  const content = parseTraining(file.content)!;

  it("kişisel veri videosu ve kartından sonra kutulara ayırma, eşleştirme ve boşluk doldurma alıştırmaları gelir", () => {
    expect(content.cards.slice(0, 5).map((c) => c.type)).toEqual(["video", "info", "sort", "match", "fill"]);
    expect(isReady(trainingChecklist(content))).toBe(true);
  });

  it("videolar yazılı kartların önüne gelir ve soru sorar", () => {
    // 1 Kasım (Murat): videolar 1. ve 5. kartın yerine geçmedi, önlerine geldi.
    const ids = content.cards.map((c) => c.id);
    expect(ids.indexOf("kisisel-veri-videosu") + 1).toBe(ids.indexOf("kisisel-veri"));
    expect(ids.indexOf("kart-videosu") + 1).toBe(ids.indexOf("kartin-onu-arkasi"));
    for (const card of content.cards) if (card.type === "video") expect(card.question, card.id).not.toBeNull();
  });

  it("alıştırmaların hepsi doğru yolla çözülebilir", () => {
    for (const card of content.cards) {
      if (card.type !== "match" && card.type !== "fill" && card.type !== "sort") continue;
      expect(checkPlacement(card, rightPicks(card)).correct, card.id).toBe(true);
    }
  });
});
