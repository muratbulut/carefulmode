import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrainingDriver } from "@/components/lab/driver";
import { TrainingPlayer } from "@/components/lab/training/TrainingPlayer";
import { toClientCard } from "@/lib/lab/client";
import type { Card } from "@/lib/lab/content";
import { checkPlacement, type PlacementCard } from "@/lib/lab/training";

// Oynatıcıda eşleştirme ve boşluk doldurma: ilk girişte kart türüne göre "Nasıl oynanır" penceresi,
// dokunarak ya da sürükleyerek yerleştirme. Doğru eşler tarayıcıda yok; sürücü söyler.

const match: Card = {
  id: "eslestir",
  type: "match",
  title: "Hangisi ne?",
  hint: "",
  pairs: [
    { left: "Kartın arkasındaki üç hane", right: "CVV" },
    { left: "Telefona gelen tek kullanımlık kod", right: "SMS kodu" },
  ],
  explain: "",
};

const fill: Card = {
  id: "doldur",
  type: "fill",
  title: "Boşluğu doldur",
  hint: "",
  sentences: ["Kartın arkasındaki koda [CVV] denir."],
  extra: ["PIN"],
  explain: "",
};

function setup(card: Card) {
  const place = vi.fn(async (_cardId: string, picks: number[]) => ({ ok: true as const, result: checkPlacement(card as PlacementCard, picks) }));
  const driver: TrainingDriver = { spot: vi.fn(), hint: vi.fn(), answer: vi.fn(), place, save: vi.fn(async () => ({ ok: true as const })) };
  render(
    <TrainingPlayer driver={driver} title="Kişisel veri" cards={[toClientCard(card)]} startIndex={0} exitHref="/" playHref="/" scenarios={[]} roadmapHref="/" />,
  );
  return { place };
}

const option = (text: string) => within(screen.getByRole("group", { name: "Seçenekler" })).getByRole("button", { name: text });
const slot = (name: string) => screen.getByRole("button", { name });
const check = () => screen.getByRole("button", { name: "Kontrol et" });

/** Fareyle seçeneği tutup `target` yerine bırakır (parmağın altındaki öğeyi `elementFromPoint` verir). */
function dragTo(source: HTMLElement, target: HTMLElement) {
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => target) });
  fireEvent.pointerDown(source, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 10, clientY: 10 });
  act(() => {
    window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 40, clientY: 200 }));
  });
  act(() => {
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, clientX: 40, clientY: 200 }));
  });
  Reflect.deleteProperty(document, "elementFromPoint");
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("eşleştirme ve boşluk doldurma: nasıl oynanır", () => {
  it("eşleştirmede ilk girişte açılır; kapanınca bir daha kendiliğinden açılmaz, düğmeyle açılır", async () => {
    setup(match);
    const dialog = screen.getByRole("dialog", { name: "Her satırı doğru seçenekle eşleştir" });
    expect(within(dialog).getByText("Bir seçeneği tut, soldakine uyan yere sürükle.")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: /Anladım, başla/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.localStorage.getItem("lab-help-match")).toBe("1");
    await userEvent.click(screen.getByRole("button", { name: "Nasıl oynanır?" }));
    expect(screen.getByRole("dialog", { name: "Her satırı doğru seçenekle eşleştir" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("boşluk doldurmanın kendi penceresi var; başka kartın penceresini görmüş olmak saymaz", async () => {
    window.localStorage.setItem("lab-help-sort", "1");
    window.localStorage.setItem("lab-help-match", "1");
    setup(fill);
    const dialog = screen.getByRole("dialog", { name: "Boşlukları doğru kelimeyle doldur" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Kapat" }));
    expect(window.localStorage.getItem("lab-help-fill")).toBe("1");
  });

  it("daha önce gördüyse pencere açılmaz", () => {
    window.localStorage.setItem("lab-help-match", "1");
    setup(match);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("eşleştirme ve boşluk doldurma: sürükle bırak", () => {
  it("eşleştirmede seçenek sürüklenip bırakılan yere girer; dokunarak seçilen sıradaki boş yere gider", async () => {
    window.localStorage.setItem("lab-help-match", "1");
    const { place } = setup(match);
    // İlk yer seçili ama seçenek ikinci yere bırakılıyor.
    dragTo(option("SMS kodu"), slot("2. yer: Seç"));
    expect(slot("2. yer: SMS kodu")).toBeInTheDocument();
    expect(slot("1. yer: Seç")).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(option("CVV"));
    expect(slot("1. yer: CVV")).toBeInTheDocument();
    await userEvent.click(check());
    expect(place).toHaveBeenCalledWith("eslestir", [0, 1]);
    expect(await screen.findByText("Hepsi doğru!")).toBeInTheDocument();
  });

  it("boşluk doldurmada kelime boşluğa sürüklenince yerleşir", async () => {
    window.localStorage.setItem("lab-help-fill", "1");
    const { place } = setup(fill);
    // Cümleler tek tek gelir; "Kontrol et" sondaki özettedir.
    expect(screen.queryByRole("button", { name: "Kontrol et" })).toBeNull();
    dragTo(option("PIN"), slot("1. yer: boşluk"));
    expect(slot("1. yer: PIN")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Özete geç" }));
    await userEvent.click(await screen.findByRole("button", { name: "Kontrol et" }));
    expect(place).toHaveBeenCalledWith("doldur", [1]);
    expect(await screen.findByText("Doğrusu: CVV")).toBeInTheDocument();
  });

  it("boşluğa bırakılmayan sürükleme bir şey koymaz, ardından gelen tıklama da sayılmaz", () => {
    window.localStorage.setItem("lab-help-fill", "1");
    setup(fill);
    const source = option("CVV");
    dragTo(source, document.body);
    fireEvent.click(source);
    expect(slot("1. yer: boşluk")).toBeInTheDocument();
  });
});
