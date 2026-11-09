// "Yayına hazır mı?" listesi (Lab-Duzenle-Son). Liste tamamlanmadan lab yayınlanamaz; aynı
// denetim hem formda (canlı) hem sunucuda (yayınla eylemi) çalışır. Maddelerin yazısı sözlükte:
// t.admin.editor.checklist[anahtar].

import { fillParts, maxScore, rawTotal, usesTrapPage, type ScenarioContent, type ScenarioTemplate, type TrainingContent } from "./content";

export type EditorSection = "cover" | "items" | "trap" | "tasks" | "report" | "cards";

export type ScenarioCheck = "cover" | "items" | "signs" | "trap" | "mission" | "tasks" | "options" | "rightWhy" | "total" | "tips";
export type TrainingCheck = "cover" | "cards" | "cardText" | "answers";

export type CheckItem<K extends string> = { key: K; ok: boolean; section: EditorSection };

const filled = (value: string) => value.trim().length > 0;

export function scenarioChecklist(content: ScenarioContent, template: ScenarioTemplate): CheckItem<ScenarioCheck>[] {
  const fakes = content.items.filter((i) => i.kind === "fake");
  const reals = content.items.filter((i) => i.kind === "real");
  const questions = content.tasks.filter((t) => t.type === "question");
  const trap = content.trap;
  const mission = content.mission;
  const missionTasks = content.tasks.filter((t) => t.type === "mission");
  // Görevli odaya özgü bağlantılar: mağaza ödemesi, ödeme isteği, sipariş.
  const linked = content.items.filter((i) => i.payment || i.request || i.order);

  const checks: CheckItem<ScenarioCheck>[] = [
    // Odanın kendi hatırlatmaları artık zorunlu değil: öğrenci odaya girerken genel hatırlatmaları görür (18. revize).
    { key: "cover", section: "cover", ok: content.meta.name.trim().length >= 4 },
    {
      key: "items",
      section: "items",
      ok: fakes.length >= 1 && reals.length >= 1 && content.items.every((i) => filled(i.sender) && filled(i.body)),
    },
    {
      key: "signs",
      section: "items",
      ok: fakes.length >= 1 && fakes.every((i) => i.signs.length >= 3 && i.signs.every((s) => filled(s.text))),
    },
    // Gelen kutusunda sahte sayfa; mesajlaşmada gönderilince hackleyen kod ya da (M1) sahte
    // mesajdaki bağlantının açtığı sahte sayfa.
    {
      key: "trap",
      section: "trap",
      ok:
        filled(trap.ask) &&
        // Görevli odada tuzak sahte mağazadır: sayfası mağaza sayfası, adresi sahte maildeki bağlantı.
        (mission
          ? true
          : template === "INBOX"
          ? filled(trap.url) && filled(trap.title)
          : filled(trap.secret) || (usesTrapPage(content, template) && fakes.some((i) => i.link !== null))),
    },
    // Görevli oda (Para Çarşısı): görev ve mağaza dolu, en az bir gerçek ve bir sahte bağlantının
    // ödemesi yazılı, tek "görev" maddesi. Görev maddesi yalnızca görevli odada olur; görevsiz odada
    // bu satır listede görünmez (aşağıda), ama görev maddesi ya da ödeme yazılmışsa eksik görünür.
    {
      key: "mission",
      section: "tasks",
      ok: mission ? missionReady(content, template) : missionTasks.length === 0 && linked.length === 0,
    },
    { key: "tasks", section: "tasks", ok: content.tasks.length >= 4 && content.tasks.every((t) => filled(t.text)) },
    {
      key: "options",
      section: "tasks",
      // 3 ya da 4 seçenek (Para Çarşısı soruları 4 seçenekli, Murat 2 Kasım).
      ok: questions.every((t) => t.options.length >= 3 && t.options.every((o) => filled(o.text)) && t.options.some((o) => o.points > 0)),
    },
    // BİLDİR görevinin raporda kendi satırı yok (mail ve mesaj satırları); "Doğrusu" ve "Neden?" yalnızca soruda.
    { key: "rightWhy", section: "tasks", ok: [...questions, ...missionTasks].every((t) => filled(t.right) && filled(t.why)) },
    { key: "total", section: "tasks", ok: maxScore(content) === rawTotal },
    { key: "tips", section: "report", ok: content.tips.filter((t) => filled(t.text)).length >= 3 },
  ];
  return mission || missionTasks.length > 0 || linked.length > 0 ? checks : checks.filter((c) => c.key !== "mission");
}

/**
 * Görevli oda hazır mı: arama, görev ve bitişler dolu, tek "görev" maddesi. Alış görevi (Postam):
 * kart, mağaza ve onay kodu; en az bir gerçek ve bir sahte bağlantının ödemesi yazılı. Satış görevi
 * (Mesajlar): ilan ve hazırlık maddeleri; bir sahte mesajda ödeme isteği, bir gerçek mesajda sipariş.
 */
function missionReady(content: ScenarioContent, template: ScenarioTemplate) {
  const mission = content.mission!;
  const common =
    content.tasks.filter((t) => t.type === "mission").length === 1 &&
    [mission.caller, mission.owner, mission.title, mission.accept, mission.goodTitle, mission.done].every(filled) &&
    mission.lines.some(filled) &&
    mission.good.some(filled) &&
    mission.bad.some(filled);
  if (!common) return false;
  if (mission.sale) {
    const requests = content.items.filter((i) => i.request);
    const orders = content.items.filter((i) => i.order);
    return (
      template === "MESSAGING" &&
      !mission.shop &&
      !mission.card &&
      [mission.sale.product, mission.sale.price, mission.sale.platform, mission.sale.unprepared].every(filled) &&
      mission.sale.prep.length >= 1 &&
      mission.sale.prep.every(filled) &&
      requests.some((i) => i.kind === "fake") &&
      requests.every((i) => i.link !== null && filled(i.request!.bank) && filled(i.request!.from) && filled(i.request!.amount)) &&
      orders.some((i) => i.kind === "real") &&
      orders.every((i) => i.link !== null && filled(i.order!.buyer)) &&
      content.items.every((i) => !i.payment)
    );
  }
  const paid = content.items.filter((i) => i.payment);
  return (
    template === "INBOX" &&
    !!mission.card &&
    !!mission.shop &&
    [mission.refuse, mission.code, mission.card.number, mission.card.expiry, mission.shop.name, mission.shop.product, mission.shop.price].every(filled) &&
    paid.some((i) => i.kind === "real") &&
    paid.some((i) => i.kind === "fake") &&
    paid.every((i) => i.link !== null && filled(i.payment!.shop) && filled(i.payment!.amount)) &&
    content.items.every((i) => !i.request && !i.order)
  );
}

export function trainingChecklist(content: TrainingContent): CheckItem<TrainingCheck>[] {
  const cards = content.cards;
  const cardOk = cards.every((card) => {
    switch (card.type) {
      case "info":
        // Açılan maddeli düzenlerde (keşfet, adım adım, banka kartı) maddeler dolu olmalı; banka
        // kartının çizimi dört maddeye göredir.
        if (card.layout && card.layout !== "list")
          return (
            filled(card.title) &&
            card.points.length >= (card.layout === "bankCard" ? 4 : 2) &&
            card.points.every((p) => filled(p.title) && filled(p.text))
          );
        return filled(card.title) && (card.paragraphs.some(filled) || card.points.some((p) => filled(p.title)));
      case "clickFind":
        return filled(card.title) && filled(card.mail.sender) && card.spots.length >= 1 && card.spots.every((s) => filled(s.text));
      case "quiz":
        return filled(card.question) && card.options.every(filled) && filled(card.explain);
      case "video":
        return filled(card.title) && filled(card.src) && (!card.question || (filled(card.question.question) && card.question.options.every(filled)));
      case "match":
        // Aynı sağ birden çok kez yazılabilir: sağdakiler o zaman gruplardır.
        return filled(card.title) && card.pairs.length >= 2 && card.pairs.every((p) => filled(p.left) && filled(p.right));
      case "sort": {
        // 2-4 kutu, adları dolu ve farklı; en az 2 bilgi, her biri var olan bir kutuda.
        const labels = card.bins.map((b) => b.label.trim().toLocaleLowerCase("tr"));
        return (
          filled(card.title) &&
          card.bins.length >= 2 &&
          labels.every(Boolean) &&
          new Set(labels).size === labels.length &&
          card.items.length >= 2 &&
          card.items.every((i) => filled(i.text) && i.bin < card.bins.length)
        );
      }
      case "fill": {
        const answers = card.sentences.flatMap((s) => fillParts(s).answers);
        return (
          filled(card.title) &&
          card.sentences.length >= 1 &&
          card.sentences.every(filled) &&
          answers.length >= 1 &&
          answers.every(filled) &&
          card.extra.every(filled)
        );
      }
    }
  });
  const answersOk = cards.every((card) => {
    const quiz = card.type === "quiz" ? card : card.type === "video" ? card.question : null;
    return !quiz || quiz.answer < quiz.options.length;
  });
  return [
    { key: "cover", section: "cover", ok: content.meta.name.trim().length >= 4 && filled(content.meta.summary) },
    { key: "cards", section: "cards", ok: cards.length >= 3 },
    { key: "cardText", section: "cards", ok: cards.length > 0 && cardOk },
    { key: "answers", section: "cards", ok: answersOk },
  ];
}

export const isReady = (items: { ok: boolean }[]) => items.every((i) => i.ok);
