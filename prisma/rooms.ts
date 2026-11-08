// Depodaki odalar (labs/rooms/<mahalle>/<oda-adresi>.json). 27 Ekim (Murat): odanın asıl yeri
// dosyadır; oda PR'la girer, her yayında başlangıç verisi (prisma/seed.ts) dosyayı veritabanına
// yansıtır. Dosya değişmediyse odaya dokunulmaz; değiştiyse:
//
// - Oda yoksa eklenir (dosyadaki durum "PUBLISHED" ise v1 olarak yayında).
// - Oda varsa taslağı dosyadaki içerik olur (draftRevision koşuluyla, formdaki yayınla aynı kural).
//   Dosya "PUBLISHED" diyorsa ve içerik yayındakinden farklıysa yeni sürüm yayınlanır; eski
//   denemeler kendi sürümüyle kalır. Gizlenmiş oda gizli kalır. "DRAFT" dosya yayındaki odayı
//   yayından kaldırmaz, yalnızca taslağı günceller.
// - Aynı adreste formla açılmış bir oda varsa dosya onu devralır; türü, şablonu ya da mahallesi
//   farklıysa dokunulmaz, atlanır.
//
// İçeriğin şemaya uyduğunu burada değil CI'da denetleriz (tests/unit/room-files.test.ts): migration
// imajında lib/ yok, yalnızca üretilmiş Prisma istemcisi var (docker/Dockerfile). Bu yüzden dosya
// yalnızca Node'un tür silmesiyle çalışan TypeScript kullanır.
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { Prisma, PrismaClient } from "../lib/generated/prisma/client.ts";
import type { LabStatus, LabType, SceneTemplate } from "../lib/generated/prisma/enums.ts";

export type RoomFile = {
  slug: string;
  neighborhood: string;
  type: LabType;
  template: SceneTemplate;
  sortOrder: number;
  status: Extract<LabStatus, "DRAFT" | "PUBLISHED">;
  /** Senaryoyu açan ileri eğitimin adresi (aynı mahallede); yoksa temel eğitim açar. */
  unlockedBy?: string;
  content: { meta: { difficulty: "EASY" | "MEDIUM" | "HARD"; durationMin: number } };
};

export type Room = RoomFile & {
  /** Depodaki yolu (kayıtlar için), ör. labs/rooms/hesap-kalesi/x.json. */
  file: string;
  /** Dosyanın sha256 parmak izi; Lab.sourceHash ile karşılaştırılır. */
  hash: string;
};

export const roomsDir = path.join(import.meta.dirname, "..", "labs", "rooms");

/** Klasördeki oda dosyaları (mahalle klasörleri altında), adrese göre sıralı. Okunamayan atlanır. */
export async function readRooms(dir: string, log: (line: string) => void = console.error): Promise<Room[]> {
  const folders = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const rooms: Room[] = [];
  for (const folder of folders.filter((f) => f.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const files = (await readdir(path.join(dir, folder.name))).filter((f) => f.endsWith(".json")).sort();
    for (const name of files) {
      const file = path.join(dir, folder.name, name);
      const text = await readFile(file, "utf8");
      try {
        rooms.push({ ...(JSON.parse(text) as RoomFile), file: path.relative(process.cwd(), file), hash: createHash("sha256").update(text).digest("hex") });
      } catch {
        log(`Oda dosyası atlandı (${name}): JSON okunamadı.`);
      }
    }
  }
  return rooms;
}

/** Veritabanındaki odanın planlama için gereken hali. */
export type ExistingLab = {
  type: LabType;
  template: SceneTemplate;
  neighborhoodId: string;
  status: LabStatus;
  sourceHash: string | null;
  /** Yayındaki sürümün içeriği; hiç yayınlanmadıysa null. */
  published: unknown;
};

export type RoomPlan =
  | { action: "create" }
  | { action: "unchanged" }
  | { action: "skip"; reason: string }
  | { action: "update"; publish: boolean; status: LabStatus };

/** Dosya ile veritabanındaki oda karşılaştırılır; yazmadan önce ne yapılacağına karar verilir. */
export function planRoom(room: Room, neighborhoodId: string, lab: ExistingLab | null): RoomPlan {
  if (!lab) return { action: "create" };
  if (lab.sourceHash === room.hash) return { action: "unchanged" };
  if (lab.type !== room.type || lab.template !== room.template) return { action: "skip", reason: "aynı adreste türü ya da şablonu farklı bir oda var" };
  if (lab.neighborhoodId !== neighborhoodId) return { action: "skip", reason: "aynı adreste başka mahallede bir oda var" };
  if (room.status !== "PUBLISHED") return { action: "update", publish: false, status: lab.status };
  return {
    action: "update",
    publish: !isDeepStrictEqual(lab.published, room.content),
    status: lab.status === "HIDDEN" ? "HIDDEN" : "PUBLISHED",
  };
}

type Db = PrismaClient | Prisma.TransactionClient;

/** Yeni oda; örnek lablar da (labs/examples/) bununla eklenir (onlarda parmak izi yok). */
export async function createRoom(db: Db, room: RoomFile, neighborhoodId: string, sourceHash: string | null) {
  const published = room.status === "PUBLISHED";
  return db.lab.create({
    data: {
      slug: room.slug,
      neighborhoodId,
      type: room.type,
      template: room.template,
      sortOrder: room.sortOrder,
      status: room.status,
      difficulty: room.content.meta.difficulty,
      durationMin: room.content.meta.durationMin,
      draftContent: room.content,
      sourceHash,
      publishedVersion: published ? 1 : null,
      versions: published ? { create: { version: 1, content: room.content } } : undefined,
    },
    select: { id: true },
  });
}

/** Taslak bu arada formdan değişti; oda bu yayında atlanır, bir sonrakinde yeniden denenir. */
class DraftConflict extends Error {}

export type SyncResult = { created: number; updated: number; versions: number; unchanged: number; skipped: number };

/** Oda dosyalarını veritabanına yansıtır. Her oda kendi işleminde yazılır. */
export async function syncRooms(db: PrismaClient, rooms: Room[], log: (line: string) => void = console.log): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, versions: 0, unchanged: 0, skipped: 0 };
  const skip = (room: Room, reason: string) => {
    log(`Oda atlandı (${room.file}): ${reason}.`);
    result.skipped++;
  };
  const written: Room[] = [];

  for (const room of rooms) {
    const neighborhood = await db.neighborhood.findUnique({ where: { slug: room.neighborhood }, select: { id: true } });
    if (!neighborhood) {
      skip(room, "mahalle yok");
      continue;
    }
    const lab = await db.lab.findUnique({
      where: { slug: room.slug },
      select: { id: true, type: true, template: true, neighborhoodId: true, status: true, sourceHash: true, draftRevision: true, publishedVersion: true },
    });
    const version = lab?.publishedVersion
      ? await db.labVersion.findUnique({ where: { labId_version: { labId: lab.id, version: lab.publishedVersion } }, select: { content: true } })
      : null;
    const plan = planRoom(room, neighborhood.id, lab ? { ...lab, published: version?.content ?? null } : null);

    if (plan.action === "unchanged") {
      result.unchanged++;
      continue;
    }
    if (plan.action === "skip") {
      skip(room, plan.reason);
      continue;
    }
    if (plan.action === "create" || !lab) {
      await createRoom(db, room, neighborhood.id, room.hash);
      result.created++;
      written.push(room);
      continue;
    }

    try {
      await db.$transaction(async (tx) => {
        let publishedVersion = lab.publishedVersion;
        if (plan.publish) {
          const last = await tx.labVersion.aggregate({ where: { labId: lab.id }, _max: { version: true } });
          publishedVersion = (last._max.version ?? 0) + 1;
          await tx.labVersion.create({ data: { labId: lab.id, version: publishedVersion, content: room.content } });
        }
        const write = await tx.lab.updateMany({
          where: { id: lab.id, draftRevision: lab.draftRevision },
          data: {
            draftContent: room.content,
            draftRevision: { increment: 1 },
            difficulty: room.content.meta.difficulty,
            durationMin: room.content.meta.durationMin,
            sortOrder: room.sortOrder,
            status: plan.status,
            publishedVersion,
            sourceHash: room.hash,
          },
        });
        if (write.count === 0) throw new DraftConflict();
      });
    } catch (error) {
      if (!(error instanceof DraftConflict)) throw error;
      skip(room, "taslak aynı anda formdan değişti, bir sonraki yayında yeniden denenecek");
      continue;
    }
    result.updated++;
    if (plan.publish) result.versions++;
    written.push(room);
  }

  // Açan eğitim adresle bağlanır; aynı yayında eklenen eğitim de bulunsun diye en sonda.
  for (const room of written.filter((r) => r.type === "SCENARIO")) {
    const lab = await db.lab.findUniqueOrThrow({ where: { slug: room.slug }, select: { id: true, neighborhoodId: true, unlockedById: true } });
    let gate: string | null = null;
    if (room.unlockedBy) {
      const training = await db.lab.findFirst({
        where: { slug: room.unlockedBy, neighborhoodId: lab.neighborhoodId, type: "TRAINING" },
        select: { id: true },
      });
      if (training) gate = training.id;
      else log(`Açan eğitim bulunamadı (${room.file}: ${room.unlockedBy}); oda temel eğitime bağlandı.`);
    }
    if (gate !== lab.unlockedById) await db.lab.update({ where: { id: lab.id }, data: { unlockedById: gate } });
  }
  return result;
}
