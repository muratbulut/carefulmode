import { afterEach, describe, expect, it } from "vitest";
import { THEME_SCRIPT, isTheme, otherTheme, themeCookie, themeFromCookie } from "@/lib/theme";

function clearCookies() {
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

describe("tema yardımcıları", () => {
  it("sadece koyu ve gri temayı tanır", () => {
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("gray")).toBe(true);
    expect(isTheme("light")).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });

  it("diğer temayı verir", () => {
    expect(otherTheme("dark")).toBe("gray");
    expect(otherTheme("gray")).toBe("dark");
  });

  it("çerez metninden temayı okur, bilinmeyen değeri yok sayar", () => {
    expect(themeFromCookie("theme=gray")).toBe("gray");
    expect(themeFromCookie("a=1; theme=dark; b=2")).toBe("dark");
    expect(themeFromCookie("theme=purple")).toBeNull();
    expect(themeFromCookie("oldtheme=gray")).toBeNull();
    expect(themeFromCookie("")).toBeNull();
  });

  it("bir yıllık, bütün sitede geçerli çerez yazar; https'te Secure ekler", () => {
    expect(themeCookie("gray", false)).toBe("theme=gray; Path=/; Max-Age=31536000; SameSite=Lax");
    expect(themeCookie("dark", true)).toMatch(/; Secure$/);
  });
});

describe("ilk boyamadan önce çalışan tema betiği", () => {
  afterEach(() => {
    clearCookies();
    document.documentElement.setAttribute("data-theme", "dark");
  });

  function run() {
    // Betik tarayıcıda <head> içinde nasıl çalışıyorsa öyle çalıştırılır.
    new Function(THEME_SCRIPT)();
  }

  it("çerezde gri varsa <html data-theme> değerini gri yapar", () => {
    document.cookie = "theme=gray; Path=/";
    run();
    expect(document.documentElement.getAttribute("data-theme")).toBe("gray");
  });

  it("çerez yoksa varsayılan koyu tema kalır", () => {
    run();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("çerezdeki bilinmeyen değeri sayfaya yazmaz", () => {
    document.cookie = 'theme="><img src=x>; Path=/';
    run();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
