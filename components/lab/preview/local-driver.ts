// Yönetimdeki önizleme ("Öğrenci gibi dene") için tarayıcıda çalışan sürücüler. Oynatıcı
// öğrencinin gördüğü oynatıcının aynısıdır; tek fark kararların sunucuya değil bu sürücüye
// gitmesidir. İçeriğin tamamı (doğru kararlar dahil) burada durur, çünkü onu zaten yazan
// yönetim ekibi görüyor; öğrencinin tarayıcısına bu dosya hiç gitmez. Hiçbir şey kaydedilmez.

import { opensOrder, opensRequest, opensShop, usesTrapPage, type ScenarioContent, type ScenarioTemplate, type TrainingContent } from "@/lib/lab/content";
import { applyEvent, emptyState, type LabEventData } from "@/lib/lab/events";
import { missionDone, scoreScenario, type ScenarioReport } from "@/lib/lab/scoring";
import { goodCall, hackedStory, linkPageFor, smsFor } from "@/lib/lab/story";
import { checkPlacement, checkQuiz, checkSpot, firstUnanswered, hintFor, isPlacement, quizOf, validHintRequest, validPicks } from "@/lib/lab/training";
import type { Fail, FailReason, LabDriver, TrainingDriver } from "../driver";

const fail = (reason: FailReason): Fail => ({ ok: false, reason });

/** Önizleme denemesinin kimliği; sunucuda böyle bir deneme yoktur. */
export const previewAttemptId = "onizleme";
export const previewVersion = 0;

/** Senaryo labı: olayları bellekte tutar, lab bitince (ya da hacklenince) raporu onEnd'e verir. */
export function localDriver(content: ScenarioContent, template: ScenarioTemplate, onEnd: (report: ScenarioReport) => void): LabDriver {
  let state = emptyState();
  let ended = false;
  let report: ScenarioReport | null = null;
  const clicked = new Map<string, Date>();

  const apply = (event: LabEventData) => {
    state = applyEvent(state, event);
  };
  const end = () => {
    if (ended) return report!;
    ended = true;
    report = scoreScenario(content, state);
    onEnd(report);
    return report;
  };
  const itemOf = (id: string) => content.items.find((i) => i.id === id);

  return {
    async start() {
      return { ok: true, attemptId: previewAttemptId, version: previewVersion };
    },
    async send(_attemptId, batch) {
      if (ended) return fail("ended");
      for (const { event } of batch) apply(event);
      return { ok: true };
    },
    async openLink(_attemptId, _seq, itemId) {
      const item = itemOf(itemId);
      if (ended) return fail("ended");
      if (!item?.link) return fail("invalid");
      apply({ type: "link_clicked", item: item.id });
      clicked.set(item.id, new Date());
      return { ok: true, page: linkPageFor(content, template, { ...item, link: item.link }) };
    },
    async submitTrap(_attemptId, _seq, itemId) {
      const item = itemOf(itemId);
      if (ended) return fail("ended");
      if (!item || item.kind !== "fake" || !usesTrapPage(content, template) || !state.clicked.includes(item.id)) return fail("invalid");
      apply({ type: "info_entered", item: item.id });
      end();
      const now = new Date();
      return { ok: true, hacked: hackedStory(content, template, item, "link", { first: clicked.get(item.id) ?? now, second: now }, "") };
    },
    async sendReply(_attemptId, _seq, itemId, withSecret) {
      const item = itemOf(itemId);
      if (ended) return fail("ended");
      if (!item || template !== "MESSAGING") return fail("invalid");
      const secret = withSecret && content.trap.secret.trim().length > 0;
      apply({ type: "reply_sent", item: item.id, secret });
      if (item.kind !== "fake" || !secret) return { ok: true, hacked: null };
      end();
      const now = new Date();
      return { ok: true, hacked: hackedStory(content, template, item, "reply", { first: now, second: now }, "") };
    },
    async payShop(_attemptId, _seq, itemId) {
      const item = itemOf(itemId);
      if (ended) return fail("ended");
      if (!item || template !== "INBOX" || !opensShop(content, item) || !state.clicked.includes(item.id)) return fail("invalid");
      apply({ type: "info_entered", item: item.id });
      return { ok: true, sms: smsFor(content, item)! };
    },
    async answerCode(_attemptId, _seq, itemId, enter) {
      const item = itemOf(itemId);
      if (ended) return fail("ended");
      const decided = state.codeEntered.includes(itemId) || state.codeRefused.includes(itemId);
      const shopCode = !!item?.payment && template === "INBOX" && !!content.mission?.shop && state.infoEntered.includes(item.id);
      const request = !!item && template === "MESSAGING" && opensRequest(content, item) && state.clicked.includes(item.id);
      if (!item || !(shopCode || request) || decided) return fail("invalid");
      apply({ type: enter ? "code_entered" : "code_refused", item: item.id });
      if (item.kind === "fake" && enter) {
        end();
        const now = new Date();
        return { ok: true, hacked: hackedStory(content, template, item, request ? "request" : "code", { first: clicked.get(item.id) ?? now, second: now }, "") };
      }
      const refused = (request ? item.request?.refused : item.payment?.refused) ?? "";
      return { ok: true, hacked: null, reply: enter ? "" : refused, done: shopCode && item.kind === "real" };
    },
    async shipOrder(_attemptId, _seq, itemId, prepared) {
      const item = itemOf(itemId);
      const sale = content.mission?.sale;
      if (ended) return fail("ended");
      if (!item || !sale || template !== "MESSAGING" || !opensOrder(content, item) || !state.clicked.includes(item.id) || state.shipped.includes(item.id)) return fail("invalid");
      apply({ type: "item_shipped", item: item.id, prepared });
      return { ok: true, reply: prepared ? "" : sale.unprepared, done: prepared && item.kind === "real" };
    },
    async finish() {
      const done = missionDone(content, state);
      const result = end();
      const reportedFake = result.rows.some((r) => r.type === "fake" && (r.outcome === "reported" || r.outcome === "reportedAfterEngaging"));
      return { ok: true, reportPath: "", call: goodCall(content, done, reportedFake) };
    },
  };
}

/**
 * Eğitim labı: tıkla-bul ve soruların doğrusu taslaktan; ilerleme kaydedilmez. Bitiş kuralı
 * öğrencidekiyle aynıdır: cevaplanmamış soru varken eğitim bitmez (lib/lab/actions.ts).
 */
export function localTrainingDriver(content: TrainingContent): TrainingDriver {
  const cardOf = (id: string) => content.cards.find((c) => c.id === id);
  const answered: string[] = [];
  return {
    async spot(cardId, part) {
      const card = cardOf(cardId);
      if (card?.type !== "clickFind") return fail("invalid");
      return { ok: true, spot: checkSpot(card, part) };
    },
    async hint(cardId, found, n) {
      const card = cardOf(cardId);
      if (card?.type !== "clickFind" || !validHintRequest(found, n)) return fail("invalid");
      return { ok: true, hint: hintFor(card, found, n) };
    },
    async answer(cardId, option) {
      const card = cardOf(cardId);
      const quiz = card ? quizOf(card) : null;
      if (!card || !quiz || !quiz.options[option]) return fail("invalid");
      if (!answered.includes(card.id)) answered.push(card.id);
      return { ok: true, result: checkQuiz(quiz, option) };
    },
    async place(cardId, picks) {
      const card = cardOf(cardId);
      if (!card || !isPlacement(card) || !validPicks(card, picks)) return fail("invalid");
      if (!answered.includes(card.id)) answered.push(card.id);
      return { ok: true, result: checkPlacement(card, picks) };
    },
    async save(cardIndex) {
      const card = cardIndex >= content.cards.length ? firstUnanswered(content.cards, answered) : null;
      return card === null ? { ok: true } : { ok: false, reason: "unanswered", card };
    },
  };
}
