import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

describe("ThemeToggle", () => {
  afterEach(() => {
    document.cookie = "theme=; Max-Age=0; Path=/";
    document.documentElement.setAttribute("data-theme", "dark");
  });

  it("koyu ve gri arasında geçer ve tercihi çereze yazar", async () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(<ThemeToggle />);
    const button = screen.getByTestId("theme-toggle");

    await userEvent.click(button);
    expect(document.documentElement.getAttribute("data-theme")).toBe("gray");
    expect(document.cookie).toContain("theme=gray");

    await userEvent.click(button);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.cookie).toContain("theme=dark");
  });

  it("açılışta çerezdeki temayı yeniden uygular", () => {
    document.cookie = "theme=gray; Path=/";
    document.documentElement.setAttribute("data-theme", "dark");
    render(<ThemeToggle />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("gray");
  });

  it("iki tema için de anlaşılır bir etiketi var", () => {
    render(<ThemeToggle />);
    expect(screen.getByText("Açık temaya geç")).toBeInTheDocument();
    expect(screen.getByText("Koyu temaya geç")).toBeInTheDocument();
  });
});
