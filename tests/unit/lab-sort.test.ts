import { describe, expect, it } from "vitest";
import { localTrainingDriver } from "@/components/lab/preview/local-driver";
import { blankCard } from "@/lib/admin/editor-model";
import { isReady, trainingChecklist } from "@/lib/lab/checklist";
import { toClientCard } from "@/lib/lab/client";
import { parseTraining, type Card, type TrainingContent } from "@/lib/lab/content";
import { checkPlacement, firstUnanswered, placementAnswer, placementBank, validPicks, type PlacementCard } from "@/lib/lab/training";

// Kutulara ayırma kartı (Tur 6, 1 Kasım): renkli kutular ve ikonlu bilgiler. Şema, tarayıcıya giden
// içerik, sunucudaki denetim, bitiş kuralı ve "Yayına hazır mı?".

const meta = { name: "Kişisel veri", summary: "Kısa açıklama" };

const sort: Card = {
  id: "kutular",
  type: "sort",
  title: "Hangi bilgi hangi kutuya girer?",
  hint: "",
  bins: [
    { label: "Yeşil kutu", note: "Herkesle paylaşılabilir", color: "green", icon: "globe" },
    { label: "Sarı kutu", note: "Düşünerek", color: "yellow", icon: "users" },
    { label: "Kırmızı kutu", note: "Kimseye verilmez", color: "red", icon: "lock" },
  ],
  items: [
    { text: "En sevdiğin oyun", icon: "gamepad", bin: 0 },
    { text: "Okulunun adı", icon: "school", bin: 1 },
    { text: "Ev adresin", icon: "house", bin: 2 },
    { text: "Şifren", icon: "key", bin: 2 },
  ],
  explain: "Adres ve şifre kimseye verilmez.",
};

const info: Card = { id: "bilgi", type: "info", title: "Bilgi", paragraphs: ["a"], points: [] };

function training(cards: Card[]): TrainingContent {
  return parseTraining({ meta, cards })!;
}

const card = sort as PlacementCard;

describe("kutulara ayırma: şema", () => {
  it("şemaya uyar; bilginin ikonu yazılmazsa etiket olur", () => {
    const content = parseTraining({
      meta,
      cards: [{ ...sort, items: [{ text: "Adres", bin: 1 }] }],
    })!;
    expect(content.cards[0]).toMatchObject({ type: "sort", items: [{ text: "Adres", icon: "tag", bin: 1 }] });
  });

  it("sınırlar: en fazla 4 kutu, 8 bilgi; renk ve ikon listeden", () => {
    const bins = Array.from({ length: 5 }, () => sort.bins[0]);
    expect(parseTraining({ meta, cards: [{ ...sort, bins }] })).toBeNull();
    const items = Array.from({ length: 9 }, () => sort.items[0]);
    expect(parseTraining({ meta, cards: [{ ...sort, items }] })).toBeNull();
    expect(parseTraining({ meta, cards: [{ ...sort, bins: [{ ...sort.bins[0], color: "#ff0000" }] }] })).toBeNull();
    expect(parseTraining({ meta, cards: [{ ...sort, items: [{ text: "a", icon: "<svg>", bin: 0 }] }] })).toBeNull();
    expect(parseTraining({ meta, cards: [{ ...sort, items: [{ text: "a", icon: "tag", bin: 4 }] }] })).toBeNull();
  });
});

describe("kutulara ayırma: tarayıcıya giden içerik (Lab güvenliği)", () => {
  it("kutular ve bilgiler gider; hangi bilginin hangi kutuya gittiği ve açıklama gitmez", () => {
    const client = toClientCard(sort);
    expect(client).toEqual({
      id: "kutular",
      type: "sort",
      title: "Hangi bilgi hangi kutuya girer?",
      hint: "",
      bins: sort.bins,
      items: [
        { text: "En sevdiğin oyun", icon: "gamepad" },
        { text: "Okulunun adı", icon: "school" },
        { text: "Ev adresin", icon: "house" },
        { text: "Şifren", icon: "key" },
      ],
    });
    const text = JSON.stringify(client);
    for (const secret of ['"bin"', '"explain"', '"answer"', "kimseye verilmez."]) expect(text, secret).not.toContain(secret);
  });
});

describe("kutulara ayırma: sunucuda denetim", () => {
  it("kutular yazarın sırasıyla; doğrular kutunun numarasıyla döner", () => {
    expect(placementBank(card)).toEqual(["Yeşil kutu", "Sarı kutu", "Kırmızı kutu"]);
    expect(placementAnswer(card)).toEqual([0, 1, 2, 2]);
    expect(checkPlacement(card, [0, 1, 2, 2])).toEqual({ correct: true, slots: [true, true, true, true], answer: [0, 1, 2, 2], explain: "Adres ve şifre kimseye verilmez." });
    expect(checkPlacement(card, [0, 2, 2, 1])).toMatchObject({ correct: false, slots: [true, false, true, false] });
  });

  it("aynı adlı iki kutu da numarasıyla ayrı denetlenir", () => {
    const twin = { ...sort, bins: [sort.bins[0], { ...sort.bins[0] }], items: [{ text: "a", icon: "tag" as const, bin: 1 }] } as PlacementCard;
    expect(checkPlacement(twin, [0]).correct).toBe(false);
    expect(checkPlacement(twin, [1]).correct).toBe(true);
  });

  it("biçimce bozuk seçimler reddedilir", () => {
    expect(validPicks(card, [0, 1, 2, 2])).toBe(true);
    for (const picks of [[0, 1, 2], [0, 1, 2, 2, 0], [0, 1, 2, 3], [0, 1, 2, -1], [0, 1, 2, 1.5], ["0", 1, 2, 2], null]) {
      expect(validPicks(card, picks), JSON.stringify(picks)).toBe(false);
    }
  });

  it("kutulara ayırma cevaplanmadan eğitim bitmez; önizleme sürücüsü aynı denetler", async () => {
    const content = training([info, sort]);
    expect(firstUnanswered(content.cards, [])).toBe(1);
    const driver = localTrainingDriver(content);
    expect(await driver.save(2)).toEqual({ ok: false, reason: "unanswered", card: 1 });
    expect(await driver.place("kutular", [0, 1, 2])).toEqual({ ok: false, reason: "invalid" });
    expect(await driver.place("kutular", [2, 2, 2, 2])).toMatchObject({ ok: true, result: { correct: false, slots: [false, false, true, true] } });
    expect(await driver.save(2)).toEqual({ ok: true });
  });
});

describe("kutulara ayırma: yayına hazır mı", () => {
  const ready = (c: Card) => isReady(trainingChecklist(training([info, c, { ...info, id: "son" }])));

  it("dolu kart hazır", () => {
    expect(ready(sort)).toBe(true);
  });

  it("eksik ya da bozuk kart hazır değil", () => {
    expect(ready({ ...sort, title: " " })).toBe(false);
    expect(ready({ ...sort, bins: [sort.bins[0]], items: sort.items.map((i) => ({ ...i, bin: 0 })) })).toBe(false);
    expect(ready({ ...sort, bins: [sort.bins[0], { ...sort.bins[1], label: " " }], items: sort.items.map((i) => ({ ...i, bin: 0 })) })).toBe(false);
    expect(ready({ ...sort, bins: [sort.bins[0], { ...sort.bins[1], label: "yeşil KUTU" }], items: sort.items.map((i) => ({ ...i, bin: 0 })) })).toBe(false);
    expect(ready({ ...sort, items: [sort.items[0]] })).toBe(false);
    expect(ready({ ...sort, items: [...sort.items, { text: "", icon: "tag", bin: 0 }] })).toBe(false);
    // İki kutuya düşen kartta üçüncü kutudaki bilgi artık yok.
    expect(ready({ ...sort, bins: sort.bins.slice(0, 2) })).toBe(false);
  });

  it("formdaki boş kart üç renkli kutuyla başlar, doldurulmadan hazır değil", () => {
    const blank = blankCard("sort-1", "sort");
    expect(blank).toMatchObject({ type: "sort", bins: [{ color: "green" }, { color: "yellow" }, { color: "red" }] });
    expect(ready(blank)).toBe(false);
  });
});
