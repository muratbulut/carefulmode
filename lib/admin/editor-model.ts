// Lab düzenleme formunun saf yardımcıları: yeni öğe, görev ve kart kalıpları, tekil kimlik,
// sıra değiştirme. Yeni parçaların metni boş başlar; form alanlarındaki örnek yazılar sözlükte.

import { missionPoints, type Card, type CardType, type Item, type ScenarioTemplate, type SignPlace, type Task, type TaskType } from "@/lib/lab/content";
import { signPlacesFor } from "./validate";

/** "item-1", "item-2"... içinde henüz kullanılmayan ilk kimlik (şemadaki kimlik kuralına uyar). */
export function nextId(prefix: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  for (let n = 1; ; n++) {
    const id = `${prefix}-${n}`;
    if (!used.has(id)) return id;
  }
}

/** Dizide bir öğeyi bir yukarı (-1) ya da aşağı (1) taşır; sınırdaysa olduğu gibi döner. */
export function moveItem<T>(list: readonly T[], index: number, direction: -1 | 1): T[] {
  const to = index + direction;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [...list];
  const copy = [...list];
  [copy[index], copy[to]] = [copy[to], copy[index]];
  return copy;
}

export function blankItem(id: string): Item {
  return {
    id,
    kind: "real",
    sender: "",
    address: "",
    subject: "",
    time: "",
    body: "",
    footer: "",
    link: null,
    attachment: null,
    signs: [],
    why: "",
  };
}

export function blankTask(id: string, type: TaskType): Task {
  return {
    id,
    type,
    text: "",
    // Soru görevi 3 seçenekle başlar (yayına hazırlık listesi 3 seçenek ister).
    options: type === "question" ? [0, 1, 2].map(() => ({ text: "", points: 0 })) : [],
    right: "",
    why: "",
  };
}

export function blankCard(id: string, type: CardType): Card {
  switch (type) {
    case "info":
      return { id, type, title: "", paragraphs: [""], points: [] };
    case "clickFind":
      return {
        id,
        type,
        title: "",
        hint: "",
        mail: { sender: "", address: "", subject: "", time: "", paragraphs: [""], button: "", footer: "" },
        spots: [],
      };
    case "quiz":
      return { id, type, question: "", options: ["", "", ""], answer: 0, explain: "" };
    case "video":
      return { id, type, title: "", src: "", duration: "", question: null };
    case "match":
      // Yayına hazırlık en az 2 eş ister; 3 boş eşle başlar.
      return { id, type, title: "", hint: "", pairs: [0, 1, 2].map(() => ({ left: "", right: "" })), explain: "" };
    case "fill":
      return { id, type, title: "", hint: "", sentences: [""], extra: [], explain: "" };
    case "sort":
      // Üç kutuyla (yeşil, sarı, kırmızı) ve iki boş bilgiyle başlar.
      return {
        id,
        type,
        title: "",
        hint: "",
        bins: [
          { label: "", note: "", color: "green", icon: "globe" },
          { label: "", note: "", color: "yellow", icon: "users" },
          { label: "", note: "", color: "red", icon: "lock" },
        ],
        items: [0, 1].map(() => ({ text: "", icon: "tag" as const, bin: 0 })),
        explain: "",
      };
  }
}

/** Öğede henüz işaret konmamış yerler (her yere bir işaret; sıra şablonun sırası). */
export function freeSignPlaces(template: ScenarioTemplate, item: Pick<Item, "signs">): SignPlace[] {
  return signPlacesFor[template].filter((place) => !item.signs.some((s) => s.at === place));
}

/** İşaretleri şablonun yer sırasına dizer (önizlemedeki numaralar raporla aynı olsun). */
export function signNumber(item: Pick<Item, "signs">, place: SignPlace): number | null {
  const index = item.signs.findIndex((s) => s.at === place);
  return index < 0 ? null : index + 1;
}

/** Soru görevinin en yüksek puanı; eylem 0, bildir sahte başına 4 + gerçek başına 1. */
export function taskMax(task: Pick<Task, "type" | "options">, items: readonly Pick<Item, "kind">[]): number {
  if (task.type === "question") return Math.max(0, ...task.options.map((o) => o.points));
  if (task.type === "review") return items.reduce((sum, i) => sum + (i.kind === "fake" ? 4 : 1), 0);
  if (task.type === "mission") return missionPoints;
  return 0;
}

/** Avatar rengi için kararlı sıra numarası (aynı ad hep aynı renk). */
export function colorIndex(text: string, count: number): number {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return count > 0 ? hash % count : 0;
}
