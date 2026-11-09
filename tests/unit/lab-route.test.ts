import { describe, expect, it } from "vitest";
import {
  activeCount,
  catalogQuery,
  emptyFilters,
  facetCount,
  filterLabs,
  matchesSearch,
  normalize,
  parseCatalogParams,
  recommendedRank,
  sortLabs,
} from "@/lib/lab/catalog";
import {
  cityProgress,
  continueHref,
  defaultSelection,
  detailAction,
  districtRing,
  goHref,
  goKind,
  labHref,
  railParts,
  routeOf,
  type DistrictView,
  type LabView,
} from "@/lib/lab/route";
import { nextBadge } from "@/lib/progress/next-badge";
import type { BadgeState } from "@/lib/progress/badges";

const district = { slug: "oltalama-limani", name: "Oltalama Limanı", topic: "Oltalama", color: "accent", icon: "mail", sortOrder: 2 };
const other = { slug: "hesap-kalesi", name: "Hesap Kalesi", topic: "Hesap güvenliği", color: "success", icon: "lock", sortOrder: 1 };

function lab(over: Partial<LabView> & Pick<LabView, "slug">): LabView {
  return {
    type: "SCENARIO",
    template: "INBOX",
    name: over.slug,
    title: "",
    summary: "",
    difficulty: "EASY",
    durationMin: 5,
    cards: null,
    order: 1,
    state: "open",
    best: null,
    inProgress: false,
    isNew: false,
    completions: 0,
    publishedAt: 0,
    lockedBy: null,
    gateSlug: null,
    reportHref: null,
    district,
    ...over,
  };
}

/** Eğitimler (ilki temel) ve senaryolar; açan eğitimi yazılmamış senaryoyu temel eğitim açar. */
function districtView(trainings: LabView | LabView[] | null, scenarios: LabView[]): DistrictView {
  const list = trainings === null ? [] : Array.isArray(trainings) ? trainings : [trainings];
  const gated = scenarios.map((s) => (s.gateSlug || !list[0] ? s : { ...s, gateSlug: list[0].slug }));
  return { ...district, trainings: list, scenarios: gated, doneCount: 0, total: 0, trainingDone: false, nextSlug: null };
}

describe("lab adresleri", () => {
  it("eğitim labı doğrudan oynatıcıda, senaryo önce kapakta açılır", () => {
    expect(labHref({ slug: "oltalama-egitimi", type: "TRAINING" })).toBe("/oda/oltalama-egitimi/oyna");
    expect(labHref({ slug: "sahte-kargo-maili", type: "SCENARIO" })).toBe("/oda/sahte-kargo-maili");
  });

  it("alt menünün ortası: kaldığın lab, yoksa yol haritası", () => {
    expect(continueHref(null)).toBe("/yol-haritasi");
    expect(continueHref({ slug: "a", type: "TRAINING" })).toBe("/oda/a/oyna");
    expect(continueHref({ slug: "b", type: "SCENARIO" })).toBe("/oda/b");
  });
});

describe("mahalle rotası", () => {
  it("eğitim önce, senaryolar sonra", () => {
    const t = lab({ slug: "t", type: "TRAINING", order: 0 });
    const s = lab({ slug: "s" });
    expect(routeOf(districtView(t, [s])).map((l) => l.slug)).toEqual(["t", "s"]);
    expect(routeOf(districtView(null, [s])).map((l) => l.slug)).toEqual(["s"]);
  });

  it("her eğitimin ardından kendi açtığı senaryolar gelir", () => {
    const basic = lab({ slug: "temel", type: "TRAINING", order: 0 });
    const advanced = lab({ slug: "ileri", type: "TRAINING", order: 0 });
    const d = districtView(
      [basic, advanced],
      [lab({ slug: "a", gateSlug: "ileri" }), lab({ slug: "b" }), lab({ slug: "c", gateSlug: "ileri" })],
    );
    expect(routeOf(d).map((l) => l.slug)).toEqual(["temel", "b", "ileri", "a", "c"]);
    expect(districtRing(d)).toEqual({ done: 0, total: 5 });
    expect(cityProgress([d])).toMatchObject({ trainingTotal: 2, scenarioTotal: 3 });
  });

  it("rota çizgisi bitmiş labın altında mahallenin rengini alır", () => {
    expect(railParts(["done", "next", "locked"])).toEqual([
      { top: "none", bottom: "done" },
      { top: "done", bottom: "todo" },
      { top: "todo", bottom: "none" },
    ]);
    expect(railParts(["open"])).toEqual([{ top: "none", bottom: "none" }]);
  });

  it("mahalle halkası eğitim ve senaryo odalarını birlikte sayar", () => {
    const t = lab({ slug: "t", type: "TRAINING", state: "done" });
    expect(districtRing(districtView(t, [lab({ slug: "a", state: "done" }), lab({ slug: "b" })]))).toEqual({ done: 2, total: 3 });
    expect(districtRing(districtView(lab({ slug: "t", type: "TRAINING" }), [lab({ slug: "a" })]))).toEqual({ done: 0, total: 2 });
    expect(districtRing(districtView(t, []))).toEqual({ done: 1, total: 1 });
    expect(districtRing(districtView(null, []))).toEqual({ done: 0, total: 0 });
  });

  it("genel ilerleme eğitim ve senaryoyu ayrı sayar", () => {
    const d = districtView(lab({ slug: "t", type: "TRAINING", state: "done" }), [lab({ slug: "a", state: "done" }), lab({ slug: "b" }), lab({ slug: "c" })]);
    expect(cityProgress([d])).toEqual({ trainingDone: 1, trainingTotal: 1, scenarioDone: 1, scenarioTotal: 3, percent: 50 });
    expect(cityProgress([]).percent).toBe(0);
  });

  it("ilk seçili lab: sıradaki, yoksa ilk açık senaryo, yoksa rotanın başı", () => {
    const t = lab({ slug: "t", type: "TRAINING", state: "done" });
    expect(defaultSelection([t, lab({ slug: "a", state: "done" }), lab({ slug: "b", state: "next" })])).toBe("b");
    expect(defaultSelection([lab({ slug: "t", type: "TRAINING", state: "open" }), lab({ slug: "a", state: "open" })])).toBe("a");
    expect(defaultSelection([lab({ slug: "x", state: "locked" })])).toBe("x");
    expect(defaultSelection([])).toBeNull();
  });

  it("önizleme düğmesi: kilitliye yok, bitmiş senaryoda rapor", () => {
    expect(goKind({ state: "locked", type: "SCENARIO" })).toBeNull();
    expect(goKind({ state: "done", type: "TRAINING" })).toBe("review");
    expect(goKind({ state: "done", type: "SCENARIO" })).toBe("report");
    expect(goKind({ state: "next", type: "SCENARIO" })).toBe("next");
    expect(goKind({ state: "open", type: "TRAINING" })).toBe("training");
    expect(goHref({ slug: "s", type: "SCENARIO", state: "done", reportHref: "/oda/s/sonuc/1" })).toBe("/oda/s/sonuc/1");
    expect(goHref({ slug: "s", type: "SCENARIO", state: "open", reportHref: null })).toBe("/oda/s");
  });
});

describe("lab detayındaki ana düğme", () => {
  const base = { slug: "sahte-kargo-maili", state: "open" as const, inProgress: false, done: false, verified: true, trainingHref: "/oda/oltalama-egitimi/oyna" };

  it("doğrulanmamış e-posta önce doğrulamaya, sonra bu laba", () => {
    expect(detailAction({ ...base, verified: false })).toEqual({ kind: "verify", href: "/dogrula?sonra=%2Foda%2Fsahte-kargo-maili" });
    expect(detailAction({ ...base, verified: false, state: "locked" }).kind).toBe("verify");
  });

  it("kilitliyse eğitim labına", () => {
    expect(detailAction({ ...base, state: "locked" })).toEqual({ kind: "locked", href: "/oda/oltalama-egitimi/oyna" });
    expect(detailAction({ ...base, state: "locked", trainingHref: null }).href).toBe("/yol-haritasi");
  });

  it("yarım deneme devam eder, biten tekrar denenir, yoksa başlar", () => {
    expect(detailAction({ ...base, inProgress: true, done: true })).toEqual({ kind: "continue", href: "/oda/sahte-kargo-maili/oyna" });
    expect(detailAction({ ...base, done: true, state: "done" }).kind).toBe("again");
    expect(detailAction({ ...base, state: "next" })).toEqual({ kind: "start", href: "/oda/sahte-kargo-maili/oyna" });
  });
});

describe("lablar kataloğu", () => {
  const training = lab({ slug: "oltalama-egitimi", type: "TRAINING", name: "Oltalama eğitim labı", state: "done", order: 0, durationMin: 4, publishedAt: 1 });
  const kargo = lab({ slug: "sahte-kargo-maili", name: "Sahte kargo maili", summary: "Paketin yolda", state: "next", difficulty: "EASY", durationMin: 8, completions: 5, publishedAt: 3 });
  const sifre = lab({ slug: "sifre", name: "Şifre tuzağı", district: other, state: "locked", difficulty: "HARD", durationMin: 6, completions: 9, publishedAt: 2 });
  const labs = [training, kargo, sifre];
  const categories = [district.slug, other.slug];

  it("Türkçe harf ve büyük-küçük harf farkı gözetilmez", () => {
    expect(normalize("ŞİFRE Işık")).toBe("sifre isik");
    expect(matchesSearch(sifre, "sifre")).toBe(true);
    expect(matchesSearch(kargo, "PAKET")).toBe(true);
    expect(matchesSearch(kargo, "oltalama")).toBe(true);
    expect(matchesSearch(kargo, "qr")).toBe(false);
  });

  it("adres süzgeçleri okunur; bilinmeyen değer ve ziyaretçinin durum süzgeci atlanır", () => {
    const params = { ara: "kargo", kategori: "oltalama-limani,yok", tur: "senaryo", zorluk: "kolay,zor", durum: "kilitli", sirala: "en-kisa" };
    expect(parseCatalogParams(params, { member: true, categories })).toEqual({
      q: "kargo",
      categories: ["oltalama-limani"],
      kinds: ["SCENARIO"],
      difficulties: ["EASY", "HARD"],
      statuses: ["locked"],
      sort: "shortest",
    });
    expect(parseCatalogParams(params, { member: false, categories }).statuses).toEqual([]);
    expect(parseCatalogParams({ sirala: "rastgele" }, { member: true, categories }).sort).toBe("recommended");
    expect(parseCatalogParams({ ara: "x".repeat(200) }, { member: true, categories }).q).toHaveLength(60);
  });

  it("süzgeçler adrese geri yazılır (önerilen sıralama yazılmaz)", () => {
    expect(catalogQuery(emptyFilters())).toBe("");
    const filters = { ...emptyFilters(), q: " kargo ", kinds: ["TRAINING" as const], statuses: ["done" as const], sort: "popular" as const };
    expect(catalogQuery(filters)).toBe("?ara=kargo&tur=egitim&durum=bitenler&sirala=en-cok-cozulen");
    expect(parseCatalogParams(Object.fromEntries(new URLSearchParams(catalogQuery(filters))), { member: true, categories })).toEqual({ ...filters, q: "kargo" });
    expect(activeCount(filters)).toBe(2);
  });

  it("süzgeç: grup içinde veya, gruplar arasında ve", () => {
    const filters = { ...emptyFilters(), categories: [district.slug], statuses: ["todo" as const, "locked" as const] };
    expect(filterLabs(labs, filters).map((l) => l.slug)).toEqual(["sahte-kargo-maili"]);
    expect(filterLabs(labs, { ...emptyFilters(), kinds: ["TRAINING"] }).map((l) => l.slug)).toEqual(["oltalama-egitimi"]);
    // Bir grubun sayısı o grubun kendi seçimini saymaz.
    expect(facetCount(labs, filters, "categories", other.slug)).toBe(1);
    expect(facetCount(labs, filters, "statuses", "done")).toBe(1);
  });

  it("sıralama: önerilende kaldığın yer ve sıradaki önce; diğerleri kendi ölçüsüne göre", () => {
    expect(recommendedRank(kargo, "sahte-kargo-maili")).toBeLessThan(recommendedRank(training, null));
    expect(sortLabs(labs, "recommended").map((l) => l.slug)).toEqual(["sahte-kargo-maili", "oltalama-egitimi", "sifre"]);
    expect(sortLabs(labs, "newest").map((l) => l.slug)).toEqual(["sahte-kargo-maili", "sifre", "oltalama-egitimi"]);
    expect(sortLabs(labs, "popular").map((l) => l.slug)).toEqual(["sifre", "sahte-kargo-maili", "oltalama-egitimi"]);
    expect(sortLabs(labs, "shortest").map((l) => l.slug)).toEqual(["oltalama-egitimi", "sifre", "sahte-kargo-maili"]);
  });
});

describe("sıradaki rozet", () => {
  const badge = (code: string, earned: boolean, kind: BadgeState["progress"]["kind"], value: number, total: number) =>
    ({ code, earned, progress: { kind, value, total } }) as BadgeState;

  it("kazanılmamışlardan bitmeye en yakını; lab dışı rozetler ve boş mahalleler önerilmez", () => {
    const badges = [
      badge("sifre-ustasi", false, "labs", 0, 0),
      badge("ilk-rapor", true, "count", 1, 1),
      badge("oltalama-avcisi", false, "labs", 1, 4),
      badge("sinif-arkadasi", false, "classroom", 0, 1),
      badge("merakli", false, "days", 6, 7),
      badge("sehir-turu", false, "districts", 2, 4),
      badge("siber-kahraman", false, "level", 3, 10),
    ];
    expect(nextBadge(badges)?.code).toBe("sehir-turu");
  });

  it("1. seviyedeki öğrenciye seviye rozeti önde çıkmaz; hepsi kazanıldıysa yok", () => {
    expect(nextBadge([badge("kart-kurdu", false, "count", 0, 1), badge("siber-kahraman", false, "level", 1, 10)])?.code).toBe("kart-kurdu");
    expect(nextBadge([badge("kart-kurdu", false, "count", 0, 1), badge("siber-kahraman", false, "level", 2, 10)])?.code).toBe("siber-kahraman");
    expect(nextBadge([badge("ilk-rapor", true, "count", 1, 1)])).toBeNull();
  });
});
