// Senaryo labının puanlaması ve rapor özeti (Rapor-Son ve Lab-Duzenle-Son tahtalarının mantığı).
// Öğrencinin raporunu sunucu hesaplar (lib/lab/actions.ts). Yönetimdeki "Öğrenci gibi dene" de
// aynı fonksiyonu kullanır; içeriği zaten gören yönetici içindir, öğrencinin tarayıcısına girmez.
//
// Puan: sahte her öğe en fazla 4, gerçek her öğe 1, her soru seçtiği seçeneğin puanı. Rapor
// yalnızca kodlar ve sayılar tutar; ekrandaki cümleler sözlükten ve içerikten gelir.

import { maxScore, missionPoints, reportScale, type CompromiseKind, type ScenarioContent } from "./content";
import { codeDecided, folderOf, type SceneState } from "./events";

export type RowState = "ok" | "part" | "bad" | "skip";

/**
 * Sahte öğe: hacklendi, önce tıklayıp sonra bildirdi, bildirdi, sildi, tıklayıp bıraktı, dokunmadı.
 * stopped: görevli odada sahte mağazaya kartla ödedi ama onay kodunu yazmadı (son anda durdu;
 * hacklenmiş sayılmaz ama kart bilgisi gitti, 0 puan).
 */
export type FakeOutcome = "hacked" | "stopped" | "reportedAfterEngaging" | "reported" | "deleted" | "engagedLeft" | "ignored";
export type RealOutcome = "reported" | "deleted" | "kept";

/**
 * Sahte öğeye nasıl kandı: bağlantıyı açarak (ve sahte sayfaya yazarak), cevap yazarak (kodu
 * göndererek) ya da satış görevli odada bağlantıdaki ödeme isteğini açarak (ve onaylayarak).
 * Mesajlaşmada raporun cümlesini seçer; eski raporlarda yoktur.
 */
export type EngagedBy = "link" | "reply" | "request";

export type ReportRow =
  | { type: "fake"; item: string; outcome: FakeOutcome; by?: EngagedBy; state: RowState; points: number; max: number }
  | { type: "real"; item: string; outcome: RealOutcome; state: RowState; points: number; max: number }
  | { type: "question"; task: string; option: number | null; state: RowState; points: number; max: number }
  /** Görevli oda: işi doğru yerden yaptı mı (gerçek mağazadan aldı). */
  | { type: "mission"; task: string; done: boolean; state: RowState; points: number; max: number };

export type ReportStatus = "safe" | "risky" | "hacked";
export type ReportTitle = "hacked" | "missed" | "caught" | "safeButMissed";

export type ScenarioReport = {
  status: ReportStatus;
  title: ReportTitle;
  /** 10 üzerinden. */
  score: number;
  rows: ReportRow[];
  /** İçerikteki ipuçlarından seçilenlerin sırası; 3'e tamamlamak için kaç genel ipucu eklendiği. */
  tips: number[];
  genericTips: number;
  /** Sahte öğe(ler)i doğru yakaladı mı: işaretler "yakaladığın" mı "kaçırdığın" mı başlığıyla. */
  caught: boolean;
  compromise: CompromiseKind | null;
};

const fakeScores: Record<FakeOutcome, [RowState, number]> = {
  hacked: ["bad", 0],
  stopped: ["bad", 0],
  reportedAfterEngaging: ["part", 2],
  reported: ["ok", 4],
  deleted: ["part", 2],
  engagedLeft: ["bad", 0],
  ignored: ["part", 1],
};

const realScores: Record<RealOutcome, [RowState, number]> = {
  reported: ["bad", 0],
  deleted: ["part", 1],
  kept: ["ok", 1],
};

/**
 * Görevli odada (mission) sahte mağazaya kart bilgisi girmek tek başına ele geçirilme değildir;
 * ele geçirilme onay kodunu yazmaktır. Diğer odalarda bilgi girmek ele geçirilmedir.
 */
export function fakeOutcome(state: SceneState, item: string, mission = false): FakeOutcome {
  if (mission) {
    if ((state.codeEntered ?? []).includes(item)) return "hacked";
    if (state.infoEntered.includes(item)) return "stopped";
  } else if (state.infoEntered.includes(item)) return "hacked";
  if (state.secretSent.includes(item)) return "hacked";
  const engaged = state.clicked.includes(item) || state.replied.includes(item);
  const folder = folderOf(state, item);
  if (folder === "spam") return engaged ? "reportedAfterEngaging" : "reported";
  if (folder === "trash") return "deleted";
  return engaged ? "engagedLeft" : "ignored";
}

export function engagedBy(state: SceneState, item: string): EngagedBy | undefined {
  if (state.infoEntered.includes(item)) return "link";
  if (state.secretSent.includes(item)) return "reply";
  if (state.clicked.includes(item)) return "link";
  return state.replied.includes(item) ? "reply" : undefined;
}

export function realOutcome(state: SceneState, item: string): RealOutcome {
  const folder = folderOf(state, item);
  return folder === "spam" ? "reported" : folder === "trash" ? "deleted" : "kept";
}

/**
 * Görevli oda: alışta gerçek bir mağazada onay kodu için karar verdiyse, satışta gerçek siparişi
 * hazırlayarak (telefonu sıfırlayarak) kargoya verdiyse iş doğru yapıldı.
 */
export function missionDone(content: Pick<ScenarioContent, "items" | "mission">, state: SceneState) {
  if (content.mission?.sale) {
    const prepared = state.prepared ?? [];
    return content.items.some((i) => i.kind === "real" && i.order && prepared.includes(i.id));
  }
  const decided = codeDecided(state);
  return content.items.some((i) => i.kind === "real" && decided.includes(i.id));
}

export function scoreScenario(content: ScenarioContent, state: SceneState): ScenarioReport {
  const rows: ReportRow[] = [];
  const mission = !!content.mission;

  for (const item of content.items) {
    if (item.kind === "fake") {
      const outcome = fakeOutcome(state, item.id, mission);
      const [rowState, points] = fakeScores[outcome];
      const by = engagedBy(state, item.id);
      const via = by === "link" && item.request && content.mission?.sale ? "request" : by;
      rows.push({ type: "fake", item: item.id, outcome, ...(via ? { by: via } : {}), state: rowState, points, max: 4 });
    } else {
      const outcome = realOutcome(state, item.id);
      const [rowState, points] = realScores[outcome];
      rows.push({ type: "real", item: item.id, outcome, state: rowState, points, max: 1 });
    }
  }

  for (const task of content.tasks) {
    if (task.type === "mission") {
      const done = missionDone(content, state);
      rows.push({ type: "mission", task: task.id, done, state: done ? "ok" : "bad", points: done ? missionPoints : 0, max: missionPoints });
      continue;
    }
    if (task.type !== "question") continue;
    const max = Math.max(0, ...task.options.map((o) => o.points));
    const option = state.answers[task.id];
    if (option === undefined || !task.options[option]) {
      rows.push({ type: "question", task: task.id, option: null, state: "skip", points: 0, max });
      continue;
    }
    const points = task.options[option].points;
    const rowState: RowState = points >= max ? "ok" : points === 0 ? "bad" : "part";
    rows.push({ type: "question", task: task.id, option, state: rowState, points, max });
  }

  const fakes = rows.filter((r) => r.type === "fake");
  const hacked = fakes.some((r) => r.outcome === "hacked");
  const status: ReportStatus = hacked ? "hacked" : fakes.every((r) => r.points >= 2) ? "safe" : "risky";

  const raw = rows.reduce((sum, r) => sum + r.points, 0);
  const max = maxScore(content);
  // Yayına çıkan labda ham toplam 10'dur (puan = ham × 10); taslağı denerken farklıysa yine 100'e ölçeklenir.
  const score = max > 0 ? Math.round((raw / max) * reportScale) : 0;

  const title: ReportTitle =
    status === "hacked" ? "hacked" : status === "risky" ? "missed" : score >= 90 ? "caught" : "safeButMissed";

  const engaged = hacked || content.items.some((i) => i.kind === "fake" && (state.clicked.includes(i.id) || state.replied.includes(i.id)));
  const conditions = {
    engaged,
    hacked,
    missedFake: fakes.some((r) => r.state !== "ok"),
    reportedReal: rows.some((r) => r.type === "real" && r.outcome === "reported"),
    always: true,
  };
  const tips = content.tips.flatMap((tip, index) => (conditions[tip.when] ? [index] : [])).slice(0, 3);

  return {
    status,
    title,
    score,
    rows,
    tips,
    genericTips: 3 - tips.length,
    caught: fakes.length > 0 && fakes.every((r) => r.state === "ok"),
    compromise: hacked ? content.trap.kind : null,
  };
}

/** Puan ve seviye için: senaryo labı rapor puanı × 2 (en çok 200), eğitim labı 100 (lib/progress/levels.ts). */
export const pointsForScore = (score: number) => Math.max(0, Math.min(reportScale, score)) * 2;
