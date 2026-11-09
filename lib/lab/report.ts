// Sonuç raporunun ekrandaki hali (Rapor-Son): sunucunun hesapladığı rapor özeti (scoring.ts,
// yalnızca kodlar ve sayılar) içerik ve sözlükle cümlelere çevrilir. Öğrencinin raporu sunucuda,
// yönetimdeki "Öğrenci gibi dene" tarayıcıda aynı fonksiyonla çizilir. Veritabanına dokunmaz.
//
// Rapor yalnızca biten denemede gösterilir: doğrusu ve "Neden?" burada açılır.

import { getMessages, format } from "@/lib/i18n";
import { maxScore, paragraphs, reportScale, usesTrapPage, type ScenarioContent, type ScenarioTemplate, type SignPlace } from "./content";
import type { ReportStatus, RowState, ScenarioReport } from "./scoring";

export type ReportRowView = {
  key: string;
  kind: "fake" | "real" | "question" | "mission";
  title: string;
  tag: string;
  state: RowState;
  points: number;
  max: number;
  did: string;
  right: string;
  why: string;
};

export type SignView = { n: number; at: SignPlace; title: string; text: string; quote: string };

export type SignedItem = {
  sender: string;
  address: string;
  subject: string;
  paragraphs: string[];
  link: { text: string; url: string } | null;
};

export type ReportView = {
  template: ScenarioTemplate;
  status: ReportStatus;
  title: string;
  score: number;
  rows: ReportRowView[];
  counts: { ok: number; part: number; bad: number; skip: number };
  /** Sahte öğenin işaretleri: yakaladıysa "yakaladığın", değilse "kaçırdığın" başlığıyla. */
  signs: { heading: string; item: SignedItem; list: SignView[] } | null;
  tips: string[];
};

const realKey = { reported: "realReported", deleted: "realDeleted", kept: "realKept" } as const;

export function buildReportView(content: ScenarioContent, template: ScenarioTemplate, report: ScenarioReport): ReportView {
  const t = getMessages().lab.report;
  const items = new Map(content.items.map((i) => [i.id, i]));
  const tasks = new Map(content.tasks.map((task) => [task.id, task]));
  // Satır puanları da rapor puanıyla aynı ölçekte (100 üzerinden) yazılır: yayındaki labda ham × 10.
  const raw = maxScore(content);
  const scaled = (n: number) => (raw > 0 ? Math.round((n / raw) * reportScale) : 0);
  // Mesajlaşmada sahte mesaja bağlantıyla kandıysa satır bağlantıdan söz eder; tuzak sahte
  // sayfaysa (M1) doğrusu da "bağlantıyı açmadan" olur.
  const linkOutcomes = { ...t.outcomes.MESSAGING, ...t.outcomesLink };
  // Satış görevli odada sahte mesajdaki bağlantı bankanın ödeme isteğini açar.
  const requestOutcomes = { ...t.outcomes.MESSAGING, ...t.outcomesRequest };
  const fakeRight = content.mission?.sale
    ? t.defaultsRequest.fakeRight
    : template === "MESSAGING" && usesTrapPage(content, template)
      ? t.defaultsPage.fakeRight
      : t.defaults[template].fakeRight;

  const rows: ReportRowView[] = report.rows.flatMap((row): ReportRowView[] => {
    if (row.type === "mission") {
      const task = tasks.get(row.task);
      if (!task) return [];
      return [
        {
          key: `m-${row.task}`,
          kind: "mission",
          title: format(t.missionTitle, { text: task.text }),
          tag: format(t.tags.mission, { owner: (content.mission?.owner ?? "").toLocaleUpperCase("tr") }).trim(),
          state: row.state,
          points: scaled(row.points),
          max: scaled(row.max),
          did: row.done ? content.mission?.done || t.missionDone : t.missionUndone,
          right: task.right,
          why: task.why,
        },
      ];
    }
    if (row.type === "question") {
      const task = tasks.get(row.task);
      if (!task) return [];
      const option = row.option !== null ? task.options[row.option] : undefined;
      return [
        {
          key: `q-${row.task}`,
          kind: "question",
          title: format(t.questionTitle, { text: task.text }),
          tag: t.tags.question,
          state: row.state,
          points: scaled(row.points),
          max: scaled(row.max),
          did: option ? format(t.answered, { option: option.text }) : t.skipped,
          right: task.right,
          why: task.why,
        },
      ];
    }
    const item = items.get(row.item);
    if (!item) return [];
    return [
      {
        key: `i-${row.item}`,
        kind: row.type,
        title: format(t.rowTitle[template], { sender: item.sender }),
        tag: t.tags[template][row.type],
        state: row.state,
        points: scaled(row.points),
        max: scaled(row.max),
        did:
          row.type === "fake"
            ? (template === "MESSAGING" && row.by === "request"
                ? requestOutcomes
                : template === "MESSAGING" && row.by === "link"
                  ? linkOutcomes
                  : t.outcomes[template])[row.outcome]
            : t.outcomes[template][realKey[row.outcome]],
        right: row.type === "fake" ? fakeRight : t.defaults[template].realRight,
        why: item.why,
      },
    ];
  });

  const fake = content.items.find((i) => i.kind === "fake" && i.signs.some((s) => s.text.trim())) ?? null;
  const signs = fake
    ? {
        heading: report.caught ? t.signsCaught[template] : t.signsMissed,
        item: {
          sender: fake.sender,
          address: fake.address,
          subject: fake.subject,
          paragraphs: paragraphs(fake.body).map((p) => p.replace(/\*\*/g, "")),
          link: fake.link,
        },
        list: fake.signs
          .filter((s) => s.text.trim())
          .map((s, i) => ({ n: i + 1, at: s.at, title: t.places[s.at], text: s.text, quote: s.quote })),
      }
    : null;

  const tips = [
    ...report.tips.map((i) => content.tips[i]?.text ?? "").filter(Boolean),
    ...t.genericTips[template].slice(0, Math.max(0, report.genericTips)),
  ].slice(0, 3);

  return {
    template,
    status: report.status,
    title: t.titles[template][report.title],
    score: report.score,
    rows,
    counts: {
      ok: rows.filter((r) => r.state === "ok").length,
      part: rows.filter((r) => r.state === "part").length,
      bad: rows.filter((r) => r.state === "bad").length,
      // Cevaplanmayan soru yanlış sayılmaz, ayrı yazılır (satırda da "Cevaplanmadı" der).
      skip: rows.filter((r) => r.state === "skip").length,
    },
    signs,
    tips,
  };
}
