import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TrainingDriver } from "@/components/lab/driver";
import { TrainingPlayer } from "@/components/lab/training/TrainingPlayer";
import { isReady, trainingChecklist } from "@/lib/lab/checklist";
import { toClientCard } from "@/lib/lab/client";
import { parseTraining, type Card } from "@/lib/lab/content";
import { checkPlacement, type PlacementCard } from "@/lib/lab/training";

// Tur 7 kartları (Murat, 1 Kasım): bilgi kartının açılan düzenleri (keşfet, adım adım, banka kartı)
// bütün maddeler açılmadan Devam'ı açmaz; mini test 4 şıklı ve çizimli; boşluk doldurma cümle cümle.

const points = [
  { title: "Kimlik", text: "Adın soyadın, T.C. kimlik numaran." },
  { title: "İletişim", text: "Telefon numaran, mail adresin." },
  { title: "Konum ve okul", text: "Ev adresin, okulun." },
  { title: "Para", text: "Kart bilgileri, SMS onay kodu." },
];

const explore: Card = { id: "kesfet", type: "info", title: "Kişisel veri nedir?", layout: "explore", paragraphs: ["Giriş.", "Hepsi açılınca."], points };
const steps: Card = {
  id: "adimlar",
  type: "info",
  title: "Dur, sor, kontrol et",
  layout: "steps",
  paragraphs: ["Acele etme."],
  points: [
    { title: "Dur", text: "Formu doldurma." },
    { title: "Sor", text: "Ailene göster." },
    { title: "Kontrol et", text: "Resmî uygulamayı aç." },
    { title: "Bildir", text: "Bildir ve engelle." },
  ],
};
const bank: Card = {
  id: "kart",
  type: "info",
  title: "Kartın önü, arkası ve SMS kodu",
  layout: "bankCard",
  paragraphs: ["Üç şey yeter.", "SMS kodu bir imzadır."],
  points: [
    { title: "Kart numarası ve son kullanma tarihi", text: "Kartın önünde.", icon: "card" },
    { title: "CVV", text: "Kartın arkasındaki 3 hane.", icon: "flip" },
    { title: "SMS onay kodu", text: "İmzadır.", icon: "message" },
    { title: "Kart ailenin ise", text: "Velinin izni olmadan olmaz.", icon: "users" },
  ],
};
const list: Card = { id: "liste", type: "info", title: "Düz bilgi", paragraphs: ["Metin."], points: [] };
const quiz: Card = {
  id: "test",
  type: "quiz",
  art: "gift",
  question: "Bir okul çekilişi formu hangisini istemez?",
  options: ["Adını ve sınıfını", "Kimlik numaranı ve CVV'yi", "Hangi hediyeyi seçtiğini", "Hediyeyi hangi gün alacağını"],
  answer: 1,
  explain: "Gerçek çekiliş kart istemez.",
};
const fill: Card = {
  id: "bosluk",
  type: "fill",
  title: "Boşlukları doldur",
  hint: "",
  sentences: ["Kartın arkasındaki koda [CVV] denir.", "SMS kodu bir [imza] gibidir."],
  extra: ["şifre"],
  explain: "",
};

function setup(cards: Card[]) {
  const driver: TrainingDriver = {
    spot: vi.fn(),
    hint: vi.fn(),
    answer: vi.fn(async (cardId: string, option: number) => {
      const card = cards.find((c) => c.id === cardId);
      const answer = card?.type === "quiz" ? card.answer : 0;
      return { ok: true as const, result: { correct: option === answer, answer, explain: card?.type === "quiz" ? card.explain : "" } };
    }),
    place: vi.fn(async (cardId: string, picks: number[]) => ({
      ok: true as const,
      result: checkPlacement(cards.find((c) => c.id === cardId) as PlacementCard, picks),
    })),
    save: vi.fn(async () => ({ ok: true as const })),
  };
  render(
    <TrainingPlayer driver={driver} title="Kişisel veri" cards={cards.map(toClientCard)} startIndex={0} exitHref="/" playHref="/" scenarios={[]} roadmapHref="/" />,
  );
  return driver;
}

const next = () => screen.getByRole("button", { name: /^(Devam|Bitir)/ });

describe("bilgi kartı: keşfet düzeni", () => {
  it("dört alan açılmadan Devam kilitli; her alan açılınca metni görünür, sayaç ilerler", async () => {
    setup([explore, list]);
    expect(next()).toBeDisabled();
    expect(screen.getByText("Devam için bütün alanları aç")).toBeInTheDocument();
    const fields = within(screen.getByRole("list", { name: "Profil alanları" })).getAllByRole("button");
    expect(fields).toHaveLength(4);
    await userEvent.click(fields[0]);
    expect(fields[0]).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Adın soyadın, T.C. kimlik numaran.")).toBeInTheDocument();
    expect(screen.getByText("1/4 keşfedildi")).toBeInTheDocument();
    for (const field of fields.slice(1, 3)) await userEvent.click(field);
    expect(next()).toBeDisabled();
    expect(screen.queryByText("Hepsi açılınca.")).toBeNull();
    await userEvent.click(fields[3]);
    expect(next()).toBeEnabled();
    expect(screen.getByText("Hepsi açılınca.")).toBeInTheDocument();
    // Aynı alana yeniden dokunmak onu kapatır ama açılmış sayılır.
    await userEvent.click(fields[3]);
    expect(fields[3]).toHaveAttribute("aria-expanded", "false");
    expect(next()).toBeEnabled();
  });

  it("geri dönülünce açılan alanlar unutulmaz", async () => {
    setup([explore, list]);
    for (const field of within(screen.getByRole("list", { name: "Profil alanları" })).getAllByRole("button")) await userEvent.click(field);
    await userEvent.click(next());
    expect(screen.getByText("Düz bilgi")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Geri/ }));
    expect(next()).toBeEnabled();
  });

  it("düz liste kartı kilitlenmez", () => {
    setup([list, explore]);
    expect(next()).toBeEnabled();
  });
});

describe("bilgi kartı: adım adım düzeni", () => {
  it("adımlar sırayla açılır; kilitli adıma dokunulamaz, dördü açılınca Devam açılır", async () => {
    setup([steps, list]);
    const step = (name: string) => screen.getByRole("button", { name });
    expect(step("1. adım: Dur")).toBeEnabled();
    expect(step("2. adım: Sor")).toBeDisabled();
    expect(step("4. adım: Bildir")).toBeDisabled();
    expect(next()).toBeDisabled();
    await userEvent.click(step("1. adım: Dur"));
    expect(screen.getByText("Formu doldurma.")).toBeInTheDocument();
    expect(step("2. adım: Sor")).toBeEnabled();
    expect(step("3. adım: Kontrol et")).toBeDisabled();
    await userEvent.click(step("2. adım: Sor"));
    await userEvent.click(step("3. adım: Kontrol et"));
    expect(next()).toBeDisabled();
    expect(screen.getByText("Devam için bütün adımları aç")).toBeInTheDocument();
    await userEvent.click(step("4. adım: Bildir"));
    expect(next()).toBeEnabled();
    expect(screen.getByText("Hepsi tamam: Dur, sor, kontrol et, bildir.")).toBeInTheDocument();
  });
});

describe("bilgi kartı: banka kartı düzeni", () => {
  it("dört madde gezilmeden Devam yok; SMS maddesinden sonra imza paragrafı çıkar", async () => {
    setup([bank, list]);
    const items = within(screen.getByRole("list", { name: "Kartın bölümleri" })).getAllByRole("button");
    expect(next()).toBeDisabled();
    expect(screen.getByText("Maddelere dokun, kart ona göre değişsin")).toBeInTheDocument();
    await userEvent.click(items[1]);
    expect(screen.getByText("Kart döndü: arkadaki 3 hane CVV")).toBeInTheDocument();
    expect(screen.queryByText("SMS kodu bir imzadır.")).toBeNull();
    await userEvent.click(items[2]);
    expect(screen.getByText("SMS kodu bir imzadır.")).toBeInTheDocument();
    await userEvent.click(items[0]);
    expect(next()).toBeDisabled();
    await userEvent.click(items[3]);
    expect(next()).toBeEnabled();
    expect(screen.getByText("4/4 gezildi")).toBeInTheDocument();
  });
});

describe("mini test: 4 şık ve çizim", () => {
  it("dört şık görünür; cevaplanmadan Devam yok, cevaptan sonra doğru şık ve açıklama", async () => {
    const driver = setup([quiz, list]);
    const answers = within(screen.getByRole("group", { name: "Cevaplar" })).getAllByRole("button");
    expect(answers).toHaveLength(4);
    expect(next()).toBeDisabled();
    await userEvent.click(answers[3]);
    expect(driver.answer).toHaveBeenCalledWith("test", 3);
    expect(await screen.findByText("Tam değil. Doğrusu B.")).toBeInTheDocument();
    expect(screen.getByText("Gerçek çekiliş kart istemez.")).toBeInTheDocument();
    expect(answers[0]).toBeDisabled();
    expect(next()).toBeEnabled();
  });

  it("tarayıcıya giden testte çizim var, doğru cevap ve açıklama yok", () => {
    const client = toClientCard(quiz);
    expect(client).toEqual({ id: "test", type: "quiz", question: quiz.type === "quiz" ? quiz.question : "", options: quiz.type === "quiz" ? quiz.options : [], art: "gift" });
  });
});

describe("boşluk doldurma: cümle cümle", () => {
  it("cümle dolunca kendiliğinden geçmez, 'Sonraki cümle' ile geçilir; özette cümleye dokununca geri döner", async () => {
    window.localStorage.setItem("lab-help-fill", "1");
    setup([fill]);
    expect(screen.getByText("1. CÜMLE")).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("group", { name: "Seçenekler" })).getByRole("button", { name: "CVV" }));
    // Dolu cümle ekranda kalır: öğrenci yeniden okuyabilir.
    expect(screen.getByText("1. CÜMLE")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sonraki cümle" }));
    expect(await screen.findByText("2. CÜMLE")).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("group", { name: "Seçenekler" })).getByRole("button", { name: "şifre" }));
    await userEvent.click(screen.getByRole("button", { name: "Özete geç" }));
    const check = await screen.findByRole("button", { name: "Kontrol et" });
    expect(check).toBeEnabled();
    // Özetteki ikinci cümleye dokun: o cümleye dönülür, kelime değiştirilir.
    await userEvent.click(screen.getByRole("button", { name: /SMS kodu bir/ }));
    expect(screen.getByText("2. CÜMLE")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "2. yer: şifre" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Seçenekler" })).getByRole("button", { name: "imza" }));
    await userEvent.click(screen.getByRole("button", { name: "Özete geç" }));
    await userEvent.click(await screen.findByRole("button", { name: "Kontrol et" }));
    expect(await screen.findByText("Hepsi doğru!")).toBeInTheDocument();
  });
});

describe("şema ve yayına hazırlık", () => {
  it("yeni alanlar isteğe bağlı: eski kartlar aynen okunur", () => {
    const old = { id: "eski", type: "quiz", question: "Soru?", options: ["A", "B", "C"], answer: 0, explain: "" };
    const content = parseTraining({ meta: { name: "Eski oda", summary: "Kısa" }, cards: [list, old, { id: "eslestir", type: "match", title: "Eşle", pairs: [{ left: "a", right: "b" }] }] });
    expect(content?.cards[0]).not.toHaveProperty("layout");
    expect(content?.cards[1]).not.toHaveProperty("art");
    expect(content?.cards[2]).toMatchObject({ pairs: [{ left: "a", right: "b" }] });
    expect(toClientCard(content!.cards[1])).toMatchObject({ art: null });
  });

  it("bilinmeyen düzen, ikon ya da çizim şemaya uymaz", () => {
    expect(parseTraining({ meta: { name: "Oda", summary: "Kısa" }, cards: [{ ...explore, layout: "grid" }] })).toBeNull();
    expect(parseTraining({ meta: { name: "Oda", summary: "Kısa" }, cards: [{ ...quiz, art: "rocket" }] })).toBeNull();
    expect(parseTraining({ meta: { name: "Oda", summary: "Kısa" }, cards: [{ ...bank, points: [{ title: "A", text: "B", icon: "nope" }] }] })).toBeNull();
  });

  it("banka kartı dört madde, diğer açılan düzenler en az iki dolu madde ister", () => {
    const ready = (card: Card) => isReady(trainingChecklist(parseTraining({ meta: { name: "Oda adı", summary: "Kısa" }, cards: [card, list, list] })!));
    expect(ready(bank)).toBe(true);
    expect(ready({ ...bank, points: bank.type === "info" ? bank.points.slice(0, 3) : [] })).toBe(false);
    expect(ready(steps)).toBe(true);
    expect(ready({ ...explore, points: [points[0]] })).toBe(false);
    expect(ready({ ...explore, points: [points[0], { title: "Boş", text: "" }] })).toBe(false);
  });
});
