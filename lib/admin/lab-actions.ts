"use server";

// Yönetimdeki lab işlemleri: yeni taslak, taslağı kaydetme, yayınlama (ve hemen geri alma),
// gizleme / yeniden yayınlama, sıra değiştirme, senaryoyu açan eğitimi değiştirme. Her eylem erişimi yeniden denetler; düzenlemek
// LAB_EDITING, yayın ve sıra LAB_PUBLISHING ister (yönetici ikisini de yapar). Her değişiklik
// kayıt defterine (AuditLog) yazılır; kayıt defteri silinmez ve düzenlenmez. Yazma işlemleri kişi
// başına istek sınırına tabidir (ipucu ve gündemle ortak sayaç).
//
// Sayfalar yalnızca React cache ile okur (sunucuda saklanan önbellek yok); refresh() açık
// sayfayı yeniler, öğrenci sayfaları bir sonraki açılışta yeni hali görür.

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "@/lib/zod";
import { auditTarget, writeAudit, type AuditAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { templates, type LabContent } from "@/lib/lab/content";
import { basicTrainingOf, gateOf, type GateLab } from "@/lib/lab/gates";
import { paths } from "@/lib/navigation";
import { rateLimit, rateRules } from "@/lib/rate-limit";
import { getLabAccess, type AdminAccess } from "./access";
import { emptyContent, exampleContent } from "./drafts";
import { countInProgress, isPublishable, readContent, sameContent } from "./lab-data";
import { slugify, uniqueSlug } from "./slug";
import { draftIssues, validateContent } from "./validate";

type Need = "edit" | "publish";

async function allowed(need: Need): Promise<AdminAccess | null> {
  const access = await getLabAccess();
  if (!access) return null;
  return (need === "edit" ? access.canEdit : access.canPublish) ? access : null;
}

/**
 * Yazma işlemlerinin kapısı: izin, sonra kişi başına istek sınırı (lib/rate-limit.ts,
 * adminActions; her işlem silinmeyen kayıt defterine yazar). İzni olmayanın denemesi sayılmaz.
 */
async function writer(need: Need): Promise<{ access: AdminAccess } | { error: "forbidden" | "rateLimited" }> {
  const access = await allowed(need);
  if (!access) return { error: "forbidden" };
  const limit = await rateLimit.consume(rateRules.adminActions, access.userId);
  return limit.allowed ? { access } : { error: "rateLimited" };
}

/** Lab işleminin kaydı (lib/audit.ts), işlemle aynı veritabanı işleminde. */
const audit = (tx: Prisma.TransactionClient, actorId: string, action: AuditAction, labId: string, details: Prisma.InputJsonObject) =>
  writeAudit(tx, { actorId, action, target: auditTarget.lab(labId), details });

/** Kapaktaki zorluk ve süre, listelerde ve öğrenci kartlarında okunan sütunlara da yazılır. */
const columnsFrom = (content: LabContent) => ({ difficulty: content.meta.difficulty, durationMin: content.meta.durationMin });

export type ActionError =
  | "forbidden"
  | "notFound"
  | "invalid"
  | "notReady"
  | "unchanged"
  | "conflict"
  | "unreadable"
  | "notPublished"
  | "trainingFixed"
  | "tooLate"
  | "rateLimited"
  | "failed";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: ActionError; issues?: string[] };

// ---------------------------------------------------------------------------------------
// Yeni lab
// ---------------------------------------------------------------------------------------

export type CreateLabState = {
  error?: "forbidden" | "rateLimited" | "name" | "neighborhood" | "template" | "gate" | "failed";
  values?: { neighborhood: string; template: string; name: string; example: boolean; gate: string };
};

const createSchema = z.object({
  neighborhood: z.string().min(1).max(64),
  template: z.enum(templates),
  name: z.string().trim().min(4).max(80),
  example: z.boolean(),
  // Senaryoyu açan eğitimin kimliği; boşsa mahallenin temel eğitimi.
  gate: z.string().max(64),
});

export async function createLab(_prev: CreateLabState, form: FormData): Promise<CreateLabState> {
  const values = {
    neighborhood: String(form.get("neighborhood") ?? ""),
    template: String(form.get("template") ?? ""),
    name: String(form.get("name") ?? ""),
    example: form.get("example") === "on",
    gate: String(form.get("gate") ?? ""),
  };
  const gate = await writer("edit");
  if ("error" in gate) return { error: gate.error, values };
  const { access } = gate;

  const parsed = createSchema.safeParse(values);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: field === "name" ? "name" : field === "template" ? "template" : field === "gate" ? "gate" : "neighborhood", values };
  }
  const { template, name, example } = parsed.data;
  const neighborhood = await db.neighborhood.findUnique({ where: { slug: parsed.data.neighborhood }, select: { id: true } });
  if (!neighborhood) return { error: "neighborhood", values };

  const type = template === "TRAINING" ? "TRAINING" : "SCENARIO";
  // Açan eğitim aynı mahallenin eğitim odası olmalı (taslak olabilir).
  const gateId = type === "SCENARIO" && parsed.data.gate ? parsed.data.gate : null;
  if (gateId && !(await db.lab.findFirst({ where: { id: gateId, neighborhoodId: neighborhood.id, type: "TRAINING" }, select: { id: true } }))) {
    return { error: "gate", values };
  }
  const content = example ? exampleContent(template, name) : emptyContent(template, name);
  const base = slugify(name);

  let labId: string | null = null;
  // Aynı anda aynı adla iki taslak açılırsa ikinci deneme yeni bir adres alır. Yeni lab kendi
  // türünün sonuna eklenir: ilk eğitim temel eğitim olur, sonrakiler ileri eğitim (lib/lab/gates.ts).
  for (let attempt = 0; attempt < 3 && !labId; attempt++) {
    try {
      labId = await db.$transaction(async (tx) => {
        // Mahallenin satırı kilitlenir: aynı anda açılan iki eğitim aynı sırayı alıp ikisi de
        // "temel eğitim" olamasın.
        await tx.$queryRaw`SELECT "id" FROM "Neighborhood" WHERE "id" = ${neighborhood.id} FOR UPDATE`;
        const taken = await tx.lab.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
        const last = await tx.lab.aggregate({
          where: { neighborhoodId: neighborhood.id, type },
          _max: { sortOrder: true },
        });
        const lab = await tx.lab.create({
          data: {
            slug: uniqueSlug(base, taken.map((t) => t.slug)),
            neighborhoodId: neighborhood.id,
            type,
            template,
            sortOrder: last._max.sortOrder === null ? (type === "TRAINING" ? 0 : 1) : last._max.sortOrder + 1,
            unlockedById: gateId,
            status: "DRAFT",
            ...columnsFrom(content),
            draftContent: content as Prisma.InputJsonObject,
            updatedById: access.userId,
          },
          select: { id: true, slug: true },
        });
        await audit(tx, access.userId, "lab.create", lab.id, { slug: lab.slug, template, example });
        return lab.id;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      console.error("[yönetim] lab oluşturulamadı:", error instanceof Error ? error.message : error);
      return { error: "failed", values };
    }
  }
  if (!labId) return { error: "failed", values };
  redirect(paths.adminLab(labId));
}

// ---------------------------------------------------------------------------------------
// Taslağı kaydetme ve yayınlama
// ---------------------------------------------------------------------------------------

async function loadLab(labId: string) {
  if (typeof labId !== "string" || labId.length > 64) return null;
  return db.lab.findUnique({
    where: { id: labId },
    select: { id: true, slug: true, type: true, template: true, status: true, publishedVersion: true, draftContent: true, draftRevision: true },
  });
}

/** Tarayıcıdan gelen taslak sürümü; tam sayı değilse (eski sayfa ya da elle çağrı) hiçbir sürümle eşleşmez. */
const asRevision = (value: unknown): number | null => (Number.isSafeInteger(value) ? (value as number) : null);

/** Taslak, formun bildiği sürümden sonra değişti: işlem geri alınır, "conflict" döner. */
class DraftConflict extends Error {}

/**
 * Labı yalnızca taslağı hâlâ `expected` sürümündeyse günceller (güvenlik turu 2, D9). Denetim ve
 * yazım tek bir UPDATE'tir: aynı sürümle aynı anda gelen iki istekten yalnızca biri yazar.
 * `bump`: taslağın içeriği yazılıyorsa sürüm bir artar. Dönen değer taslağın yeni sürümü.
 */
async function writeIfRevision(
  tx: Prisma.TransactionClient,
  labId: string,
  expected: number,
  data: Prisma.LabUncheckedUpdateManyInput,
  bump: boolean,
): Promise<number> {
  const result = await tx.lab.updateMany({
    where: { id: labId, draftRevision: expected },
    data: { ...data, ...(bump ? { draftRevision: { increment: 1 } } : {}) },
  });
  if (result.count === 0) throw new DraftConflict();
  return bump ? expected + 1 : expected;
}

/**
 * Taslağı kaydeder; öğrenciler yayındaki sürümü görmeye devam eder. `revision` formun açıldığı
 * (ya da son kaydedildiği) andaki taslağın sürümü: arada başka biri taslağı değiştirdiyse
 * "conflict" döner. `force` ("Benimkiyle üstüne yaz") taslağın şu anki sürümünün üstüne yazar.
 * Okunamayan (şemaya uymayan) taslağın üstüne hiç yazılmaz: "unreadable" (D8).
 */
export async function saveLabDraft(
  labId: string,
  input: unknown,
  revision: number,
  force = false,
): Promise<ActionResult<{ revision: number }>> {
  const gate = await writer("edit");
  if ("error" in gate) return { ok: false, error: gate.error };
  const { access } = gate;
  const lab = await loadLab(labId);
  if (!lab) return { ok: false, error: "notFound" };
  if (draftIssues(lab.template, lab.draftContent)) return { ok: false, error: "unreadable" };
  const check = validateContent(lab.template, input);
  if (!check.ok) return { ok: false, error: "invalid", issues: check.issues };
  // Üstüne yazmada da koşul az önce okunan (ve okunabildiği denetlenen) sürümdür.
  const expected = force === true ? lab.draftRevision : asRevision(revision);
  if (expected !== lab.draftRevision) return { ok: false, error: "conflict" };

  try {
    const next = await db.$transaction(async (tx) => {
      const next = await writeIfRevision(
        tx,
        lab.id,
        expected,
        {
          draftContent: check.content as Prisma.InputJsonObject,
          updatedById: access.userId,
          // Hiç yayınlanmamış labın sütunları öğrenciye görünmez; yayındakiler yayınlanınca değişir.
          ...(lab.publishedVersion === null ? columnsFrom(check.content) : {}),
        },
        true,
      );
      await audit(tx, access.userId, "lab.save_draft", lab.id, { slug: lab.slug });
      return next;
    });
    refresh();
    return { ok: true, revision: next };
  } catch (error) {
    if (error instanceof DraftConflict) return { ok: false, error: "conflict" };
    console.error("[yönetim] taslak kaydedilemedi:", error instanceof Error ? error.message : error);
    return { ok: false, error: "failed" };
  }
}

/**
 * Taslağı yeni sürüm olarak yayınlar (sürüm numarası bir artar). `revision` yayınlayanın gördüğü
 * taslağın sürümüdür: listedeki "Yayınla" da gönderir; taslak bu arada değiştiyse yayınlamaz
 * ("conflict"), çünkü yayınlanacak hali kimse görmedi (D9). Formdaki içerik verilirse
 * (kaydedilmemiş değişiklikler) önce o yazılır; `force` taslağın şu anki sürümünün üstüne yazar.
 * Yayına hazır değilse, taslak okunamıyorsa ya da yayındaki sürümle aynıysa yayınlamaz. Labın
 * ortasındaki öğrenciler başladıkları sürümle bitirir.
 */
export async function publishLab(
  labId: string,
  form: { content?: unknown; revision: number; force?: boolean },
): Promise<ActionResult<{ version: number; revision: number }>> {
  const gate = await writer("publish");
  if ("error" in gate) return { ok: false, error: gate.error };
  const { access } = gate;
  // Eylem tarayıcıdan her türlü değerle çağrılabilir.
  const options: { content?: unknown; revision?: unknown; force?: unknown } = typeof form === "object" && form !== null ? form : {};
  const withContent = options.content !== undefined;
  if (withContent && !access.canEdit) return { ok: false, error: "forbidden" };
  const lab = await loadLab(labId);
  if (!lab) return { ok: false, error: "notFound" };
  if (draftIssues(lab.template, lab.draftContent)) return { ok: false, error: "unreadable" };

  const check = validateContent(lab.template, withContent ? options.content : lab.draftContent);
  if (!check.ok) return withContent ? { ok: false, error: "invalid", issues: check.issues } : { ok: false, error: "notReady" };
  const content = check.content;
  const expected = options.force === true ? lab.draftRevision : asRevision(options.revision);
  if (expected !== lab.draftRevision) return { ok: false, error: "conflict" };
  if (!isPublishable(lab.template, content)) return { ok: false, error: "notReady" };

  try {
    const published = await db.$transaction(async (tx) => {
      const current = lab.publishedVersion
        ? await tx.labVersion.findUnique({ where: { labId_version: { labId: lab.id, version: lab.publishedVersion } }, select: { content: true } })
        : null;
      // Yayındakiyle aynı içerik yeni sürüm olmaz (gizli lab "Yayınla" düğmesiyle geri açılır).
      if (current && sameContent(readContent(lab.template, current.content, ""), content)) {
        return null;
      }
      const last = await tx.labVersion.aggregate({ where: { labId: lab.id }, _max: { version: true } });
      const next = (last._max.version ?? 0) + 1;
      await tx.labVersion.create({
        data: { labId: lab.id, version: next, content: content as Prisma.InputJsonObject, publishedById: access.userId },
      });
      // Listeden yayında taslak olduğu gibi kalır (sürümü değişmez); formdan yayında formdaki hali yazılır.
      const revision = await writeIfRevision(
        tx,
        lab.id,
        expected,
        {
          ...(withContent ? { draftContent: content as Prisma.InputJsonObject } : {}),
          publishedVersion: next,
          status: "PUBLISHED",
          updatedById: access.userId,
          ...columnsFrom(content),
        },
        withContent,
      );
      await audit(tx, access.userId, "lab.publish", lab.id, {
        slug: lab.slug,
        version: next,
        previousVersion: lab.publishedVersion,
        previousStatus: lab.status,
      });
      return { version: next, revision };
    });
    if (published === null) return { ok: false, error: "unchanged" };
    refresh();
    return { ok: true, ...published };
  } catch (error) {
    if (error instanceof DraftConflict) return { ok: false, error: "conflict" };
    // Aynı anda iki yayın: ikincisi aynı sürüm numarasını alamaz.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, error: "conflict" };
    console.error("[yönetim] lab yayınlanamadı:", error instanceof Error ? error.message : error);
    return { ok: false, error: "failed" };
  }
}

/**
 * Yayınlamadan hemen sonra "Geri al" (bildirim kutusundaki 5 saniye): sürüm silinir, önceki
 * yayın hali döner. Taslak olduğu gibi kalır. Bu arada bir öğrenci yeni sürümle başladıysa
 * geri alınamaz.
 */
export async function undoPublish(labId: string, version: number): Promise<ActionResult> {
  const gate = await writer("publish");
  if ("error" in gate) return { ok: false, error: gate.error };
  const { access } = gate;
  const lab = await loadLab(labId);
  if (!lab) return { ok: false, error: "notFound" };
  if (!Number.isInteger(version) || lab.publishedVersion !== version) return { ok: false, error: "tooLate" };

  // Önceki hal istemciden değil, yayının kayıt defteri satırından okunur.
  const log = await db.auditLog.findFirst({
    where: { action: "lab.publish", target: auditTarget.lab(lab.id), createdAt: { gte: new Date(Date.now() - 2 * 60_000) } },
    orderBy: { createdAt: "desc" },
    select: { details: true },
  });
  const details = (log?.details ?? null) as { version?: number; previousVersion?: number | null; previousStatus?: string } | null;
  if (!details || details.version !== version) return { ok: false, error: "tooLate" };
  const previousVersion = typeof details.previousVersion === "number" ? details.previousVersion : null;
  const previousStatus = previousVersion === null ? "DRAFT" : details.previousStatus === "HIDDEN" ? "HIDDEN" : "PUBLISHED";

  try {
    const undone = await db.$transaction(async (tx) => {
      if ((await tx.labAttempt.count({ where: { labId: lab.id, labVersion: version } })) > 0) return false;
      const previous = previousVersion
        ? await tx.labVersion.findUnique({ where: { labId_version: { labId: lab.id, version: previousVersion } }, select: { content: true } })
        : null;
      await tx.lab.update({
        where: { id: lab.id },
        data: {
          publishedVersion: previousVersion,
          status: previousStatus,
          updatedById: access.userId,
          ...(previous ? columnsFrom(readContent(lab.template, previous.content, lab.slug)) : {}),
        },
      });
      await tx.labVersion.delete({ where: { labId_version: { labId: lab.id, version } } });
      await audit(tx, access.userId, "lab.unpublish", lab.id, { slug: lab.slug, version, restoredVersion: previousVersion });
      return true;
    });
    if (!undone) return { ok: false, error: "tooLate" };
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("[yönetim] yayın geri alınamadı:", error instanceof Error ? error.message : error);
    return { ok: false, error: "failed" };
  }
}

// ---------------------------------------------------------------------------------------
// Gizleme ve sıra
// ---------------------------------------------------------------------------------------

/**
 * Yayındaki senaryo labını gizler (haritadan kalkar, ilerlemeler silinmez) ya da gizli labı
 * yeniden yayına alır. Eğitim labı gizlenmez: mahallenin senaryoları ona bağlıdır.
 */
export async function setLabVisibility(labId: string, visible: boolean, note = ""): Promise<ActionResult> {
  // Eylem tarayıcıdan her türlü değerle çağrılabilir: yalnızca gerçek true yayına alır.
  const show = visible === true;
  const gate = await writer("publish");
  if ("error" in gate) return { ok: false, error: gate.error };
  const { access } = gate;
  const lab = await loadLab(labId);
  if (!lab) return { ok: false, error: "notFound" };
  // Eski bir kayıtta gizli kalmış eğitim labı yeniden açılabilir; gizlenemez.
  if (lab.type === "TRAINING" && !show) return { ok: false, error: "trainingFixed" };
  if (lab.publishedVersion === null) return { ok: false, error: "notPublished" };
  const cleanNote = typeof note === "string" ? note.trim().slice(0, 200) : "";

  const from = show ? "HIDDEN" : "PUBLISHED";
  const changed = await db.$transaction(async (tx) => {
    const result = await tx.lab.updateMany({
      where: { id: lab.id, status: from },
      data: { status: show ? "PUBLISHED" : "HIDDEN", updatedById: access.userId },
    });
    if (result.count === 0) return false;
    await audit(tx, access.userId, show ? "lab.unhide" : "lab.hide", lab.id, show ? { slug: lab.slug } : { slug: lab.slug, note: cleanNote });
    return true;
  });
  refresh();
  return changed ? { ok: true } : { ok: false, error: "unchanged" };
}

const gateFields = { id: true, slug: true, neighborhoodId: true, type: true, sortOrder: true, unlockedById: true } as const;

/** Mahallenin bütün labları (taslaklar dahil), sıralı; yönetimde açan eğitim bunlarla hesaplanır. */
const neighborhoodLabs = (tx: Prisma.TransactionClient, neighborhoodId: string) =>
  tx.lab.findMany({ where: { neighborhoodId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: gateFields });

/**
 * Labı kendi grubunda bir sıra yukarı (-1) ya da aşağı (1) taşır: senaryo, aynı eğitimin açtığı
 * senaryolar arasında; ileri eğitim, ileri eğitimler arasında. Temel eğitim hep ilk (taşınmaz).
 */
export async function moveLab(labId: string, direction: -1 | 1): Promise<ActionResult<{ position: number }>> {
  const gate = await writer("publish");
  if ("error" in gate) return { ok: false, error: gate.error };
  const { access } = gate;
  if (direction !== -1 && direction !== 1) return { ok: false, error: "invalid" };
  const lab = await db.lab.findUnique({ where: { id: String(labId) }, select: gateFields });
  if (!lab) return { ok: false, error: "notFound" };

  const position = await db.$transaction(async (tx) => {
    const labs = await neighborhoodLabs(tx, lab.neighborhoodId);
    const basic = basicTrainingOf(labs, lab.neighborhoodId);
    const current = labs.find((l) => l.id === lab.id);
    if (!current || current.id === basic?.id) return "fixed" as const;
    const group = (l: GateLab) => (l.type === "TRAINING" ? "advanced" : `scenario:${gateOf(l, labs)?.id ?? ""}`);
    const siblings = labs.filter((l) => l.id !== basic?.id && group(l) === group(current));
    const from = siblings.findIndex((s) => s.id === lab.id);
    const to = from + direction;
    if (to < 0 || to >= siblings.length) return null;
    const order = siblings.map((s) => s.id);
    [order[from], order[to]] = [order[to], order[from]];
    // Grubun sırası yeniden yazılır (eşit sıralar da düzelir); ileri eğitimler temelden sonra gelir.
    const first = current.type === "TRAINING" ? (basic?.sortOrder ?? 0) + 1 : 1;
    for (const [index, id] of order.entries()) {
      if (siblings.find((s) => s.id === id)!.sortOrder !== first + index) {
        await tx.lab.update({ where: { id }, data: { sortOrder: first + index } });
      }
    }
    await audit(tx, access.userId, "lab.reorder", lab.id, { slug: lab.slug, from: from + 1, to: to + 1 });
    return to + 1;
  });
  if (position === "fixed") return { ok: false, error: "trainingFixed" };
  if (position === null) return { ok: false, error: "unchanged" };
  refresh();
  return { ok: true, position };
}

/**
 * Senaryo labını açan eğitimi değiştirir (boş: mahallenin temel eğitimi). Eğitim aynı mahallenin
 * eğitim odası olmalı. Yayından bağımsızdır, hemen geçerli olur: öğrencinin haritasında oda o
 * eğitimin altına geçer, kilidi o eğitime bağlanır; bitmiş denemeler ve puanlar kalır.
 */
export async function setLabGate(labId: string, trainingId: string): Promise<ActionResult<{ gate: string | null }>> {
  const gate = await writer("publish");
  if ("error" in gate) return { ok: false, error: gate.error };
  const { access } = gate;
  const lab = await db.lab.findUnique({ where: { id: String(labId) }, select: gateFields });
  if (!lab) return { ok: false, error: "notFound" };
  if (lab.type !== "SCENARIO") return { ok: false, error: "invalid" };
  const target = typeof trainingId === "string" && trainingId ? trainingId : null;

  const changed = await db.$transaction(async (tx) => {
    const labs = await neighborhoodLabs(tx, lab.neighborhoodId);
    const training = target ? labs.find((l) => l.id === target && l.type === "TRAINING") : null;
    if (target && !training) return "invalid" as const;
    // Temel eğitim seçildiyse boş yazılır: temel eğitim değişirse oda yeni temele bağlı kalır.
    const value = training && training.id !== basicTrainingOf(labs, lab.neighborhoodId)?.id ? training.id : null;
    if (value === lab.unlockedById) return "unchanged" as const;
    await tx.lab.update({ where: { id: lab.id }, data: { unlockedById: value } });
    const name = value ? await gateName(tx, value) : null;
    await audit(tx, access.userId, "lab.gate_changed", lab.id, { slug: lab.slug, gate: name });
    return { gate: value };
  });
  if (changed === "invalid") return { ok: false, error: "invalid" };
  if (changed === "unchanged") return { ok: false, error: "unchanged" };
  refresh();
  return { ok: true, ...changed };
}

/** Eğitimin adı (taslağından; okunamazsa adresi) kayıt defteri cümlesi için. */
async function gateName(tx: Prisma.TransactionClient, id: string) {
  const row = await tx.lab.findUnique({ where: { id }, select: { slug: true, template: true, draftContent: true } });
  return row ? readContent(row.template, row.draftContent, row.slug).meta.name || row.slug : null;
}

/** Yayınlama penceresi için: şu an labın ortasında olan öğrenci sayısı (isim yok). */
export async function labInProgress(labId: string): Promise<number> {
  const access = await allowed("publish");
  if (!access) return 0;
  return countInProgress(String(labId));
}

