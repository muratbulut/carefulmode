// Lab düzenlemedeki "Öğrenci gibi dene" sekmesi: yönetici her öğe ve her soru için öğrencinin
// ne yaptığını seçer; seçimler gerçek lab olaylarına çevrilir (lib/lab/events.ts) ve öğrencinin
// raporunu hesaplayan aynı fonksiyonla puanlanır (lib/lab/scoring.ts). Hepsi tarayıcıda çalışır;
// yönetici cevapları zaten görür, sunucuya bir şey gitmez.

import type { ScenarioContent, ScenarioTemplate } from "@/lib/lab/content";
import { reduceEvents, type LabEventData, type SceneState } from "@/lib/lab/events";
import { scoreScenario, type FakeOutcome, type RealOutcome } from "@/lib/lab/scoring";

/** Seçim listesindeki sıra (en iyiden en kötüye). */
export const fakeChoices = ["reported", "deleted", "ignored", "reportedAfterEngaging", "engagedLeft", "hacked"] as const satisfies readonly FakeOutcome[];
/** Görevli odada bir seçenek daha: sahte mağazaya ödedi ama onay kodunu yazmadı. */
export const missionFakeChoices = ["reported", "deleted", "ignored", "reportedAfterEngaging", "engagedLeft", "stopped", "hacked"] as const satisfies readonly FakeOutcome[];

export function fakeChoicesFor(content: Pick<ScenarioContent, "mission">): readonly FakeOutcome[] {
  // Satış görevinde "son anda durma" yok: ödeme isteği ya onaylanır ya reddedilir.
  return content.mission && !content.mission.sale ? missionFakeChoices : fakeChoices;
}
export const realChoices = ["kept", "deleted", "reported"] as const satisfies readonly RealOutcome[];

export type TryPath = {
  /** Öğe kimliği -> öğrencinin yaptığı (sahte öğede FakeOutcome, gerçekte RealOutcome). */
  items: Record<string, FakeOutcome | RealOutcome>;
  /** Soru görevi kimliği -> seçilen seçenek; null: cevaplamadı. */
  answers: Record<string, number | null>;
  /** Görevli oda: gerçek mağazadan aldı mı (yazılmazsa aldı). */
  missionDone?: boolean;
};

/** Varsayılan yol: her şeyi doğru yapan öğrenci (sahteleri bildirir, en yüksek puanlı seçenek). */
export function defaultTryPath(content: ScenarioContent): TryPath {
  const items: TryPath["items"] = {};
  for (const item of content.items) items[item.id] = item.kind === "fake" ? "reported" : "kept";
  const answers: TryPath["answers"] = {};
  for (const task of content.tasks) {
    if (task.type !== "question") continue;
    if (task.options.length === 0) {
      answers[task.id] = null;
      continue;
    }
    const best = Math.max(...task.options.map((o) => o.points));
    answers[task.id] = task.options.findIndex((o) => o.points === best);
  }
  return { items, answers };
}

/** İçerik değişince (öğe silindi, türü değişti) eski seçimleri geçerli olanlarla birleştirir. */
export function mergeTryPath(content: ScenarioContent, previous: TryPath): TryPath {
  const base = defaultTryPath(content);
  for (const item of content.items) {
    const chosen = previous.items[item.id];
    const valid = item.kind === "fake" ? (fakeChoicesFor(content) as readonly string[]) : (realChoices as readonly string[]);
    if (chosen && valid.includes(chosen)) base.items[item.id] = chosen;
  }
  for (const task of content.tasks) {
    if (task.type !== "question" || !(task.id in previous.answers)) continue;
    const option = previous.answers[task.id];
    base.answers[task.id] = option === null || (option !== undefined && option < task.options.length) ? option : base.answers[task.id];
  }
  if (previous.missionDone !== undefined) base.missionDone = previous.missionDone;
  return base;
}

function itemEvents(item: string, outcome: FakeOutcome | RealOutcome, template: ScenarioTemplate, mission: "buy" | "sale" | null): LabEventData[] {
  const opened: LabEventData = { type: "item_opened", item };
  // Satış görevinde sahte mesaja kanmak bağlantıdaki ödeme isteğini açmaktır.
  const engage: LabEventData = template === "INBOX" || mission === "sale" ? { type: "link_clicked", item } : { type: "reply_sent", item, secret: false };
  switch (outcome) {
    case "reported":
      return [opened, { type: "item_moved", item, to: "spam" }];
    case "reportedAfterEngaging":
      return [opened, engage, { type: "item_moved", item, to: "spam" }];
    case "deleted":
      return [opened, { type: "item_moved", item, to: "trash" }];
    case "engagedLeft":
      return [opened, engage];
    case "hacked":
      if (mission === "sale") return [opened, engage, { type: "code_entered", item }];
      if (mission) return [opened, engage, { type: "info_entered", item }, { type: "code_entered", item }];
      return template === "INBOX"
        ? [opened, engage, { type: "info_entered", item }]
        : [opened, { type: "reply_sent", item, secret: true }];
    case "stopped":
      return [opened, engage, { type: "info_entered", item }, { type: "code_refused", item }];
    case "ignored":
    case "kept":
      return [opened];
  }
}

/** Seçilen yolu öğrencinin olaylarına, olayları sahne durumuna çevirir. */
export function stateFromPath(content: ScenarioContent, template: ScenarioTemplate, path: TryPath): SceneState {
  const events: LabEventData[] = [];
  const mission = content.mission ? (content.mission.sale ? "sale" : "buy") : null;
  for (const item of content.items) {
    const fallback = item.kind === "fake" ? "reported" : "kept";
    events.push(...itemEvents(item.id, path.items[item.id] ?? fallback, template, mission));
  }
  // Görev: gerçek mağazadan aldıysa ilk ödemeli gerçek öğede ödeme ve onay kodu; satışta ilk
  // gerçek siparişi hazırlayarak kargoya verme.
  const shop = content.items.find((i) => i.kind === "real" && i.payment);
  const order = content.items.find((i) => i.kind === "real" && i.order);
  if (mission === "sale" && order && path.missionDone !== false) {
    events.push({ type: "link_clicked", item: order.id }, { type: "item_shipped", item: order.id, prepared: true });
  }
  if (mission === "buy" && shop && path.missionDone !== false) {
    events.push({ type: "link_clicked", item: shop.id }, { type: "info_entered", item: shop.id }, { type: "code_entered", item: shop.id });
  }
  events.push({ type: "review_done" });
  for (const task of content.tasks) {
    if (task.type !== "question") continue;
    const option = path.answers[task.id];
    if (option !== null && option !== undefined && option >= 0 && option < task.options.length) {
      events.push({ type: "answer", task: task.id, option });
    }
  }
  return reduceEvents(events);
}

/** Bu yolla çıkacak rapor (öğrencinin gerçek raporuyla aynı hesap). */
export function reportForPath(content: ScenarioContent, template: ScenarioTemplate, path: TryPath) {
  return scoreScenario(content, stateFromPath(content, template, path));
}

/** Seçimin puanı (düğmelerdeki "+4"); puan tablosu lib/lab/scoring.ts'ten okunur. */
export function outcomePoints(kind: "fake" | "real", outcome: FakeOutcome | RealOutcome, template: ScenarioTemplate): number {
  const item = { id: "x", kind, sender: "", address: "", subject: "", time: "", body: "", footer: "", link: null, attachment: null, signs: [], why: "" };
  const content = {
    meta: { name: "", title: "", summary: "", story: "", learn: [], difficulty: "EASY", durationMin: 5 },
    reminders: [],
    items: [item],
    trap: { url: "", title: "", text: "", ask: "", secret: "", kind: "account", account: "", scene: "", realLife: "", actions: [] },
    tasks: [],
    tips: [],
  } satisfies ScenarioContent;
  const report = scoreScenario(content, stateFromPath(content, template, { items: { x: outcome }, answers: {} }));
  return report.rows[0]?.points ?? 0;
}
