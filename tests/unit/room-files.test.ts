import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isPublishable } from "@/lib/admin/compare";
import { validateContent } from "@/lib/admin/validate";
import { neighborhoods } from "@/lib/content/landing";
import { maxScore, type ScenarioContent } from "@/lib/lab/content";
import { planRoom, type ExistingLab, type Room } from "@/prisma/rooms";

// Depodaki odalar (labs/rooms/<mahalle>/<oda-adresi>.json). Başlangıç verisi içeriği denetlemeden
// yazar (migration imajında lib/ yok), bu yüzden şemaya uymayan ya da yayına hazır olmayan dosya
// burada, PR'da düşer; canlıya gitmez.

const roomsDir = "labs/rooms";
const files = readdirSync(roomsDir)
  .filter((folder) => statSync(join(roomsDir, folder)).isDirectory())
  .flatMap((folder) =>
    readdirSync(join(roomsDir, folder))
      .filter((name) => name.endsWith(".json"))
      .map((name) => ({ folder, name, text: readFileSync(join(roomsDir, folder, name), "utf8") })),
  );

type Json = {
  slug: string;
  neighborhood: string;
  type: string;
  template: string;
  sortOrder: number;
  status: string;
  unlockedBy?: string;
  content: unknown;
};
const rooms = files.map((f) => ({ ...f, path: `${f.folder}/${f.name}`, json: JSON.parse(f.text) as Json }));

/** Her oda için kural ihlalleri; hiç oda yokken de testler çalışır (boş liste). */
const problems = (check: (room: (typeof rooms)[number]) => string | null) =>
  rooms.map((room) => (check(room) ? `${room.path}: ${check(room)}` : null)).filter(Boolean);

describe("oda dosyaları (labs/rooms)", () => {
  it("yalnızca mahalle klasörlerinde durur; adres dosya adıyla, mahalle klasörle aynı", () => {
    const known = new Set(neighborhoods.map((n) => n.slug));
    expect(problems((r) => (known.has(r.folder) ? null : "bilinmeyen mahalle klasörü"))).toEqual([]);
    expect(problems((r) => (r.json.slug === r.name.replace(/\.json$/, "") ? null : "adres dosya adıyla aynı değil"))).toEqual([]);
    expect(problems((r) => (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.json.slug) ? null : "adres küçük harf, rakam ve tire olmalı"))).toEqual([]);
    expect(problems((r) => (r.json.neighborhood === r.folder ? null : "mahalle klasörle aynı değil"))).toEqual([]);
  });

  it("adresler tekrarsız; örnek lablarla da çakışmaz", () => {
    const examples = readdirSync("labs/examples").map((f) => f.replace(/\.json$/, ""));
    const slugs = rooms.map((r) => r.json.slug);
    expect(slugs.filter((s, i) => slugs.indexOf(s) !== i)).toEqual([]);
    expect(slugs.filter((s) => examples.includes(s))).toEqual([]);
  });

  it("tür, şablon, sıra ve durum geçerli", () => {
    expect(
      problems((r) =>
        (r.json.type === "TRAINING") === (r.json.template === "TRAINING") && ["TRAINING", "SCENARIO"].includes(r.json.type)
          ? null
          : "tür ve şablon uyuşmuyor",
      ),
    ).toEqual([]);
    expect(problems((r) => (["TRAINING", "INBOX", "MESSAGING"].includes(r.json.template) ? null : "bilinmeyen şablon"))).toEqual([]);
    expect(problems((r) => (Number.isInteger(r.json.sortOrder) && r.json.sortOrder >= 0 ? null : "sıra sıfır ya da pozitif tam sayı olmalı"))).toEqual([]);
    expect(problems((r) => (["DRAFT", "PUBLISHED"].includes(r.json.status) ? null : 'durum "DRAFT" ya da "PUBLISHED" olmalı'))).toEqual([]);
  });

  it("içerik şemaya ve formun kurallarına uyar; yayındaki oda yayına hazır, senaryo puanı 10", () => {
    expect(
      problems((r) => {
        const template = r.json.template as "TRAINING" | "INBOX" | "MESSAGING";
        const check = validateContent(template, r.json.content);
        if (!check.ok) return `uymayan alanlar: ${check.issues.join(", ")}`;
        if (r.json.status !== "PUBLISHED") return null;
        if (!isPublishable(template, check.content)) return "yayına hazır değil (formdaki kontrol listesi)";
        if (template !== "TRAINING" && maxScore(check.content as ScenarioContent) !== 10) return "puan toplamı 10 değil";
        return null;
      }),
    ).toEqual([]);
  });

  it("video kartının dosyası depoda var (public/videolar)", () => {
    expect(
      problems((r) => {
        const cards = (r.json.content as { cards?: { type: string; src?: string }[] }).cards ?? [];
        const missing = cards.filter((c) => c.type === "video" && c.src && !existsSync(join("public", c.src))).map((c) => c.src);
        return missing.length ? `video dosyası yok: ${missing.join(", ")}` : null;
      }),
    ).toEqual([]);
  });

  it("açan eğitim aynı mahallenin ileri eğitim dosyası; temel eğitim yazılmaz", () => {
    expect(
      problems((r) => {
        if (r.json.unlockedBy === undefined) return null;
        if (r.json.type !== "SCENARIO") return "eğitim odasında unlockedBy olmaz";
        const trainings = rooms.filter((t) => t.folder === r.folder && t.json.type === "TRAINING").sort((a, b) => a.json.sortOrder - b.json.sortOrder);
        const target = trainings.find((t) => t.json.slug === r.json.unlockedBy);
        if (!target) return `açan eğitim (${r.json.unlockedBy}) bu mahallenin eğitim dosyası değil`;
        if (target === trainings[0]) return "temel eğitim açıyorsa unlockedBy yazılmaz";
        return null;
      }),
    ).toEqual([]);
  });
});

describe("oda dosyasının veritabanına yansıması (prisma/rooms.ts)", () => {
  const content = { meta: { difficulty: "EASY", durationMin: 5, name: "Yeni" } };
  const room: Room = {
    slug: "yeni-oda",
    neighborhood: "hesap-kalesi",
    type: "SCENARIO",
    template: "INBOX",
    sortOrder: 2,
    status: "PUBLISHED",
    content: content as Room["content"],
    file: "labs/rooms/hesap-kalesi/yeni-oda.json",
    hash: "yeni",
  };
  const lab = (over: Partial<ExistingLab> = {}): ExistingLab => ({
    type: "SCENARIO",
    template: "INBOX",
    neighborhoodId: "hesap",
    status: "PUBLISHED",
    sourceHash: "eski",
    published: { meta: { ...content.meta, name: "Eski" } },
    ...over,
  });

  it("oda yoksa eklenir, dosya değişmediyse dokunulmaz", () => {
    expect(planRoom(room, "hesap", null)).toEqual({ action: "create" });
    expect(planRoom(room, "hesap", lab({ sourceHash: "yeni" }))).toEqual({ action: "unchanged" });
  });

  it("değişen içerik yeni sürüm olur; yayındakiyle aynıysa yalnızca taslak ve parmak izi yazılır", () => {
    expect(planRoom(room, "hesap", lab())).toEqual({ action: "update", publish: true, status: "PUBLISHED" });
    // Alan sırası önemsiz (veritabanındaki JSON sırasını korumaz).
    const same = { meta: { name: "Yeni", durationMin: 5, difficulty: "EASY" } };
    expect(planRoom(room, "hesap", lab({ published: same }))).toEqual({ action: "update", publish: false, status: "PUBLISHED" });
  });

  it("gizlenmiş oda gizli kalır; taslak dosya yayındaki odayı yayından kaldırmaz", () => {
    expect(planRoom(room, "hesap", lab({ status: "HIDDEN" }))).toEqual({ action: "update", publish: true, status: "HIDDEN" });
    expect(planRoom({ ...room, status: "DRAFT" }, "hesap", lab())).toEqual({ action: "update", publish: false, status: "PUBLISHED" });
    expect(planRoom({ ...room, status: "DRAFT" }, "hesap", lab({ status: "DRAFT", published: null }))).toEqual({
      action: "update",
      publish: false,
      status: "DRAFT",
    });
  });

  it("formla açılmış aynı adresli odayı devralır; türü, şablonu ya da mahallesi farklıysa atlar", () => {
    expect(planRoom(room, "hesap", lab({ sourceHash: null }))).toEqual({ action: "update", publish: true, status: "PUBLISHED" });
    expect(planRoom(room, "hesap", lab({ template: "MESSAGING" })).action).toBe("skip");
    expect(planRoom(room, "hesap", lab({ type: "TRAINING", template: "TRAINING" })).action).toBe("skip");
    expect(planRoom(room, "olta", lab()).action).toBe("skip");
  });
});
