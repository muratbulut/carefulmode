import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chalkboard, chalkTickMs } from "@/components/teachers/Chalkboard";

// Öğretmenler için kahramanındaki tahta (4 Kasım, 16 B).

let reduce = false;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {}
      observe() {
        this.callback([{ isIntersecting: true }]);
      }
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  reduce = false;
});

const lines = () => [...document.querySelectorAll(".cb-line")].map((el) => el.textContent);

describe("tahta", () => {
  it("tebeşir iki satırı harf harf yazar, sonra silgi siler ve ders baştan başlar", () => {
    render(<Chalkboard />);
    expect(screen.getByRole("img", { name: /Tıklamadan önce bir düşün/ })).toBeInTheDocument();
    expect(lines()).toEqual(["", ""]);
    act(() => vi.advanceTimersByTime(chalkTickMs * 10));
    expect(lines()[0]).toBe("Tıkla");
    act(() => vi.advanceTimersByTime(chalkTickMs * 80));
    expect(lines()).toEqual(["Tıklamadan önce", "bir düşün."]);
    // Bekleme ve silme biter, ders baştan başlar.
    act(() => vi.advanceTimersByTime(chalkTickMs * 160));
    expect(lines()[1]).toBe("");
  });

  it("Hareketi azalt açıksa yazı son haliyle durur", () => {
    reduce = true;
    render(<Chalkboard />);
    expect(lines()).toEqual(["Tıklamadan önce", "bir düşün."]);
    act(() => vi.advanceTimersByTime(chalkTickMs * 400));
    expect(lines()).toEqual(["Tıklamadan önce", "bir düşün."]);
    expect(document.querySelector(".cb-eraser")).toBeNull();
  });
});
