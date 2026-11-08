import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LegalSections } from "@/components/legal/LegalSections";
import { getLegalDocument, legalDocumentKeys } from "@/lib/content/legal";
import { routes } from "@/lib/navigation";

describe("yasal metinler", () => {
  it("üç belge var, her birinin adresi tanımlı", () => {
    expect(legalDocumentKeys).toEqual(["kvkk", "privacy", "terms"]);
    for (const key of legalDocumentKeys) expect(routes[key]).toMatch(/^\/[a-z]+$/);
  });

  it("her bölümde başlık, kısaca ve tam metin dolu", () => {
    for (const key of legalDocumentKeys) {
      const doc = getLegalDocument(key);
      expect(doc.sections.length, key).toBeGreaterThan(3);
      expect(doc.version).toMatch(/^\d+\.\d+$/);
      for (const section of doc.sections) {
        expect(section.title.trim()).not.toBe("");
        expect(section.short.trim()).not.toBe("");
        expect(section.full.length).toBeGreaterThan(section.short.length);
      }
    }
  });

  it("bilinmeyenler köşeli parantezli yer tutucu olarak kalır", () => {
    const all = legalDocumentKeys.flatMap((key) => getLegalDocument(key).sections.map((s) => `${s.short} ${s.full}`)).join(" ");
    for (const placeholder of ["[VERİ SORUMLUSU]", "[KVKK BAŞVURU E-POSTASI]", "[SÜRE]", "[İLETİŞİM E-POSTASI]"]) {
      expect(all).toContain(placeholder);
    }
  });

  it("ürün adı metne gömülmez, {brand} ile gelir", () => {
    for (const key of legalDocumentKeys) {
      for (const section of getLegalDocument(key).sections) {
        expect(`${section.title} ${section.short} ${section.full}`).not.toContain("Careful Mode");
      }
    }
  });
});

describe("Sadece kısaca oku", () => {
  const sections = getLegalDocument("kvkk").sections;

  it("açılınca tam metinler ve Tam metin düğmeleri gizlenir, kısaca kalır", async () => {
    render(<LegalSections sections={sections} />);
    const toggle = screen.getByRole("switch", { name: "Sadece kısaca oku" });
    const full = screen.getByText(sections[0].full);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    // Masaüstünde tam metin görünür (telefonda "Tam metin" ile açılır).
    expect(full).toHaveClass("md:block");
    expect(screen.getAllByRole("button", { name: "Tam metin" })).toHaveLength(sections.length);

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(full).toHaveClass("hidden");
    expect(full).not.toHaveClass("md:block");
    expect(screen.queryByRole("button", { name: "Tam metin" })).not.toBeInTheDocument();
    expect(screen.getByText(sections[0].short)).toBeInTheDocument();
  });

  it("telefonda Tam metin bölümü açar ve kapatır", async () => {
    render(<LegalSections sections={sections} />);
    const [first] = screen.getAllByRole("button", { name: "Tam metin" });
    expect(first).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(first.getAttribute("aria-controls")!)).toHaveTextContent(sections[0].full);
  });
});
