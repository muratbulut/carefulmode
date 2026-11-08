import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MissionPoints } from "@/components/lab/mission/MissionPoints";
import { BadgeToast } from "@/components/status/BadgeToast";
import { iconedPoints } from "@/lib/lab/content";

const tone = vi.hoisted(() => ({ badgeTone: vi.fn() }));
vi.mock("@/components/lab/mission/tones", () => tone);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe("görev kartı maddeleri (10. revize)", () => {
  it("boş madde ikonuyla birlikte düşer, ikonu olmayan madde null olur", () => {
    expect(iconedPoints(["Al", " ", "Harca", "Kullan"], ["tag", "globe", "card"])).toEqual({
      points: ["Al", "Harca", "Kullan"],
      pointIcons: ["tag", "card", null],
    });
    expect(iconedPoints(["Al"])).toEqual({ points: ["Al"], pointIcons: [null] });
  });

  it("önemli kısım kalın yazılır, her madde kendi satırında", () => {
    render(<MissionPoints points={["**TeknoPazar**'dan al", "En çok **1.250 TL** harca"]} icons={["tag", null]} tone="sheet" stagger />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].querySelector("b")?.textContent).toBe("TeknoPazar");
    expect(items[1]).toHaveTextContent("En çok 1.250 TL harca");
    // Maddeler sırayla belirir: ikinci madde birinciden sonra.
    expect(Number.parseInt(items[1].style.animationDelay)).toBeGreaterThan(Number.parseInt(items[0].style.animationDelay));
  });

  it("panelde sırayla belirmez; madde yoksa liste çizilmez", () => {
    const { container, rerender } = render(<MissionPoints points={["Sat"]} tone="panel" />);
    expect(screen.getByRole("listitem").style.animationDelay).toBe("");
    rerender(<MissionPoints points={[]} tone="panel" />);
    expect(container.querySelector("ul")).toBeNull();
  });
});

describe("yeni rozet bildirimi (13. revize)", () => {
  beforeEach(() => tone.badgeTone.mockClear());

  it("rozetin adını, öbür rozetleri ve Rozetlerimi gör bağlantısını gösterir; ses çalar", () => {
    render(<BadgeToast codes={["ilk-rapor", "oltalama-avcisi"]} onClose={() => {}} />);
    const toast = screen.getByTestId("badge-toast");
    expect(toast).toHaveTextContent("YENİ ROZET!");
    expect(toast).toHaveTextContent("İlk rapor");
    expect(toast).toHaveTextContent("ve Oltalama avcısı");
    expect(screen.getByRole("link", { name: /Rozetlerimi gör/ })).toHaveAttribute("href", "/profil?bolum=rozetler");
    expect(tone.badgeTone).toHaveBeenCalledTimes(1);
  });

  it("odanın sesi kapalıysa ses çalmaz", () => {
    window.localStorage.setItem("lab-sound-muted", "1");
    render(<BadgeToast codes={["kart-kurdu"]} onClose={() => {}} />);
    expect(screen.getByTestId("badge-toast")).toBeInTheDocument();
    expect(tone.badgeTone).not.toHaveBeenCalled();
  });

  it("kapat düğmesiyle ya da birkaç saniye sonra kapanır; rozet yoksa bir şey çizilmez", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { rerender } = render(<BadgeToast codes={["kart-kurdu"]} onClose={onClose} duration={9000} />);
    fireEvent.click(screen.getByRole("button", { name: "Bildirimi kapat" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(9000));
    expect(onClose).toHaveBeenCalledTimes(2);
    rerender(<BadgeToast codes={[]} onClose={onClose} />);
    expect(screen.queryByTestId("badge-toast")).toBeNull();
  });
});
