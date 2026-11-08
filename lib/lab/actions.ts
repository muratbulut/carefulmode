"use server";

// Lab SDK'nın sunucu tarafı (doküman Bölüm 4): olayları kaydeder, bağlantıyla açılacak sayfayı
// söyler, ele geçirilmeyi ve labın bitişini işler, eğitim kartlarındaki cevaplara bakar.
// Puan ve geri bildirim yalnızca burada hesaplanır; tarayıcıdan gelen kimlik, puan ya da
// "doğru" bilgisine hiç güvenilmez. Sahte formlara yazılan metin buraya hiç gelmez.

import { isDeepStrictEqual } from "node:util";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { paths } from "@/lib/navigation";
import { awardBadges } from "@/lib/progress/summary";
import { rateLimit, rateRules } from "@/lib/rate-limit";
import { getUser } from "@/lib/session";
import { opensOrder, opensRequest, opensShop, parseScenario, usesTrapPage, type ScenarioContent } from "./content";
import { findInCity, getCity, getPublishedLab, type PublishedLab } from "./data";
import { batchEventSchema, reduceEvents, rowToEvent, type ServerEvent } from "./events";
import { missionDone, scoreScenario, type ScenarioReport } from "./scoring";
import { goodCall, hackedStory, linkPageFor, smsFor, type HackedVia } from "./story";
import { checkPlacement, checkQuiz, checkSpot, firstUnanswered, hintFor, isPlacement, quizOf, validHintRequest, validPicks } from "./training";

type Fail = { ok: false; reason: "auth" | "unverified" | "not_found" | "locked" | "ended" | "rate_limited" | "invalid" };
const fail = (reason: Fail["reason"]): Fail => ({ ok: false, reason });

/** Bir denemede en fazla bu kadar olay olur; fazlası betikle yüklemedir. */
const maxSeq = 2000;
const maxBatch = 50;

async function actor(verified: boolean) {
  const user = await getUser();
  if (!user) return fail("auth");
  if (verified && !user.emailVerified) return fail("unverified");
  const limit = await rateLimit.consume(rateRules.labActions, user.id);
  if (!limit.allowed) return fail("rate_limited");
  return { ok: true as const, user };
}

// ---------------------------------------------------------------------------------------
// Senaryo labı
// ---------------------------------------------------------------------------------------

/** "Hazırım, başla": yarım deneme varsa o, yoksa yayındaki sürümle yeni deneme. */
export async function startAttempt(slug: string) {
  const who = await actor(true);
  if (!who.ok) return who;
  const lab = await getPublishedLab(slug);
  if (!lab || lab.type !== "SCENARIO" || !lab.scenario) return fail("not_found");

  const city = await getCity(who.user.id);
  const district = city.find((d) => d.id === lab.neighborhoodId);
  const entry = district?.scenarios.find((s) => s.lab.id === lab.id);
  if (!entry || entry.state === "locked") return fail("locked");

  const open = await db.labAttempt.findFirst({
    where: { userId: who.user.id, labId: lab.id, status: "IN_PROGRESS" },
    select: { id: true, labVersion: true },
  });
  if (open) return { ok: true as const, attemptId: open.id, version: open.labVersion };
  const attempt = await db.labAttempt.create({
    data: { userId: who.user.id, labId: lab.id, labVersion: lab.version },
    select: { id: true, labVersion: true },
  });
  return { ok: true as const, attemptId: attempt.id, version: attempt.labVersion };
}

type LoadedAttempt = {
  id: string;
  userId: string;
  startedAt: Date;
  lab: { slug: string; template: "TRAINING" | "INBOX" | "MESSAGING" };
  content: ScenarioContent;
  events: { seq: number; type: string; data: Prisma.JsonValue; createdAt: Date }[];
};

/** Öğrencinin kendi, süren denemesi; içerik denemenin başladığı sürümden. */
async function openAttempt(userId: string, attemptId: string): Promise<LoadedAttempt | Fail> {
  // Eylemler tarayıcıdan her türlü değerle çağrılabilir; kimlik metin değilse sorgu hiç yapılmaz.
  if (typeof attemptId !== "string" || attemptId.length === 0 || attemptId.length > 64) return fail("not_found");
  const attempt = await db.labAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      userId: true,
      status: true,
      startedAt: true,
      lab: { select: { slug: true, template: true } },
      versionRecord: { select: { content: true } },
      events: { orderBy: { seq: "asc" }, select: { seq: true, type: true, data: true, createdAt: true } },
    },
  });
  if (!attempt || attempt.userId !== userId) return fail("not_found");
  if (attempt.status !== "IN_PROGRESS") return fail("ended");
  const content = parseScenario(attempt.versionRecord.content);
  if (!content || attempt.lab.template === "TRAINING") return fail("not_found");
  return { ...attempt, content };
}

function validSeq(seq: number) {
  return Number.isInteger(seq) && seq >= 0 && seq < maxSeq;
}

/**
 * Sunucunun karar verdiği olayı (bağlantı, sahte form, cevap gönderme) yazar. Sıra numarası başka
 * bir olayla doluysa (aynı deneme iki sekmede açık ya da eylem elle çağrıldı) olay yazılamaz ve
 * eylem de yapılmaz: yoksa sahte sayfa tıklama kaydedilmeden açılırdı. Aynı olayın aynı numarayla
 * tekrar gelmesi (yeniden gönderim) sorun değildir.
 */
async function record(attemptId: string, seq: number, event: ServerEvent): Promise<boolean> {
  const { type, ...data } = event;
  const created = await db.labEvent.createMany({ data: [{ attemptId, seq, type, data }], skipDuplicates: true });
  if (created.count > 0) return true;
  const taken = await db.labEvent.findUnique({ where: { attemptId_seq: { attemptId, seq } }, select: { type: true, data: true } });
  return taken?.type === type && isDeepStrictEqual(taken.data, data);
}

/** Tarayıcıda biriken olaylar (mail açtı, taşıdı, cevapladı...). Aynı sıra numarası iki kez yazılmaz. */
export async function sendEvents(attemptId: string, batch: { seq: number; event: unknown }[]) {
  const who = await actor(true);
  if (!who.ok) return who;
  if (!Array.isArray(batch) || batch.length === 0 || batch.length > maxBatch) return fail("invalid");
  const attempt = await openAttempt(who.user.id, attemptId);
  if ("ok" in attempt) return attempt;

  const itemIds = new Set(attempt.content.items.map((i) => i.id));
  const tasks = new Map(attempt.content.tasks.map((t) => [t.id, t]));
  const rows: Prisma.LabEventCreateManyInput[] = [];
  for (const entry of batch) {
    const parsed = batchEventSchema.safeParse(entry?.event);
    if (!parsed.success || !validSeq(entry.seq)) return fail("invalid");
    const event = parsed.data;
    if ("item" in event && !itemIds.has(event.item)) return fail("invalid");
    if (event.type === "answer") {
      const task = tasks.get(event.task);
      if (!task || task.type !== "question" || !task.options[event.option]) return fail("invalid");
    }
    const { type, ...data } = event;
    rows.push({ attemptId, seq: entry.seq, type, data });
  }
  await db.labEvent.createMany({ data: rows, skipDuplicates: true });
  return { ok: true as const };
}

/** Mail içindeki bağlantı: sahte maildeyse sahte sayfa, gerçekteyse yalnızca adres gösterilir. */
export async function openLink(attemptId: string, seq: number, itemId: string) {
  const who = await actor(true);
  if (!who.ok) return who;
  const attempt = await openAttempt(who.user.id, attemptId);
  if ("ok" in attempt) return attempt;
  const item = attempt.content.items.find((i) => i.id === itemId);
  if (!item?.link || !validSeq(seq)) return fail("invalid");
  if (!(await record(attempt.id, seq, { type: "link_clicked", item: item.id }))) return fail("invalid");
  const template = attempt.lab.template === "MESSAGING" ? "MESSAGING" : "INBOX";
  return { ok: true as const, page: linkPageFor(attempt.content, template, { ...item, link: item.link }) };
}

/** Sahte sayfada "Giriş yap": yalnızca "bilgi girildi" olayı gelir, yazılan metin gelmez. */
export async function submitTrap(attemptId: string, seq: number, itemId: string) {
  const who = await actor(true);
  if (!who.ok) return who;
  const attempt = await openAttempt(who.user.id, attemptId);
  if ("ok" in attempt) return attempt;
  const item = attempt.content.items.find((i) => i.id === itemId);
  const clicked = attempt.events.some((e) => e.type === "link_clicked" && (e.data as { item?: string })?.item === itemId);
  const template = attempt.lab.template === "MESSAGING" ? "MESSAGING" : "INBOX";
  if (!item || item.kind !== "fake" || !usesTrapPage(attempt.content, template) || !clicked || !validSeq(seq)) return fail("invalid");
  if (!(await record(attempt.id, seq, { type: "info_entered", item: item.id }))) return fail("invalid");
  return compromise(attempt, item.id, "link");
}

/** Mesajlaşma: cevap gönderildi. Kodu içeriyor mu bilgisini tarayıcı söyler; metnin kendisi gelmez. */
export async function sendReply(attemptId: string, seq: number, itemId: string, withSecret: boolean) {
  const who = await actor(true);
  if (!who.ok) return who;
  const attempt = await openAttempt(who.user.id, attemptId);
  if ("ok" in attempt) return attempt;
  const item = attempt.content.items.find((i) => i.id === itemId);
  if (!item || attempt.lab.template !== "MESSAGING" || !validSeq(seq)) return fail("invalid");
  const secret = withSecret === true && attempt.content.trap.secret.trim().length > 0;
  if (!(await record(attempt.id, seq, { type: "reply_sent", item: item.id, secret }))) return fail("invalid");
  if (item.kind === "fake" && secret) return compromise(attempt, item.id, "reply");
  return { ok: true as const, hacked: null };
}

const hasEvent = (attempt: LoadedAttempt, type: string, itemId: string) =>
  attempt.events.some((e) => e.type === type && (e.data as { item?: string })?.item === itemId);

/**
 * Görevli oda, mağaza sayfasında "Öde": kart bilgisi hiç gelmez, yalnızca "bilgi girildi" olayı
 * yazılır. Veliye gelen SMS (mağaza adı, tutar, kod) burada, ödeyince söylenir; önceden tarayıcıya
 * gitmez çünkü sahte sitenin tutarı farklıdır. Bağlantısı açılmamış öğede ödeme olmaz.
 */
export async function payShop(attemptId: string, seq: number, itemId: string) {
  const who = await actor(true);
  if (!who.ok) return who;
  const attempt = await openAttempt(who.user.id, attemptId);
  if ("ok" in attempt) return attempt;
  const item = attempt.content.items.find((i) => i.id === itemId);
  if (!item || attempt.lab.template !== "INBOX" || !opensShop(attempt.content, item) || !hasEvent(attempt, "link_clicked", item.id) || !validSeq(seq)) {
    return fail("invalid");
  }
  if (!(await record(attempt.id, seq, { type: "info_entered", item: item.id }))) return fail("invalid");
  return { ok: true as const, sms: smsFor(attempt.content, item)! };
}

/**
 * Görevli oda: SMS'teki onay kodunu yazdı (enter) ya da yazmadı. Sahte mağazada yazınca ele
 * geçirilir (kötü bitiş araması ve alarm). Diğer durumlarda velinin cevabı (yazmadıysa) ve işin
 * doğru yerden yapılıp yapılmadığı döner; karar verildikten sonra söylenmesinde sakınca yok.
 * Her öğede tek karar verilir.
 */
export async function answerCode(attemptId: string, seq: number, itemId: string, enter: boolean) {
  const who = await actor(true);
  if (!who.ok) return who;
  const attempt = await openAttempt(who.user.id, attemptId);
  if ("ok" in attempt) return attempt;
  const item = attempt.content.items.find((i) => i.id === itemId);
  const entered = enter === true;
  const type = entered ? "code_entered" : "code_refused";
  const decidedBefore = attempt.events.some(
    (e) => (e.type === "code_entered" || e.type === "code_refused") && (e.data as { item?: string })?.item === itemId && e.seq !== seq,
  );
  // Alış görevi: mağazada ödedikten sonra SMS'teki kod. Satış görevi: bağlantıdaki ödeme isteği.
  const content = attempt.content;
  const shopCode = !!item?.payment && attempt.lab.template === "INBOX" && !!content.mission?.shop && hasEvent(attempt, "info_entered", item.id);
  const request = !!item && attempt.lab.template === "MESSAGING" && opensRequest(content, item) && hasEvent(attempt, "link_clicked", item.id);
  if (!item || !(shopCode || request) || decidedBefore || !validSeq(seq)) return fail("invalid");
  if (!(await record(attempt.id, seq, { type, item: item.id }))) return fail("invalid");
  if (item.kind === "fake" && entered) return compromise(attempt, item.id, request ? "request" : "code");
  const refused = (request ? item.request?.refused : item.payment?.refused) ?? "";
  return { ok: true as const, hacked: null, reply: entered ? "" : refused, done: shopCode && item.kind === "real" };
}

/**
 * Satış görevi: pazar yerindeki siparişte "Kargoya ver". prepared: hazırlık maddelerinin hepsini
 * işaretledi (telefonu sıfırladı); işaretlerin kendisi gelmez. Hazırlamadan gönderdiyse alıcının
 * mesajı döner. Her sipariş bir kez gönderilir.
 */
export async function shipOrder(attemptId: string, seq: number, itemId: string, prepared: boolean) {
  const who = await actor(true);
  if (!who.ok) return who;
  const attempt = await openAttempt(who.user.id, attemptId);
  if ("ok" in attempt) return attempt;
  const item = attempt.content.items.find((i) => i.id === itemId);
  const sale = attempt.content.mission?.sale;
  const shippedBefore = attempt.events.some((e) => e.type === "item_shipped" && (e.data as { item?: string })?.item === itemId && e.seq !== seq);
  if (!item || !sale || attempt.lab.template !== "MESSAGING" || !opensOrder(attempt.content, item) || !hasEvent(attempt, "link_clicked", item.id) || shippedBefore || !validSeq(seq)) {
    return fail("invalid");
  }
  const ready = prepared === true;
  if (!(await record(attempt.id, seq, { type: "item_shipped", item: item.id, prepared: ready }))) return fail("invalid");
  return { ok: true as const, reply: ready ? "" : sale.unprepared, done: ready && item.kind === "real" };
}

/** "Odayı bitir, raporu gör". Görevli odada iş doğru yerden yapıldıysa iyi bitiş araması da döner. */
export async function finishAttempt(attemptId: string) {
  const who = await actor(true);
  if (!who.ok) return who;
  const attempt = await openAttempt(who.user.id, attemptId);
  if ("ok" in attempt) return attempt;
  const report = await close(attempt, "COMPLETED");
  const state = reduceEvents(attempt.events.map(rowToEvent));
  const reportedFake = report.rows.some((r) => r.type === "fake" && (r.outcome === "reported" || r.outcome === "reportedAfterEngaging"));
  const call = goodCall(attempt.content, missionDone(attempt.content, state), reportedFake);
  return { ok: true as const, reportPath: paths.labReport(attempt.lab.slug, attempt.id), call };
}

async function compromise(attempt: LoadedAttempt, itemId: string, via: HackedVia) {
  await close(attempt, "HACKED");
  const item = attempt.content.items.find((i) => i.id === itemId)!;
  const template = attempt.lab.template === "MESSAGING" ? "MESSAGING" : "INBOX";
  const events = await db.labEvent.findMany({ where: { attemptId: attempt.id }, orderBy: { seq: "asc" }, select: { type: true, data: true, createdAt: true } });
  const at = (type: string) => events.find((e) => e.type === type && (e.data as { item?: string })?.item === itemId)?.createdAt ?? new Date();
  const times = {
    first: at(via === "reply" ? "reply_sent" : "link_clicked"),
    second: at(via === "link" ? "info_entered" : via === "code" || via === "request" ? "code_entered" : "reply_sent"),
  };
  const story = hackedStory(attempt.content, template, item, via, times, paths.labReport(attempt.lab.slug, attempt.id));
  return { ok: true as const, hacked: story };
}

/** Denemeyi kapatır: puanı ve rapor özetini sunucuda hesaplar, rozetleri günceller. */
async function close(attempt: LoadedAttempt, status: "COMPLETED" | "HACKED"): Promise<ScenarioReport> {
  const events = await db.labEvent.findMany({ where: { attemptId: attempt.id }, orderBy: { seq: "asc" }, select: { type: true, data: true } });
  const report = scoreScenario(attempt.content, reduceEvents(events.map(rowToEvent)));
  const updated = await db.labAttempt.updateMany({
    where: { id: attempt.id, status: "IN_PROGRESS" },
    data: {
      status: report.status === "hacked" ? "HACKED" : status,
      reportScore: report.score,
      endedAt: new Date(),
      resultReport: report as unknown as Prisma.InputJsonValue,
    },
  });
  if (updated.count > 0) await awardBadges(attempt.userId);
  return report;
}

// ---------------------------------------------------------------------------------------
// Eğitim labı
// ---------------------------------------------------------------------------------------

/** Eğitim bu öğrenciye açık mı: ileri eğitim, temel eğitim bitmeden kilitlidir (lib/lab/gates.ts). */
async function trainingOpen(userId: string, lab: PublishedLab) {
  const item = findInCity(await getCity(userId), lab.id)?.item;
  return item !== undefined && item.state !== "locked";
}

async function trainingCard(userId: string, slug: string, cardId: string) {
  const lab = await getPublishedLab(slug);
  const content = lab?.type === "TRAINING" ? lab.training : null;
  const card = content?.cards.find((c) => c.id === cardId);
  return lab && content && card && (await trainingOpen(userId, lab)) ? { lab, content, card } : null;
}

/** Tıkla-bul: tıklanan yer şüpheli mi? Şüpheliyse sırası ve açıklaması. */
export async function checkTrainingSpot(slug: string, cardId: string, part: string) {
  const who = await actor(false);
  if (!who.ok) return who;
  const found = await trainingCard(who.user.id, slug, cardId);
  if (!found || found.card.type !== "clickFind" || typeof part !== "string") return fail("invalid");
  return { ok: true as const, spot: checkSpot(found.card, part) };
}

/** Tıkla-bulda "İpucu al": bulunmamış bir parçanın ipucu. Hiçbir şey kaydedilmez, puan yok. */
export async function getTrainingHint(slug: string, cardId: string, found: string[], n: number) {
  const who = await actor(false);
  if (!who.ok) return who;
  const card = await trainingCard(who.user.id, slug, cardId);
  if (!card || card.card.type !== "clickFind" || !validHintRequest(found, n)) return fail("invalid");
  return { ok: true as const, hint: hintFor(card.card, found, n) };
}

/**
 * Cevaplanan kartı kaydeder (yalnızca kimliği; seçilen şık ya da yerleştirme değil): eğitim ancak
 * bütün soru kartları cevaplanınca biter (B1).
 */
async function markAnswered(userId: string, labId: string, cardId: string) {
  // Tek sorguda ve atomik: kart listede yoksa eklenir. Önce okuyup sonra eklemek aynı anda gelen
  // cevaplarda (çift tıklama, iki sekme, betik) kartı defalarca yazıyordu (güvenlik turu 5). Satır
  // kilitlendikten sonra WHERE en son hâle bakar; aynı anda ilk satırı açan iki istekten ikincisi
  // çakışma yoluna düşer ve kartı orada bulur. Kimlik yayındaki sürümün soru kartlarından biri
  // olduğu için liste, yayımlanmış soru kartı sayısını geçmez. Saat, Prisma'nın yazdığı gibi UTC.
  await db.$executeRaw`
    INSERT INTO "TrainingProgress" ("userId", "labId", "answeredCards", "updatedAt")
    VALUES (${userId}, ${labId}, ARRAY[${cardId}::text], now() AT TIME ZONE 'UTC')
    ON CONFLICT ("userId", "labId") DO UPDATE SET
      "answeredCards" = array_append(coalesce("TrainingProgress"."answeredCards", '{}'), ${cardId}::text),
      "updatedAt" = now() AT TIME ZONE 'UTC'
    WHERE NOT (${cardId}::text = ANY (coalesce("TrainingProgress"."answeredCards", '{}')))`;
}

/**
 * Mini test ve video sorusu: doğru mu, doğrusu hangisi, açıklaması. Cevaplanan kart kaydedilir
 * (yalnızca kimliği; seçilen şık değil): eğitim ancak bütün sorular cevaplanınca biter (B1).
 */
export async function checkTrainingAnswer(slug: string, cardId: string, option: number) {
  const who = await actor(false);
  if (!who.ok) return who;
  const found = await trainingCard(who.user.id, slug, cardId);
  const quiz = found ? quizOf(found.card) : null;
  if (!found || !quiz || !Number.isInteger(option) || option < 0 || option >= quiz.options.length) return fail("invalid");
  await markAnswered(who.user.id, found.lab.id, found.card.id);
  return { ok: true as const, result: checkQuiz(quiz, option) };
}

/**
 * Eşleştirme ve boşluk doldurma: öğrenci her yere kutudan bir seçenek koyar (kutunun alfabetik
 * sırasındaki numara). Her yerin doğru olup olmadığı, doğruları ve açıklama döner; kart
 * cevaplanmış sayılır. Yanlış yerleştirme de cevaptır.
 */
export async function checkTrainingPlacement(slug: string, cardId: string, picks: number[]) {
  const who = await actor(false);
  if (!who.ok) return who;
  const found = await trainingCard(who.user.id, slug, cardId);
  if (!found || !isPlacement(found.card) || !validPicks(found.card, picks)) return fail("invalid");
  await markAnswered(who.user.id, found.lab.id, found.card.id);
  return { ok: true as const, result: checkPlacement(found.card, picks) };
}

/**
 * Kaldığı kartı kaydeder; son karttan sonra (bitiş kartı) eğitim tamamlanır. Bitiş, yayındaki
 * sürümün bütün soruları cevaplanmadıysa kabul edilmez: tarayıcı "son kart" dese de eğitim
 * bitmez, ilk cevaplanmamış sorunun sırası döner (oynatıcı öğrenciyi oraya götürür).
 */
export async function saveTrainingProgress(slug: string, cardIndex: number) {
  const who = await actor(false);
  if (!who.ok) return who;
  const lab = await getPublishedLab(slug);
  const content = lab?.type === "TRAINING" ? lab.training : null;
  if (!lab || !content) return fail("not_found");
  if (!(await trainingOpen(who.user.id, lab))) return fail("locked");
  const total = content.cards.length;
  const index = Math.max(0, Math.min(total, Math.floor(Number(cardIndex) || 0)));
  const finished = index >= total;
  const key = { userId_labId: { userId: who.user.id, labId: lab.id } };
  const existing = await db.trainingProgress.findUnique({ where: key, select: { completedAt: true, cardIndex: true, answeredCards: true } });
  if (finished && !existing?.completedAt) {
    const card = firstUnanswered(content.cards, existing?.answeredCards ?? []);
    if (card !== null) return { ok: false as const, reason: "unanswered" as const, card };
  }
  await db.trainingProgress.upsert({
    where: key,
    create: { userId: who.user.id, labId: lab.id, cardIndex: index, completedAt: finished ? new Date() : null },
    // Tekrar bakarken geri gitmek bitmiş eğitimi geri almaz; en ileri kart saklanır.
    update: {
      cardIndex: Math.max(index, existing?.cardIndex ?? 0),
      ...(finished && !existing?.completedAt ? { completedAt: new Date() } : {}),
    },
  });
  // Bu bitişle kazanılan rozetler oynatıcıda bildirim olarak çıkar.
  const badges = finished && !existing?.completedAt ? await awardBadges(who.user.id) : [];
  return { ok: true as const, badges };
}
