import { describe, expect, it } from "vitest";
import { patterns } from "@/components/background/patterns";
import { neighborhoods } from "@/lib/content/landing";
import { getMessages } from "@/lib/i18n";
import { routes, visitorNav } from "@/lib/navigation";

describe("ziyaretçi menüsü", () => {
  const t = getMessages();

  it("üst menü tasarımdaki sırayla: Yol haritası, Odalar, Gündem, Öğretmenler için, SSS", () => {
    expect(visitorNav.top.map((key) => t.nav.links[key])).toEqual(["Yol haritası", "Odalar", "Gündem", "Öğretmenler için", "SSS"]);
  });

  it("bütün adresler site içi, Türkçe ve tekrarsız", () => {
    const hrefs = Object.values(routes);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href).toMatch(/^\/[a-z-]*$/);
  });
});

describe("tanıtım içeriği", () => {
  it("beş mahalle var, slug'lar tekrarsız", () => {
    expect(neighborhoods).toHaveLength(5);
    expect(new Set(neighborhoods.map((n) => n.slug)).size).toBe(5);
  });
});

describe("akan iplikler desenleri", () => {
  it("her desende çizgi ve noktalar var", () => {
    for (const pattern of Object.values(patterns)) {
      expect(pattern.threads.length).toBeGreaterThan(0);
      for (const thread of pattern.threads) {
        expect(thread.d).toMatch(/^M[-\d]/);
        expect(thread.dots.length).toBeGreaterThan(0);
      }
    }
  });
});
