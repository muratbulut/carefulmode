import { describe, expect, it } from "vitest";
import { localTrainingDriver } from "@/components/lab/preview/local-driver";
import type { Card, TrainingContent } from "@/lib/lab/content";
import { checkPlacement, hintFor, validHintRequest, type PlacementCard } from "@/lib/lab/training";

// Hoca öncesi revizeler (Murat, 3 Kasım): hoşgörülü kutulara ayırma ve tıkla-bulda ipucu.

const sort = {
  id: "kutular",
  type: "sort",
  title: "Hangi bilgi hangi kutuya girer?",
  hint: "",
  bins: [
    { label: "Yeşil kutu", note: "", color: "green", icon: "globe" },
    { label: "Sarı kutu", note: "", color: "yellow", icon: "users" },
    { label: "Kırmızı kutu", note: "", color: "red", icon: "lock" },
  ],
  items: [
    { text: "En sevdiğin oyun", icon: "gamepad", bin: 0 },
    { text: "Fotoğrafın", icon: "camera", bin: 1 },
    { text: "Şifren", icon: "key", bin: 2 },
  ],
  explain: "",
} satisfies PlacementCard;

describe("hoşgörülü kutulara ayırma (lenient)", () => {
  it("daha kapalı kutu doğru sayılır ve yumuşak diye işaretlenir; daha açık kutu yanlış kalır", () => {
    const card = { ...sort, lenient: true };
    expect(checkPlacement(card, [0, 2, 2])).toEqual({ correct: true, slots: [true, true, true], answer: [0, 1, 2], explain: "", soft: [false, true, false] });
    expect(checkPlacement(card, [1, 1, 2])).toMatchObject({ correct: true, soft: [true, false, false] });
    expect(checkPlacement(card, [0, 0, 2])).toMatchObject({ correct: false, slots: [true, false, true], soft: [false, false, false] });
    expect(checkPlacement(card, [0, 1, 1])).toMatchObject({ correct: false, slots: [true, true, false] });
  });

  it("hoşgörüsüz kartta eski kural: yalnızca doğru kutu, soft alanı yok", () => {
    const result = checkPlacement(sort, [0, 2, 2]);
    expect(result).toEqual({ correct: false, slots: [true, false, true], answer: [0, 1, 2], explain: "" });
  });
});

const find: Card = {
  id: "mail",
  type: "clickFind",
  title: "Şüpheli yerleri bul",
  hint: "",
  mail: { sender: "Kampanya", address: "a@b.xyz", subject: "Kazandın", time: "10:00", paragraphs: ["Merhaba", "Kartını yaz"], button: "", footer: "" },
  spots: [
    { part: "address", text: "Adres tuhaf." },
    { part: "p1", text: "Kart istiyor.", hint: "Senden ne istendiğini oku." },
  ],
};

describe("tıkla-bulda ipucu", () => {
  it("bulunmamış parçaların ipuçları sırayla döner; parçanın adı söylenmez", () => {
    if (find.type !== "clickFind") throw new Error();
    expect(hintFor(find, [], 0)).toBe("Gönderenin e-posta adresine harf harf bak.");
    expect(hintFor(find, [], 1)).toBe("Senden ne istendiğini oku.");
    expect(hintFor(find, [], 2)).toBe("Gönderenin e-posta adresine harf harf bak.");
    expect(hintFor(find, ["address"], 0)).toBe("Senden ne istendiğini oku.");
    expect(hintFor(find, ["address", "p1"], 0)).toBeNull();
  });

  it("biçimsiz istek reddedilir", () => {
    expect(validHintRequest(["address"], 0)).toBe(true);
    expect(validHintRequest(["<script>"], 0)).toBe(false);
    expect(validHintRequest("address", 0)).toBe(false);
    expect(validHintRequest([], -1)).toBe(false);
    expect(validHintRequest([], 1.5)).toBe(false);
  });

  it("önizleme sürücüsü de ipucu verir; tıkla-bul olmayan kartta reddeder", async () => {
    const content = { cards: [find, sort as Card] } as TrainingContent;
    const driver = localTrainingDriver(content);
    expect(await driver.hint("mail", [], 1)).toEqual({ ok: true, hint: "Senden ne istendiğini oku." });
    expect((await driver.hint("kutular", [], 0)).ok).toBe(false);
  });
});
