import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FormMascot } from "@/components/mascot/FormMascot";
import { Mascot, mascotMoods } from "@/components/mascot/Mascot";
import { PageOverlay, SHOW_AFTER_MS, SIGN_OUT_EVENT } from "@/components/mascot/PageOverlay";
import { LOOK_EVENT, lookAt } from "@/components/mascot/RoomMascot";
import { Spinner } from "@/components/status/Spinner";

let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}));

describe("maskot", () => {
  it("her zamanki hâlinde arada göz kırpar, süstür", () => {
    const { container } = render(<Mascot />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("mc", "mc-mood-idle", "mc-blink");
  });

  it("başka bir ruh hâlinde ya da tepki oynarken kırpmaz", () => {
    const { container, rerender } = render(<Mascot mood="hacked" />);
    expect(container.querySelector("svg")).toHaveClass("mc-mood-hacked");
    expect(container.querySelector("svg")).not.toHaveClass("mc-blink");
    rerender(<Mascot reaction="cheer" />);
    expect(container.querySelector("svg")).toHaveClass("mc-r-cheer");
    expect(container.querySelector("svg")).not.toHaveClass("mc-blink");
  });

  it("renkleri yalnızca tema değişkenlerinden alır; her ruh hâlinin kuralı var", () => {
    const css = readFileSync("components/mascot/mascot.css", "utf8");
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    for (const mood of mascotMoods.filter((m) => m !== "idle")) expect(css, mood).toContain(`.mc-mood-${mood}`);
  });

  it("göz beyazı iki temada da tanımlı", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css.match(/--logo-white:/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("bekleme işareti ana renk düğmesinde düğmenin yazı rengini alır", () => {
    const { container } = render(<Spinner tone="onAccent" />);
    expect(container.querySelector("svg")).toHaveClass("mc-mood-loading", "mc-on-accent");
  });
});

describe("giriş formundaki maskot", () => {
  afterEach(() => {
    delete document.documentElement.dataset.mascotEyes;
  });

  function form() {
    return render(
      <>
        <FormMascot />
        <input type="email" aria-label="E-posta" />
        <input type="password" aria-label="Şifre" autoComplete="current-password" />
      </>,
    );
  }

  it("şifre alanında gözünü kapatır, menüdeki logo da kapatır; çıkınca açar", () => {
    const { container } = form();
    fireEvent.focus(screen.getByLabelText("Şifre"));
    expect(container.querySelector("svg")).toHaveClass("mc-mood-shut");
    expect(document.documentElement.dataset.mascotEyes).toBe("shut");
    fireEvent.blur(screen.getByLabelText("Şifre"));
    expect(container.querySelector("svg")).toHaveClass("mc-mood-idle");
    expect(document.documentElement.dataset.mascotEyes).toBeUndefined();
  });

  it("şifre görünür yapılınca da (metin alanı) kapalı kalır", () => {
    const { container } = form();
    const input = screen.getByLabelText("Şifre") as HTMLInputElement;
    input.type = "text";
    fireEvent.focus(input);
    expect(container.querySelector("svg")).toHaveClass("mc-mood-shut");
  });

  it("e-postayı yazarken yazının ucuna bakar; metnin kendisini hiçbir yere yazmaz", () => {
    const { container } = form();
    const svg = container.querySelector("svg")!;
    const email = screen.getByLabelText("E-posta") as HTMLInputElement;
    fireEvent.focus(email);
    const start = Number(svg.style.getPropertyValue("--mc-x"));
    email.value = "ayse.yilmaz@okul.example";
    fireEvent.input(email);
    expect(Number(svg.style.getPropertyValue("--mc-x"))).toBeGreaterThan(start);
    expect(container.innerHTML).not.toContain("ayse");
    expect(JSON.stringify(document.documentElement.dataset)).not.toContain("ayse");
  });
});

describe("sayfa geçişi örtüsü", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pathname = "/";
    window.history.replaceState(null, "", "/");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function link(href: string, attrs: Record<string, string> = {}) {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = "git";
    for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
    document.body.appendChild(a);
    return a;
  }

  it("sayfa 0,3 saniyede açılmazsa görünür, adres değişince kalkar", () => {
    const view = render(<PageOverlay />);
    const a = link("/odalar");
    // İptal edilemeyen tıklama: jsdom sayfayı değiştirmeye çalışmaz, bizim dinleyici yine görür.
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    expect(screen.queryByTestId("page-overlay")).toBeNull();
    act(() => vi.advanceTimersByTime(SHOW_AFTER_MS - 10));
    expect(screen.queryByTestId("page-overlay")).toBeNull();
    act(() => vi.advanceTimersByTime(20));
    expect(screen.getByTestId("page-overlay")).toHaveAttribute("role", "status");
    expect(screen.getByText("Sayfa açılıyor")).toBeInTheDocument();
    pathname = "/odalar";
    view.rerender(<PageOverlay />);
    expect(screen.queryByTestId("page-overlay")).toBeNull();
    a.remove();
  });

  it("Next'in Link'i gibi tıklamayı iptal eden bağlantıda da görünür", () => {
    render(<PageOverlay />);
    const a = link("/odalar");
    const cancel = (e: Event) => e.preventDefault();
    a.addEventListener("click", cancel);
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    act(() => vi.advanceTimersByTime(SHOW_AFTER_MS + 10));
    expect(screen.getByTestId("page-overlay")).toBeInTheDocument();
    a.remove();
  });

  it("sayfadan çıkmayı soran editör tıklamayı durdurunca görünmez", () => {
    render(<PageOverlay />);
    const a = link("/odalar");
    const ask = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("click", ask, true);
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByTestId("page-overlay")).toBeNull();
    document.removeEventListener("click", ask, true);
    a.remove();
  });

  it("dış bağlantıda, yeni sekmede ve aynı sayfadaki çapada görünmez", () => {
    render(<PageOverlay />);
    const links = [link("https://ornek.example/"), link("/odalar", { target: "_blank" }), link("/#adimlar")];
    for (const a of links) a.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByTestId("page-overlay")).toBeNull();
    for (const a of links) a.remove();
  });

  it("çıkışta hemen görünür, sonra kalkar", () => {
    render(<PageOverlay />);
    act(() => {
      window.dispatchEvent(new Event(SIGN_OUT_EVENT));
    });
    expect(screen.getByText("Çıkış yapılıyor")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByTestId("page-overlay")).toBeNull();
  });
});

describe("odadaki maskot", () => {
  it("bağlantıya bakma olayı yalnızca öğeyi taşır (tuzak bilgisi yok)", () => {
    const seen: unknown[] = [];
    const onLook = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener(LOOK_EVENT, onLook);
    const el = document.createElement("button");
    lookAt(el);
    lookAt(null);
    window.removeEventListener(LOOK_EVENT, onLook);
    expect(seen).toEqual([el, null]);
  });
});
