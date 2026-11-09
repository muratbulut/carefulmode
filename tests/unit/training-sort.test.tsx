import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrainingDriver } from "@/components/lab/driver";
import { TrainingPlayer } from "@/components/lab/training/TrainingPlayer";
import { toClientCard } from "@/lib/lab/client";
import type { Card } from "@/lib/lab/content";
import { checkPlacement, type PlacementCard } from "@/lib/lab/training";

// Oynatıcıda kutulara ayırma: ilk girişte "Nasıl oynanır" penceresi, dokunarak ya da sürükleyerek
// yerleştirme, kontrol. Doğru kutular tarayıcıda yok; sürücü söyler.

const sort: Card = {
  id: "kutular",
  type: "sort",
  title: "Hangi bilgi hangi kutuya girer?",
  hint: "",
  bins: [
    { label: "Yeşil kutu", note: "Herkesle paylaşılabilir", color: "green", icon: "globe" },
    { label: "Kırmızı kutu", note: "Kimseye verilmez", color: "red", icon: "lock" },
  ],
  items: [
    { text: "En sevdiğin oyun", icon: "gamepad", bin: 0 },
    { text: "Şifren", icon: "key", bin: 1 },
  ],
  explain: "Şifre kimseye verilmez.",
};

function setup() {
  const place = vi.fn(async (_cardId: string, picks: number[]) => ({ ok: true as const, result: checkPlacement(sort as PlacementCard, picks) }));
  const driver: TrainingDriver = { spot: vi.fn(), hint: vi.fn(), answer: vi.fn(), place, save: vi.fn(async () => ({ ok: true as const })) };
  render(
    <TrainingPlayer driver={driver} title="Kişisel veri" cards={[toClientCard(sort)]} startIndex={0} exitHref="/" playHref="/" scenarios={[]} roadmapHref="/" />,
  );
  return { place };
}

const item = (text: string) => within(screen.getByRole("group", { name: "Yerleştirilecek bilgiler" })).getByRole("button", { name: new RegExp(`^${text}\\.`) });
const bin = (label: string) => screen.getByRole("button", { name: `Seçili bilgiyi şuraya koy: ${label}` });
const check = () => screen.getByRole("button", { name: "Kontrol et" });

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("kutulara ayırma (oynatıcı)", () => {
  it("ilk girişte nasıl oynanır penceresi açılır; kapanınca bir daha kendiliğinden açılmaz", async () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Bilgileri kutularına yerleştir" });
    expect(within(dialog).getByText("Bir bilgiyi tut, doğru kutuya sürükle.")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: /Anladım, başla/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.localStorage.getItem("lab-help-sort")).toBe("1");
    // Başlıktaki düğme yeniden açar; Escape kapatır.
    await userEvent.click(screen.getByRole("button", { name: "Nasıl oynanır?" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("daha önce gördüyse pencere açılmaz", () => {
    window.localStorage.setItem("lab-help-sort", "1");
    setup();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("bilgiye sonra kutuya dokununca yerleşir; kutudaki bilgiye dokununca geri gelir", async () => {
    window.localStorage.setItem("lab-help-sort", "1");
    setup();
    expect(bin("Yeşil kutu")).toBeDisabled();
    await userEvent.click(item("Şifren"));
    expect(item("Şifren")).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(bin("Kırmızı kutu"));
    const placed = screen.getByRole("button", { name: "Şifren, Kırmızı kutu içinde. Geri almak için dokun." });
    expect(screen.getByText("YERLEŞTİRİLECEK BİLGİLER · 1 KALDI")).toBeInTheDocument();
    expect(check()).toBeDisabled();
    await userEvent.click(placed);
    expect(item("Şifren")).toBeInTheDocument();
    expect(screen.getByText("YERLEŞTİRİLECEK BİLGİLER · 2 KALDI")).toBeInTheDocument();
  });

  it("kontrol edince sürücüye kutuların numarası gider; yanlışın doğru kutusu yazılır", async () => {
    window.localStorage.setItem("lab-help-sort", "1");
    const { place } = setup();
    await userEvent.click(item("En sevdiğin oyun"));
    await userEvent.click(bin("Kırmızı kutu"));
    await userEvent.click(item("Şifren"));
    await userEvent.click(bin("Kırmızı kutu"));
    await userEvent.click(check());
    expect(place).toHaveBeenCalledWith("kutular", [1, 1]);
    expect(await screen.findByText(/1\/2 doğru/)).toBeInTheDocument();
    expect(screen.getByText("Doğrusu: Yeşil kutu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Şifren, Kırmızı kutu içinde: doğru" })).toBeDisabled();
    expect(screen.getByText("Şifre kimseye verilmez.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Devam|Bitir/ })).toBeEnabled();
  });

  it("fareyle sürükleyip kutuya bırakınca yerleşir", async () => {
    window.localStorage.setItem("lab-help-sort", "1");
    setup();
    const target = screen.getByRole("button", { name: "Seçili bilgiyi şuraya koy: Yeşil kutu" });
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => target) });
    const source = item("En sevdiğin oyun");
    fireEvent.pointerDown(source, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 10, clientY: 10 });
    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 40, clientY: 200 }));
    });
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, clientX: 40, clientY: 200 }));
    });
    expect(screen.getByRole("button", { name: "En sevdiğin oyun, Yeşil kutu içinde. Geri almak için dokun." })).toBeInTheDocument();
    Reflect.deleteProperty(document, "elementFromPoint");
  });
});
