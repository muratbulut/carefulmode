import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { roomArt, roomArtOf } from "@/lib/lab/art";

const dir = path.join(process.cwd(), "public", "odalar");

describe("oda çizimleri", () => {
  it("listedeki her odanın çizimi var, klasörde listede olmayan çizim yok", () => {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".svg"))
      .map((f) => f.replace(/\.svg$/, ""))
      .sort();
    expect(files).toEqual([...roomArt].sort());
  });

  it("çizimler dışarıdan bir şey yüklemez ve betik içermez", () => {
    for (const slug of roomArt) {
      const svg = readFileSync(path.join(dir, `${slug}.svg`), "utf8");
      expect(svg, slug).not.toMatch(/<script|<foreignObject|<image|\bon[a-z]+=|href="(?!#)/i);
      expect(svg, slug).toMatch(/role="img" aria-label="[^"]+"/);
      // <img> ile açılan SVG geçerli XML olmalı (ör. aynı nitelik iki kez yazılırsa görsel kırık çıkar).
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      expect(doc.getElementsByTagName("parsererror"), slug).toHaveLength(0);
    }
  });

  it("çizimi olmayan odada adres yok", () => {
    expect(roomArtOf("eski-telefonunu-sat")).toBe("/odalar/eski-telefonunu-sat.svg");
    expect(roomArtOf("yeni-oda")).toBeNull();
  });
});
