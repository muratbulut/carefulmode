import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TrainingDriver } from "@/components/lab/driver";
import { TrainingPlayer } from "@/components/lab/training/TrainingPlayer";
import { toClientCard } from "@/lib/lab/client";
import type { Card } from "@/lib/lab/content";
import { checkPlacement, type PlacementCard } from "@/lib/lab/training";

// Oynatıcıda eşleştirme ve boşluk doldurma: yere dokun, kutudan seç, kontrol et. Doğrular
// tarayıcıda yok; sürücü söyler.

const match: Card = {
  id: "eslestir",
  type: "match",
  title: "Hangi bilgi ne işe yarar?",
  hint: "",
  pairs: [
    { left: "Ev adresin", right: "Seni bulmaya yarar" },
    { left: "Şifren", right: "Hesabına girmeye yarar" },
  ],
  explain: "Her bilgi başka bir kapıyı açar.",
};

const fill: Card = {
  id: "bosluk",
  type: "fill",
  title: "Boşlukları doldur",
  hint: "",
  sentences: ["Kartın arkasındaki koda [CVV] denir."],
  extra: ["şifre"],
  explain: "",
};

function setup(cards: Card[]) {
  const place = vi.fn(async (cardId: string, picks: number[]) => ({
    ok: true as const,
    result: checkPlacement(cards.find((c) => c.id === cardId) as PlacementCard, picks),
  }));
  const driver: TrainingDriver = {
    spot: vi.fn(),
    hint: vi.fn(),
    answer: vi.fn(),
    place,
    save: vi.fn(async () => ({ ok: true as const })),
  };
  render(
    <TrainingPlayer
      driver={driver}
      title="Kişisel veri"
      cards={cards.map(toClientCard)}
      startIndex={0}
      exitHref="/"
      playHref="/"
      scenarios={[]}
      roadmapHref="/"
    />,
  );
  return { place };
}

const next = () => screen.getByRole("button", { name: /Devam|Bitir/ });
const check = () => screen.getByRole("button", { name: "Kontrol et" });
const option = (name: string) => within(screen.getByRole("group", { name: "Seçenekler" })).getByRole("button", { name });

describe("eşleştirme kartı (oynatıcı)", () => {
  it("bütün yerler dolmadan kontrol edilemez ve sonraki karta geçilmez", async () => {
    setup([match, fill]);
    expect(check()).toBeDisabled();
    expect(next()).toBeDisabled();
    await userEvent.click(option("Seni bulmaya yarar"));
    expect(screen.getByRole("button", { name: "1. yer: Seni bulmaya yarar" })).toBeInTheDocument();
    expect(check()).toBeDisabled();
  });

  it("seçim sırayla yerlere gider; bire bir eşleştirmede seçenek başka yerden alınır", async () => {
    setup([match]);
    await userEvent.click(option("Hesabına girmeye yarar"));
    // Sıradaki boş yer kendiliğinden seçilir; aynı seçenek oraya taşınır.
    await userEvent.click(option("Hesabına girmeye yarar"));
    expect(screen.getByRole("button", { name: "1. yer: Seç" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2. yer: Hesabına girmeye yarar" })).toBeInTheDocument();
  });

  it("kontrol edince sürücüye kutudaki sıra gider; yanlış yerin doğrusu gösterilir, sonra devam edilir", async () => {
    const { place } = setup([match, fill]);
    // Kutu alfabetik: 0 "Hesabına girmeye yarar", 1 "Seni bulmaya yarar". İkisini ters koy.
    await userEvent.click(option("Hesabına girmeye yarar"));
    await userEvent.click(option("Seni bulmaya yarar"));
    await userEvent.click(check());
    expect(place).toHaveBeenCalledWith("eslestir", [0, 1]);
    expect(await screen.findByText(/0\/2 doğru/)).toBeInTheDocument();
    expect(screen.getByText("Doğrusu: Seni bulmaya yarar")).toBeInTheDocument();
    expect(screen.getByText("Her bilgi başka bir kapıyı açar.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Seçenekler" })).toBeNull();
    expect(next()).toBeEnabled();
  });
});

describe("boşluk doldurma kartı (oynatıcı)", () => {
  it("boşluğa kelime konur, kontrol edilir; doğruysa 'Hepsi doğru!'", async () => {
    const { place } = setup([fill]);
    expect(screen.getByText(/Kartın arkasındaki koda/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1. yer: boşluk" })).toBeInTheDocument();
    await userEvent.click(option("CVV"));
    // Cümle dolunca kendiliğinden geçilmez: öğrenci cümleyi yeniden okuyup kendisi geçer.
    expect(screen.queryByRole("button", { name: "Kontrol et" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Özete geç" }));
    await userEvent.click(await screen.findByRole("button", { name: "Kontrol et" }));
    expect(place).toHaveBeenCalledWith("bosluk", [0]);
    expect(await screen.findByText("Hepsi doğru!")).toBeInTheDocument();
  });

  it("dolu ve seçili yere yeniden dokunmak onu boşaltır", async () => {
    setup([fill]);
    const slot = screen.getByRole("button", { name: "1. yer: boşluk" });
    await userEvent.click(slot);
    await userEvent.click(option("şifre"));
    await userEvent.click(screen.getByRole("button", { name: "1. yer: şifre" }));
    await userEvent.click(screen.getByRole("button", { name: "1. yer: şifre" }));
    expect(screen.getByRole("button", { name: "1. yer: boşluk" })).toBeInTheDocument();
  });
});
