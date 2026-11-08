// Canlı nabzın verisi (CanliNabiz-Son): şu an labda olan öğrenci sayısı ve mahallelere dağılımı,
// son bir saatte biten lablar ve isimsiz akış. Hepsi veritabanında toplanır; sayfaya yalnızca
// sayılar ve hazır cümleler gider (öğrenci adı, e-postası, kimliği yok; akıştaki satırların
// anahtarı sunucu açıldığında rastgele seçilen bir anahtarla karılmış özettir).
//
// "Şu an odada": rolü öğrenci olan, son 10 dakikada sürmekte olan bir senaryo denemesini başlatan
// ya da o denemede bir şey yapan (olay), ya da bitmemiş bir eğitim labında kart ilerleten kişi.
// Bir kişi aynı anda iki labdaysa toplamda bir kez, mahallelerde her birinde sayılır.
// Yalnızca sunucuda; çağıran sayfa önce erişimi denetler (requireAdminAccess).

import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { requestTime } from "@/lib/lab/data";
import { hasLabAccess, type AdminAccess } from "./access";
import { agoLabel, minuteMs } from "./calendar";
import { getTraps, type TrapView } from "./overview";
import {
  bucketCount,
  bucketMinutes,
  feedEntry,
  feedSize,
  fillBuckets,
  liveWindowMinutes,
  type FeedKind,
  type FeedLab,
  type FeedRow,
} from "./pulse-model";

export type PulseFeedItem = {
  /** Yalnızca listedeki yerini tutmak için: kişiyle ya da kayıtla eşlenemez. */
  id: string;
  kind: FeedKind;
  text: string;
  where: string | null;
  at: string;
  ago: string;
};

export type PulseData = {
  live: number;
  neighborhoods: { name: string; color: string; count: number }[];
  hour: { finished: number; buckets: number[] };
  feed: PulseFeedItem[];
  traps: TrapView[];
};

// Akıştaki satırların anahtarı: sunucu her açılışta yeni bir anahtar seçer, özet geri çevrilemez.
const feedKey = randomBytes(16);
const feedId = (kind: string, ref: string) => createHmac("sha256", feedKey).update(`${kind}:${ref}`).digest("base64url").slice(0, 16);

type LiveRow = { neighborhoodId: string | null; count: number };

async function liveCounts(since: Date) {
  return db.$queryRaw<LiveRow[]>`
    WITH live AS (
      SELECT a."userId" AS u, a."labId" AS lab FROM "LabAttempt" a
      WHERE a."status" = 'IN_PROGRESS'
        AND (a."startedAt" >= ${since} OR EXISTS (SELECT 1 FROM "LabEvent" e WHERE e."attemptId" = a."id" AND e."createdAt" >= ${since}))
      UNION
      SELECT p."userId", p."labId" FROM "TrainingProgress" p WHERE p."completedAt" IS NULL AND p."updatedAt" >= ${since}
    ),
    students AS (
      SELECT live.u, l."neighborhoodId" AS n FROM live
      JOIN "User" s ON s."id" = live.u AND s."role" = 'STUDENT'
      JOIN "Lab" l ON l."id" = live.lab
    )
    SELECT n AS "neighborhoodId", count(DISTINCT u)::int AS count FROM students GROUP BY n
    UNION ALL
    SELECT NULL, count(DISTINCT u)::int FROM students`;
}

async function hourBuckets(from: Date) {
  return db.$queryRaw<{ b: number; n: number }[]>`
    WITH finished AS (
      SELECT "endedAt" AS t FROM "LabAttempt" WHERE "status" IN ('COMPLETED', 'HACKED') AND "endedAt" >= ${from}
      UNION ALL
      SELECT "completedAt" FROM "TrainingProgress" WHERE "completedAt" >= ${from}
    )
    SELECT floor(extract(epoch FROM (t - ${from}::timestamp)) / ${bucketMinutes * 60}::int)::int AS b, count(*)::int AS n
    FROM finished GROUP BY 1`;
}

type FeedQueryRow = FeedRow & { ref: string };

/**
 * Akış: her kaynaktan en yeni 24 hareket, sonra hepsinden en yeni feedSize. Öğrencinin
 * hareketleri (rolü öğrenci olanlar): kayıt, biten senaryo (güvende, bitti, tuzağa düştü), biten
 * eğitim, sahte öğeyi bildirme ya da sahte bağlantıya tıklama; ayrıca öğretmenlik talebi (il ·
 * ilçe) ve kazanılan rozet. Günün ipucuna bakış günle kaydedildiği için (saat yok) akışta yok.
 */
async function feedRows() {
  return db.$queryRaw<FeedQueryRow[]>`
    SELECT * FROM (
      (SELECT 'signup' AS kind, u."id" AS ref, u."createdAt" AS at, NULL::text AS "labId", NULL::text AS a, NULL::text AS b
        FROM "User" u WHERE u."role" = 'STUDENT' ORDER BY u."createdAt" DESC LIMIT 24)
      UNION ALL
      (SELECT CASE WHEN x."status" = 'HACKED' THEN 'hacked' WHEN x."resultReport"->>'status' = 'safe' THEN 'safe' ELSE 'done' END,
          x."id", x."endedAt", x."labId", NULL, NULL
        FROM "LabAttempt" x JOIN "User" u ON u."id" = x."userId" AND u."role" = 'STUDENT'
        WHERE x."status" IN ('COMPLETED', 'HACKED') AND x."endedAt" IS NOT NULL
        ORDER BY x."endedAt" DESC LIMIT 24)
      UNION ALL
      (SELECT 'training', p."userId" || ':' || p."labId", p."completedAt", p."labId", NULL, NULL
        FROM "TrainingProgress" p JOIN "User" u ON u."id" = p."userId" AND u."role" = 'STUDENT'
        WHERE p."completedAt" IS NOT NULL ORDER BY p."completedAt" DESC LIMIT 24)
      UNION ALL
      (SELECT CASE WHEN e."type" = 'link_clicked' THEN 'clicked' ELSE 'reported' END, e."id", e."createdAt", x."labId", NULL, NULL
        FROM "LabEvent" e
        JOIN "LabAttempt" x ON x."id" = e."attemptId"
        JOIN "User" u ON u."id" = x."userId" AND u."role" = 'STUDENT'
        JOIN "LabVersion" v ON v."labId" = x."labId" AND v."version" = x."labVersion"
        WHERE ((e."type" = 'item_moved' AND e."data"->>'to' = 'spam') OR e."type" = 'link_clicked')
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v."content"->'items') = 'array' THEN v."content"->'items' ELSE '[]'::jsonb END) item
            WHERE item->>'id' = e."data"->>'item' AND item->>'kind' = 'fake'
          )
        ORDER BY e."createdAt" DESC LIMIT 24)
      UNION ALL
      (SELECT 'application', t."id", t."createdAt", NULL, t."province", t."district"
        FROM "TeacherApplication" t ORDER BY t."createdAt" DESC LIMIT 24)
      UNION ALL
      (SELECT 'badge', g."userId" || ':' || g."badgeCode", g."earnedAt", NULL, g."badgeCode", NULL
        FROM "EarnedBadge" g JOIN "User" u ON u."id" = g."userId" AND u."role" = 'STUDENT'
        ORDER BY g."earnedAt" DESC LIMIT 24)
    ) feed
    ORDER BY at DESC LIMIT ${feedSize * 2}`;
}

/** Sayfanın verisi. En çok kaçırılan işaret (lab cevabı) yalnızca lab izni olana (getTraps). */
export async function getPulse(access: AdminAccess): Promise<PulseData> {
  const now = await requestTime();
  const since = new Date(now.getTime() - liveWindowMinutes * minuteMs);
  const hourFrom = new Date(now.getTime() - bucketCount * bucketMinutes * minuteMs);

  const [live, buckets, rows, neighborhoods, labs, traps] = await Promise.all([
    liveCounts(since),
    hourBuckets(hourFrom),
    feedRows(),
    db.neighborhood.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, color: true } }),
    db.$queryRaw<{ id: string; name: string; template: string; neighborhood: string }[]>`
      SELECT l."id", coalesce(nullif(btrim(l."draftContent"->'meta'->>'name'), ''), l."slug") AS name,
        l."template"::text AS template, n."name" AS neighborhood
      FROM "Lab" l JOIN "Neighborhood" n ON n."id" = l."neighborhoodId"`,
    getTraps(hasLabAccess(access)),
  ]);

  const byNeighborhood = new Map(live.map((r) => [r.neighborhoodId, r.count]));
  const labMap = new Map<string, FeedLab>(labs.map((l) => [l.id, { name: l.name, template: l.template, neighborhood: l.neighborhood }]));
  const counted = fillBuckets(buckets);

  const feed: PulseFeedItem[] = [];
  for (const row of rows) {
    const entry = feedEntry(row, labMap);
    if (!entry) continue;
    feed.push({ id: feedId(row.kind, row.ref), ...entry, at: row.at.toISOString(), ago: agoLabel(row.at, now) });
    if (feed.length === feedSize) break;
  }

  return {
    live: byNeighborhood.get(null) ?? 0,
    neighborhoods: neighborhoods.map((n) => ({ name: n.name, color: n.color, count: byNeighborhood.get(n.id) ?? 0 })),
    hour: { finished: counted.reduce((a, b) => a + b, 0), buckets: counted },
    feed,
    traps,
  };
}
