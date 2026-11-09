// Senaryo labındaki öğrenci eylemleri (Lab SDK olayları) ve onlardan çıkan sahne durumu.
// Hem tarayıcı (yarım kalan labı kaldığı yerden açmak) hem sunucu (puanlama) aynı fonksiyonu
// kullanır. Olaylarda doğru/yanlış bilgisi yoktur, yalnızca öğrencinin ne yaptığı vardır.

import * as z from "@/lib/zod";

export const folders = ["inbox", "spam", "trash"] as const;
export type Folder = (typeof folders)[number];

const ref = z.string().regex(/^[a-z0-9-]{1,32}$/);

/** Tarayıcının toplu gönderebildiği olaylar. Bağlantı, sahte form ve cevap ayrı eylemle gelir. */
export const batchEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("item_opened"), item: ref }),
  z.object({ type: z.literal("item_moved"), item: ref, to: z.enum(folders) }),
  z.object({ type: z.literal("attachment_opened"), item: ref }),
  z.object({ type: z.literal("review_done") }),
  z.object({ type: z.literal("answer"), task: ref, option: z.number().int().min(0).max(3) }),
]);
export type BatchEvent = z.infer<typeof batchEventSchema>;

/** Sunucunun kendi yazdığı olaylar (tarayıcı bunları toplu gönderemez). */
export type ServerEvent =
  | { type: "link_clicked"; item: string }
  | { type: "info_entered"; item: string }
  | { type: "reply_sent"; item: string; secret: boolean }
  /**
   * Görevli oda, onay kararı: alış görevinde SMS'teki onay kodunu yazdı ya da yazmadı (veliye
   * anlattı); satış görevinde bankanın ödeme isteğini onayladı ya da reddetti. İkisi de bir
   * ödemeye "evet" ya da "hayır" demektir.
   */
  | { type: "code_entered"; item: string }
  | { type: "code_refused"; item: string }
  /** Satış görevi: siparişi kargoya verdi; prepared: hazırlık maddelerinin hepsini yaptı (telefonu sıfırladı). */
  | { type: "item_shipped"; item: string; prepared: boolean };

export type LabEventData = BatchEvent | ServerEvent;

export type SceneState = {
  opened: string[];
  folders: Record<string, Folder>;
  /** Gelen kutusu: linke tıkladığı mailler. */
  clicked: string[];
  /** Mesajlaşma: cevap yazdığı konuşmalar; secret: kodu da gönderdiği. */
  replied: string[];
  secretSent: string[];
  /** Sahte sayfaya bilgi girdiği mailler (yazdığı metin hiç kaydedilmez). */
  infoEntered: string[];
  /** Görevli oda: mağazada ödeyince gelen onay kodunu yazdığı ve yazmadığı öğeler. */
  codeEntered: string[];
  codeRefused: string[];
  /** Satış görevi: kargoya verdiği siparişler ve bunlardan hazırlayarak (sıfırlayarak) gönderdikleri. */
  shipped: string[];
  prepared: string[];
  answers: Record<string, number>;
  reviewDone: boolean;
  /** Rapora yazılan karar sayısı: taşıma, bildirme, cevap. */
  decisions: number;
};

export const emptyState = (): SceneState => ({
  opened: [],
  folders: {},
  clicked: [],
  replied: [],
  secretSent: [],
  infoEntered: [],
  codeEntered: [],
  codeRefused: [],
  shipped: [],
  prepared: [],
  answers: {},
  reviewDone: false,
  decisions: 0,
});

const add = (list: string[], value: string) => (list.includes(value) ? list : [...list, value]);

export function applyEvent(state: SceneState, event: LabEventData): SceneState {
  switch (event.type) {
    case "item_opened":
      return { ...state, opened: add(state.opened, event.item) };
    case "item_moved":
      return { ...state, folders: { ...state.folders, [event.item]: event.to }, decisions: state.decisions + 1 };
    case "attachment_opened":
      return state;
    case "review_done":
      return state.reviewDone ? state : { ...state, reviewDone: true, decisions: state.decisions + 1 };
    case "answer":
      return { ...state, answers: { ...state.answers, [event.task]: event.option }, decisions: state.decisions + 1 };
    case "link_clicked":
      return { ...state, clicked: add(state.clicked, event.item) };
    case "info_entered":
      return { ...state, infoEntered: add(state.infoEntered, event.item) };
    case "code_entered":
      return { ...state, codeEntered: add(state.codeEntered, event.item), decisions: state.decisions + 1 };
    case "code_refused":
      return { ...state, codeRefused: add(state.codeRefused, event.item), decisions: state.decisions + 1 };
    case "item_shipped":
      return {
        ...state,
        shipped: add(state.shipped ?? [], event.item),
        prepared: event.prepared ? add(state.prepared ?? [], event.item) : (state.prepared ?? []),
        decisions: state.decisions + 1,
      };
    case "reply_sent":
      return {
        ...state,
        replied: add(state.replied, event.item),
        secretSent: event.secret ? add(state.secretSent, event.item) : state.secretSent,
      };
  }
}

/** Veritabanındaki olay satırı (LabEvent: type + data) -> olay. */
export function rowToEvent(row: { type: string; data: unknown }): LabEventData {
  return { type: row.type, ...(row.data as object) } as LabEventData;
}

export function reduceEvents(events: readonly LabEventData[]): SceneState {
  return events.reduce(applyEvent, emptyState());
}

/** Eski kayıtlarda (görevli odadan önce) olmayan alanlar boş liste sayılır. */
export const codeDecided = (state: Pick<SceneState, "codeEntered" | "codeRefused">) => [...(state.codeEntered ?? []), ...(state.codeRefused ?? [])];

export const folderOf = (state: SceneState, item: string): Folder => state.folders[item] ?? "inbox";

/**
 * Görevlerin durumu: sırayla açılır, biri bitmeden sonraki kilitlidir. sale: satış görevli oda
 * (görev, kargoya verince biter).
 */
export function taskProgress(
  tasks: readonly { id: string; type: "action" | "review" | "question" | "mission" }[],
  state: SceneState,
  sale = false,
) {
  const done = tasks.map((task) => {
    if (task.type === "action") return state.opened.length > 0;
    if (task.type === "review") return state.reviewDone;
    // Alış görevi: mağazada ödeyip onay kodu için bir karar verince (yazdı ya da yazmadı) biter.
    // Satış görevi: siparişi kargoya verince biter (ödeme isteğini reddetmek görevi bitirmez).
    if (task.type === "mission") return sale ? (state.shipped ?? []).length > 0 : codeDecided(state).length > 0;
    return task.id in state.answers;
  });
  const current = done.indexOf(false);
  return { done, current: current < 0 ? tasks.length : current, finished: current < 0 };
}

/** Kod gönderildi mi? Rakamlı kodda rakamlar, diğerinde metin aranır (yazılan metin saklanmaz). */
export function containsSecret(text: string, secret: string) {
  const digits = secret.replace(/\D/g, "");
  if (digits.length >= 4) return text.replace(/\D/g, "").includes(digits);
  const needle = secret.trim().toLocaleLowerCase("tr");
  return needle.length > 0 && text.toLocaleLowerCase("tr").includes(needle);
}
