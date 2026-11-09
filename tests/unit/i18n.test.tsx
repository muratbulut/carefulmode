import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { format, getMessages, locales, rich } from "@/lib/i18n";
import { tr } from "@/lib/i18n/messages/tr";

/** Sözlüğün anahtar ağacı: ["nav.links.home", "landing.hero.assurances.0.short", ...] */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
}

describe("sözlük", () => {
  it("her dilin sözlüğü Türkçeyle aynı anahtarlara sahip", () => {
    const expected = keyPaths(tr).sort();
    for (const locale of locales) expect(keyPaths(getMessages(locale)).sort()).toEqual(expected);
  });

  it("boş metin yok", () => {
    for (const locale of locales) {
      const messages = getMessages(locale);
      for (const path of keyPaths(messages)) {
        const value = path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], messages);
        expect(value, path).toBeTypeOf("string");
        expect((value as string).trim(), path).not.toBe("");
      }
    }
  });

  it("format yer tutucuları doldurur, bilinmeyeni olduğu gibi bırakır", () => {
    expect(format("{page} hazırlanıyor", { page: "Kayıt" })).toBe("Kayıt hazırlanıyor");
    expect(format("ADIM {no} · {x}", { no: "01" })).toBe("ADIM 01 · {x}");
  });

  it("rich etiketli parçayı bileşenle çizer", () => {
    const parts = rich("Önce, <accent>burada.</accent> Son", { accent: (chunk) => <b>{chunk}</b> });
    expect(parts.filter(isValidElement)).toHaveLength(1);
    expect(renderToStaticMarkup(<p>{parts}</p>)).toBe("<p>Önce, <b>burada.</b> Son</p>");
    expect(renderToStaticMarkup(<p>{rich("<x>iç</x>", {})}</p>)).toBe("<p>iç</p>");
  });
});

// Arayüz metni bileşenlere yazılmaz. JSX içindeki metni ESLint (react/jsx-no-literals) yakalar;
// bu test niteliklere ve koda yazılmış metni yakalar. Yorumlar Türkçe olabilir, onlar atlanır.
const SOURCE_DIRS = ["app", "components"];
const SKIP = [/^app\/api\//];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !SKIP.some((pattern) => pattern.test(path)) ? [path] : [];
  });
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("bileşenlerde sabit metin yok", () => {
  const files = SOURCE_DIRS.flatMap((dir) => sourceFiles(dir));

  it("kaynak dosyaları bulundu", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files)("%s", (file) => {
    const code = withoutComments(readFileSync(file, "utf8"));
    // Türkçe harf geçen her şey metindir (sınıf adı, adres ve kod adları ASCII).
    const turkish = code.split("\n").filter((line) => /[çğıöşüÇĞİÖŞÜâÂ]/.test(line));
    expect(turkish, "Türkçe metin sözlüğe (lib/i18n/messages/tr.ts) taşınmalı").toEqual([]);
    // Ekranda ya da ekran okuyucuda görünen niteliklere düz metin yazılmaz.
    const props = code.match(/\b(aria-label|alt|placeholder|title|label|doneLabel|description|text)="[^"]*"/g) ?? [];
    expect(props, "metin sözlükten gelmeli").toEqual([]);
  });
});
