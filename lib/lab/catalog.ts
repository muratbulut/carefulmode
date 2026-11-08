// Lablar kataloğunun arama, süzgeç ve sıralaması (Lablar-F1-Dugme). Saf fonksiyonlar: sayfa
// sunucuda ilk hali, tarayıcı da kullanıcı seçtikçe aynı hesabı yapar. Seçimler adreste durur,
// böylece bağlantı paylaşılınca aynı liste açılır. Adresteki değerler Türkçedir (ASCII).

import type { LabDifficulty, LabKind, LabView } from "./route";

export const catalogSorts = ["recommended", "newest", "popular", "shortest"] as const;
export type CatalogSort = (typeof catalogSorts)[number];

export const statusFilters = ["todo", "done", "locked"] as const;
export type StatusFilter = (typeof statusFilters)[number];

export const kindFilters = ["TRAINING", "SCENARIO"] as const satisfies readonly LabKind[];
export const difficultyFilters = ["EASY", "MEDIUM", "HARD"] as const satisfies readonly LabDifficulty[];

export type CatalogFilters = {
  q: string;
  /** Mahalle adresleri. */
  categories: string[];
  kinds: LabKind[];
  difficulties: LabDifficulty[];
  statuses: StatusFilter[];
  sort: CatalogSort;
};

export type FilterGroup = "categories" | "kinds" | "difficulties" | "statuses";

/** Adresteki adlar: ?ara=kargo&kategori=oltalama-limani&tur=senaryo&zorluk=kolay&durum=bitenler&sirala=en-yeni */
export const catalogParams = { q: "ara", categories: "kategori", kinds: "tur", difficulties: "zorluk", statuses: "durum", sort: "sirala" } as const;

const kindSlugs: Record<LabKind, string> = { TRAINING: "egitim", SCENARIO: "senaryo" };
const difficultySlugs: Record<LabDifficulty, string> = { EASY: "kolay", MEDIUM: "orta", HARD: "zor" };
const statusSlugs: Record<StatusFilter, string> = { todo: "yapmadiklarim", done: "bitenler", locked: "kilitli" };
const sortSlugs: Record<CatalogSort, string> = { recommended: "onerilen", newest: "en-yeni", popular: "en-cok-cozulen", shortest: "en-kisa" };

export const emptyFilters = (): CatalogFilters => ({ q: "", categories: [], kinds: [], difficulties: [], statuses: [], sort: "recommended" });

type Params = Record<string, string | string[] | undefined>;

function list(params: Params, name: string) {
  const value = params[name];
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  return raw.split(",").map((v) => v.trim()).filter(Boolean);
}

function fromSlugs<K extends string>(values: string[], slugs: Record<K, string>): K[] {
  const keys = Object.keys(slugs) as K[];
  return keys.filter((key) => values.includes(slugs[key]));
}

/**
 * Adresi süzgeçlere çevirir. Bilinmeyen değerler atlanır. Ziyaretçide durum süzgeci yoktur
 * (her şey "kayıtla açılır").
 */
export function parseCatalogParams(params: Params, { member, categories }: { member: boolean; categories: string[] }): CatalogFilters {
  const q = list(params, catalogParams.q).join(" ").slice(0, 60);
  const sort = fromSlugs(list(params, catalogParams.sort), sortSlugs)[0] ?? "recommended";
  return {
    q,
    categories: categories.filter((slug) => list(params, catalogParams.categories).includes(slug)),
    kinds: fromSlugs(list(params, catalogParams.kinds), kindSlugs),
    difficulties: fromSlugs(list(params, catalogParams.difficulties), difficultySlugs),
    statuses: member ? fromSlugs(list(params, catalogParams.statuses), statusSlugs) : [],
    sort,
  };
}

/** Süzgeçlerin adresteki hali ("?..." ya da boş). Varsayılanlar yazılmaz. */
export function catalogQuery(filters: CatalogFilters): string {
  const search = new URLSearchParams();
  if (filters.q.trim()) search.set(catalogParams.q, filters.q.trim());
  if (filters.categories.length) search.set(catalogParams.categories, filters.categories.join(","));
  if (filters.kinds.length) search.set(catalogParams.kinds, filters.kinds.map((k) => kindSlugs[k]).join(","));
  if (filters.difficulties.length) search.set(catalogParams.difficulties, filters.difficulties.map((d) => difficultySlugs[d]).join(","));
  if (filters.statuses.length) search.set(catalogParams.statuses, filters.statuses.map((s) => statusSlugs[s]).join(","));
  if (filters.sort !== "recommended") search.set(catalogParams.sort, sortSlugs[filters.sort]);
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** Aramada büyük-küçük harf ve Türkçe harf farkı gözetilmez ("sifre" "Şifre"yi bulur). */
export function normalize(text: string) {
  return text
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesSearch(lab: LabView, q: string) {
  const words = normalize(q).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalize([lab.name, lab.title, lab.summary, lab.district.name, lab.district.topic].join(" "));
  return words.every((word) => haystack.includes(word));
}

export function statusOf(lab: Pick<LabView, "state">): StatusFilter {
  if (lab.state === "done") return "done";
  if (lab.state === "locked") return "locked";
  return "todo";
}

function matchesGroup(lab: LabView, filters: CatalogFilters, group: FilterGroup) {
  switch (group) {
    case "categories":
      return filters.categories.length === 0 || filters.categories.includes(lab.district.slug);
    case "kinds":
      return filters.kinds.length === 0 || filters.kinds.includes(lab.type);
    case "difficulties":
      return filters.difficulties.length === 0 || filters.difficulties.includes(lab.difficulty);
    case "statuses":
      return filters.statuses.length === 0 || filters.statuses.includes(statusOf(lab));
  }
}

const groups: FilterGroup[] = ["categories", "kinds", "difficulties", "statuses"];

/** Arama ve süzgeçler; bir grupta birden çok seçim "ya da", gruplar arası "ve" demektir. */
export function filterLabs(labs: LabView[], filters: CatalogFilters, except?: FilterGroup) {
  return labs.filter((lab) => matchesSearch(lab, filters.q) && groups.every((g) => g === except || matchesGroup(lab, filters, g)));
}

/** Süzgeç penceresindeki sayı: diğer seçimler aynı kalırken bu seçenek kaç lab getirir. */
export function facetCount(labs: LabView[], filters: CatalogFilters, group: FilterGroup, value: string) {
  return filterLabs(labs, filters, group).filter((lab) => {
    switch (group) {
      case "categories":
        return lab.district.slug === value;
      case "kinds":
        return lab.type === value;
      case "difficulties":
        return lab.difficulty === value;
      case "statuses":
        return statusOf(lab) === value;
    }
  }).length;
}

/**
 * "Önerilen" sıra: önce kaldığın lab ve sıradakiler, sonra açık eğitim ve senaryolar, sonra
 * bitenler, en son kilitliler; eşitlikte şehir sırası.
 */
export function recommendedRank(lab: LabView, continueSlug: string | null) {
  if (lab.slug === continueSlug) return -1;
  if (lab.state === "next") return 0;
  if (lab.state === "open") return lab.type === "TRAINING" ? 1 : 2;
  if (lab.state === "done") return 3;
  return 4;
}

const cityOrder = (a: LabView, b: LabView) => a.district.sortOrder - b.district.sortOrder || a.order - b.order;

export function sortLabs(labs: LabView[], sort: CatalogSort, continueSlug: string | null = null) {
  const byRank = (a: LabView, b: LabView) => recommendedRank(a, continueSlug) - recommendedRank(b, continueSlug) || cityOrder(a, b);
  const sorted = [...labs];
  switch (sort) {
    case "recommended":
      return sorted.sort(byRank);
    case "newest":
      return sorted.sort((a, b) => b.publishedAt - a.publishedAt || cityOrder(a, b));
    case "popular":
      return sorted.sort((a, b) => b.completions - a.completions || byRank(a, b));
    case "shortest":
      return sorted.sort((a, b) => a.durationMin - b.durationMin || byRank(a, b));
  }
}

export const activeCount = (filters: CatalogFilters) =>
  filters.categories.length + filters.kinds.length + filters.difficulties.length + filters.statuses.length;
