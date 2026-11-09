"use server";

// Günün ipucu eylemleri. Yönetim (Ipucu-C3-Bugun): ipucu yaz ve kaydet (taslak / havuz), bir güne
// sabitle ya da otomatiğe döndür, arşive kaldır, son işlemi geri al. Her eylem TIPS iznini
// yeniden sorar ve kayıt defterine aynı işlemde yazar. Bugünün ipucu (TipDay) hiçbir eylemle
// değişmez: arşive kaldırılamaz, taslağa alınamaz; günler yarından itibaren seçilir.
//
// Geri al: her işlem kayıt defterine önceki ve sonraki hali yazar (details.changes) ve bir geri
// alma anahtarı döner. "Geri al" o kaydı sunucuda okur (yalnızca aynı kişi, kısa süre içinde) ve
// ipucu bu arada değişmediyse önceki hali yazar. Tarayıcının gönderdiği hale güvenilmez.
//
// Öğrenci: "Neden?"e basınca bugünün görülme satırında reasonViewed işaretlenir (Meraklı rozeti).

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import * as z from "@/lib/zod";
import { getPermittedAccess } from "@/lib/admin/access";
import { auditTarget, writeAudit, type AuditAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { awardBadges } from "@/lib/progress/summary";
import { rateLimit, rateRules } from "@/lib/rate-limit";
import { getUser } from "@/lib/session";
import { getTodayTip, tipToday } from "./data";
import { normalizeTipText, pinDayError, tipLimits } from "./rules";
import { dateToDay, dayToDate, isDayKey, type DayKey, type TipStatus } from "./schedule";

export type TipActionError =
  | "forbidden"
  | "rateLimited"
  | "invalid"
  | "notFound"
  | "neighborhood"
  | "lab"
  | "dayInvalid"
  | "dayPast"
  | "dayFar"
  | "dayTaken"
  | "todayLocked"
  | "notPooled"
  | "conflict"
  | "tooLate"
  | "failed";

/** Başarılıysa ipucunun kimliği ve geri alma anahtarı (değişiklik yoksa null). */
export type TipActionResult = { ok: true; id: string | null; undoKey: string | null } | { ok: false; error: TipActionError };

/** "Geri al" bildirim kutusu 5 saniye durur; sunucu biraz pay bırakır. */
const undoWindowMs = 2 * 60 * 1000;

class Refusal extends Error {
  constructor(readonly code: TipActionError) {
    super(code);
  }
}

// ---------------------------------------------------------------------------------------
// İpucunun hali (kayıt defteri ve geri al)
// ---------------------------------------------------------------------------------------

type Snapshot = { status: TipStatus; pinnedDay: DayKey | null; text: string; reason: string; neighborhoodId: string | null; labId: string | null };
type Change = { id: string; before: Snapshot | null; after: Snapshot };

const snapshotSelect = { id: true, status: true, pinnedDate: true, text: true, reason: true, neighborhoodId: true, labId: true } as const;

type SnapshotRow = Prisma.DailyTipGetPayload<{ select: typeof snapshotSelect }>;

function snapshotOf(row: SnapshotRow): Snapshot {
  return {
    status: row.status,
    pinnedDay: row.pinnedDate ? dateToDay(row.pinnedDate) : null,
    text: row.text,
    reason: row.reason,
    neighborhoodId: row.neighborhoodId,
    labId: row.labId,
  };
}

function dataOf(s: Snapshot) {
  return {
    status: s.status,
    pinnedDate: s.pinnedDay ? dayToDate(s.pinnedDay) : null,
    text: s.text,
    reason: s.reason,
    neighborhoodId: s.neighborhoodId,
    labId: s.labId,
  };
}

const same = (a: Snapshot, b: Snapshot) =>
  a.status === b.status &&
  a.pinnedDay === b.pinnedDay &&
  a.text === b.text &&
  a.reason === b.reason &&
  a.neighborhoodId === b.neighborhoodId &&
  a.labId === b.labId;

/** Kayıt defterindeki adı: yeni, havuza girdi, arşive kalktı, yalnızca günü değişti, düzenlendi. */
function actionFor(before: Snapshot | null, after: Snapshot): AuditAction {
  if (!before) return "tip.created";
  if (after.status === "ARCHIVED" && before.status !== "ARCHIVED") return "tip.archived";
  if (after.status === "POOL" && before.status !== "POOL") return "tip.pooled";
  if (before.pinnedDay !== after.pinnedDay && same({ ...before, pinnedDay: after.pinnedDay }, after)) return "tip.pinned";
  return "tip.updated";
}

const snapshotSchema = z.object({
  status: z.enum(["POOL", "DRAFT", "ARCHIVED"]),
  pinnedDay: z.string().refine(isDayKey).nullable(),
  text: z.string(),
  reason: z.string(),
  neighborhoodId: z.string().nullable(),
  labId: z.string().nullable(),
});
const changesSchema = z.array(z.object({ id: z.string(), before: snapshotSchema.nullable(), after: snapshotSchema })).min(1);

async function audit(tx: Prisma.TransactionClient, actorId: string, action: AuditAction, changes: Change[], extra: Prisma.InputJsonObject = {}) {
  const undoKey = randomUUID();
  const main = changes[changes.length - 1];
  await writeAudit(tx, {
    actorId,
    action,
    target: auditTarget.tip(main.id),
    // Kayıt defteri sayfası için ipucunun metni; geri alma için önceki ve sonraki hal.
    details: { text: main.after.text, ...extra, undoKey, changes: changes as unknown as Prisma.InputJsonArray },
  });
  return undoKey;
}

async function todayTipId(tx: Prisma.TransactionClient, today: DayKey) {
  return (await tx.tipDay.findUnique({ where: { date: dayToDate(today) }, select: { tipId: true } }))?.tipId ?? null;
}

// ---------------------------------------------------------------------------------------
// Ortak: izin, sınır, hata
// ---------------------------------------------------------------------------------------

async function teamMember() {
  const access = await getPermittedAccess("TIPS");
  if (!access) throw new Refusal("forbidden");
  const limit = await rateLimit.consume(rateRules.adminActions, access.userId);
  if (!limit.allowed) throw new Refusal("rateLimited");
  return access;
}

function failure(error: unknown, duplicate: TipActionError): TipActionResult {
  if (error instanceof Refusal) return { ok: false, error: error.code };
  // Aynı güne aynı anda iki ipucu sabitlenirse veritabanı ikincisini reddeder (pinnedDate tekil).
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, error: duplicate };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return { ok: false, error: "invalid" };
  console.error("[ipucu] işlem yapılamadı:", error instanceof Error ? error.message : error);
  return { ok: false, error: "failed" };
}

// ---------------------------------------------------------------------------------------
// Kaydet: yeni ipucu, taslak, havuza ekle, değişiklikleri kaydet
// ---------------------------------------------------------------------------------------

const tipText = (min: number, max: number) => z.string().max(max * 4).transform(normalizeTipText).pipe(z.string().min(min).max(max));

const saveSchema = z.object({
  id: z.string().min(1).max(64).nullable(),
  text: tipText(tipLimits.textMin, tipLimits.textMax),
  reason: tipText(tipLimits.reasonMin, tipLimits.reasonMax),
  neighborhoodId: z.string().min(1).max(64),
  labId: z.string().min(1).max(64).nullable(),
  /** "YYYY-AA-GG" ya da otomatik (null). */
  day: z.string().max(10).nullable(),
  status: z.enum(["POOL", "DRAFT"]),
});

export type TipInput = z.input<typeof saveSchema>;

export async function saveTip(input: TipInput): Promise<TipActionResult> {
  try {
    const access = await teamMember();
    const parsed = saveSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid" };
    const v = parsed.data;
    const today = await tipToday();

    const result = await db.$transaction(async (tx) => {
      const existing = v.id ? await tx.dailyTip.findUnique({ where: { id: v.id }, select: snapshotSelect }) : null;
      if (v.id && !existing) throw new Refusal("notFound");
      if (!(await tx.neighborhood.findUnique({ where: { id: v.neighborhoodId }, select: { id: true } }))) throw new Refusal("neighborhood");
      if (v.labId) {
        // İlgili lab yalnızca seçilen mahallenin yayındaki labı olabilir.
        const lab = await tx.lab.findUnique({ where: { id: v.labId }, select: { neighborhoodId: true, status: true, publishedVersion: true } });
        if (!lab || lab.status !== "PUBLISHED" || lab.publishedVersion === null || lab.neighborhoodId !== v.neighborhoodId) throw new Refusal("lab");
      }

      const before = existing ? snapshotOf(existing) : null;
      const isToday = !!existing && (await todayTipId(tx, today)) === existing.id;
      if (isToday && v.status !== "POOL") throw new Refusal("todayLocked");

      // Gün: bugünün ipucunun günü ve değişmeyen gün olduğu gibi kalır; yeni gün yarından itibaren.
      let pinnedDay: DayKey | null = null;
      if (before && (isToday || v.day === before.pinnedDay)) pinnedDay = before.pinnedDay;
      else if (v.day !== null) {
        const dayError = pinDayError(v.day, today);
        if (dayError) throw new Refusal(dayError);
        pinnedDay = v.day;
        const holder = await tx.dailyTip.findUnique({ where: { pinnedDate: dayToDate(v.day) }, select: { id: true } });
        if (holder && holder.id !== existing?.id) throw new Refusal("dayTaken");
      }

      const after: Snapshot = { status: v.status, pinnedDay, text: v.text, reason: v.reason, neighborhoodId: v.neighborhoodId, labId: v.labId };
      if (existing && before && same(before, after)) return { id: existing.id, undoKey: null };

      const id = existing
        ? (await tx.dailyTip.update({ where: { id: existing.id }, data: dataOf(after), select: { id: true } })).id
        : (await tx.dailyTip.create({ data: { ...dataOf(after), authorId: access.userId }, select: { id: true } })).id;
      const undoKey = await audit(tx, access.userId, actionFor(before, after), [{ id, before, after }]);
      return { id, undoKey };
    });
    refresh();
    return { ok: true, ...result };
  } catch (error) {
    return failure(error, "dayTaken");
  }
}

// ---------------------------------------------------------------------------------------
// Sıradaki günler: bir güne ipucu seç ya da otomatiğe döndür
// ---------------------------------------------------------------------------------------

/** Günü bu ipucuna sabitler (ipucunun önceki günü boşalır); tipId null ise gün otomatik olur. */
export async function pinTipDay(day: string, tipId: string | null): Promise<TipActionResult> {
  try {
    const access = await teamMember();
    if (tipId !== null && (typeof tipId !== "string" || tipId.length === 0 || tipId.length > 64)) return { ok: false, error: "invalid" };
    const today = await tipToday();
    const dayError = pinDayError(day, today);
    if (dayError) return { ok: false, error: dayError };

    const result = await db.$transaction(async (tx) => {
      const holder = await tx.dailyTip.findUnique({ where: { pinnedDate: dayToDate(day) }, select: snapshotSelect });
      if (holder?.id === tipId || (!holder && tipId === null)) return { id: tipId, undoKey: null };

      const changes: Change[] = [];
      if (holder) {
        const before = snapshotOf(holder);
        changes.push({ id: holder.id, before, after: { ...before, pinnedDay: null } });
        await tx.dailyTip.update({ where: { id: holder.id }, data: { pinnedDate: null } });
      }
      if (tipId !== null) {
        const tip = await tx.dailyTip.findUnique({ where: { id: tipId }, select: snapshotSelect });
        if (!tip) throw new Refusal("notFound");
        if (tip.status !== "POOL") throw new Refusal("notPooled");
        const before = snapshotOf(tip);
        changes.push({ id: tip.id, before, after: { ...before, pinnedDay: day } });
        await tx.dailyTip.update({ where: { id: tip.id }, data: { pinnedDate: dayToDate(day) } });
      }
      const undoKey = await audit(tx, access.userId, "tip.pinned", changes, { day, auto: tipId === null });
      return { id: tipId, undoKey };
    });
    refresh();
    return { ok: true, ...result };
  } catch (error) {
    return failure(error, "dayTaken");
  }
}

// ---------------------------------------------------------------------------------------
// Arşive kaldır
// ---------------------------------------------------------------------------------------

export async function archiveTip(id: string): Promise<TipActionResult> {
  try {
    const access = await teamMember();
    if (typeof id !== "string" || id.length === 0 || id.length > 64) return { ok: false, error: "invalid" };
    const today = await tipToday();

    const result = await db.$transaction(async (tx) => {
      const tip = await tx.dailyTip.findUnique({ where: { id }, select: snapshotSelect });
      if (!tip) throw new Refusal("notFound");
      if (tip.status === "ARCHIVED") return { id, undoKey: null };
      if ((await todayTipId(tx, today)) === id) throw new Refusal("todayLocked");
      const before = snapshotOf(tip);
      // Arşivdeki ipucunun sabit günü boşalır; sıradaki günler yeniden dağılır.
      const after: Snapshot = { ...before, status: "ARCHIVED", pinnedDay: null };
      await tx.dailyTip.update({ where: { id }, data: dataOf(after) });
      const undoKey = await audit(tx, access.userId, "tip.archived", [{ id, before, after }]);
      return { id, undoKey };
    });
    refresh();
    return { ok: true, ...result };
  } catch (error) {
    return failure(error, "conflict");
  }
}

// ---------------------------------------------------------------------------------------
// Geri al
// ---------------------------------------------------------------------------------------

export async function undoTipChange(undoKey: string): Promise<TipActionResult> {
  try {
    const access = await teamMember();
    if (typeof undoKey !== "string" || undoKey.length === 0 || undoKey.length > 64) return { ok: false, error: "invalid" };
    const entry = await db.auditLog.findFirst({
      where: { actorId: access.userId, target: { startsWith: "tip:" }, details: { path: ["undoKey"], equals: undoKey } },
      select: { id: true, createdAt: true, details: true },
    });
    if (!entry) return { ok: false, error: "notFound" };
    if (Date.now() - entry.createdAt.getTime() > undoWindowMs) return { ok: false, error: "tooLate" };
    const parsed = changesSchema.safeParse((entry.details as { changes?: unknown } | null)?.changes);
    if (!parsed.success) return { ok: false, error: "invalid" };
    const changes = parsed.data;
    const today = await tipToday();

    const result = await db.$transaction(async (tx) => {
      const todayId = await todayTipId(tx, today);
      // Önce ipucunun hâlâ işlemden sonraki halde olduğu denetlenir ve sabit günler boşaltılır
      // (iki ipucu günlerini değiştirdiyse tekil gün çakışmasın).
      for (const c of changes) {
        const { count } = await tx.dailyTip.updateMany({ where: { id: c.id, ...dataOf(c.after) }, data: { pinnedDate: null } });
        if (count !== 1) throw new Refusal("conflict");
      }
      const reverted: Change[] = [];
      for (const c of changes) {
        if (c.before === null) {
          // Yeni yazılan ipucu silinir; bu arada bir gün gösterildiyse artık silinemez.
          if (c.id === todayId || (await tx.tipDay.count({ where: { tipId: c.id } })) > 0) throw new Refusal("tooLate");
          await tx.dailyTip.delete({ where: { id: c.id } });
          continue;
        }
        if (c.id === todayId && c.before.status !== "POOL") throw new Refusal("todayLocked");
        await tx.dailyTip.update({ where: { id: c.id }, data: dataOf(c.before) });
        reverted.push({ id: c.id, before: c.after, after: c.before });
      }
      const main = changes[changes.length - 1];
      const action = main.before ? actionFor(main.after, main.before) : "tip.updated";
      await writeAudit(tx, {
        actorId: access.userId,
        action,
        target: auditTarget.tip(main.id),
        details: { text: main.before?.text ?? main.after.text, undo: true, of: entry.id, deleted: main.before === null, changes: reverted as unknown as Prisma.InputJsonArray },
      });
      return { id: main.before ? main.id : null, undoKey: null };
    });
    refresh();
    return { ok: true, ...result };
  } catch (error) {
    return failure(error, "conflict");
  }
}

// ---------------------------------------------------------------------------------------
// Öğrenci: "Neden?"
// ---------------------------------------------------------------------------------------

export type ReasonResult = { ok: boolean };

/**
 * Öğrenci bugünün ipucunda "Neden?"e bastı. Yalnızca bugünün ipucu için, günde bir kez yazılır
 * (sonraki basışlar hiçbir şey değiştirmez). İlk kez yazılınca rozetler yeniden hesaplanır
 * (Meraklı: 7 farklı gün).
 */
export async function markTipReason(tipId: string): Promise<ReasonResult> {
  const user = await getUser();
  if (!user || typeof tipId !== "string" || tipId.length === 0 || tipId.length > 64) return { ok: false };
  const limit = await rateLimit.consume(rateRules.labActions, user.id);
  if (!limit.allowed) return { ok: false };
  const today = await getTodayTip();
  if (!today || today.id !== tipId) return { ok: false };

  const changed = await db.$executeRaw`
    INSERT INTO "TipView" ("userId", "tipId", "date", "reasonViewed")
    VALUES (${user.id}, ${tipId}, ${today.date}::date, true)
    ON CONFLICT ("userId", "tipId", "date") DO UPDATE SET "reasonViewed" = true
    WHERE "TipView"."reasonViewed" = false`;
  if (changed > 0) {
    await awardBadges(user.id);
    refresh();
  }
  return { ok: true };
}
