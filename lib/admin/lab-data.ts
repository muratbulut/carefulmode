// Yönetimdeki lab listesi ve lab düzenleme sayfasının verisi (Lablar-Son, Lab-Duzenle-Son).
// Öğrenci adı yoktur; yalnızca toplam sayılar (bitiren, tuzağı fark eden, ortasında olan).
// Yalnızca sunucuda; çağıran sayfa önce erişimi denetler (lib/admin/access.ts).

import { cache } from "react";
import { db } from "@/lib/db";
import type { Difficulty, LabStatus, LabType, SceneTemplate } from "@/lib/generated/prisma/enums";
import { schemaFor, type LabContent, type Template } from "@/lib/lab/content";
import { getCompletionCounts, getNeighborhoods, getNoticeCounts, labCode, type NeighborhoodRow, type NoticeCounts } from "@/lib/lab/data";
import { basicTrainingOf, gateOf, routeOrder, type GateLab } from "@/lib/lab/gates";
import { isPublishable, sameContent } from "./compare";
import { emptyContent } from "./drafts";
import { draftIssues } from "./validate";

export { isPublishable, sameContent };

/**
 * Veritabanındaki içeriği okur; biçimi bozuksa ya da boşsa verilen adla boş taslak. Yalnızca
 * gösterim ve sayım için: bozuk taslağın üstüne yazmamak için önce draftIssues'a bakılır.
 */
export function readContent(template: Template, json: unknown, fallbackName: string): LabContent {
  const parsed = schemaFor(template).safeParse(json);
  if (parsed.success) return parsed.data;
  return emptyContent(template, fallbackName);
}

// ---------------------------------------------------------------------------------------
// Lab listesi
// ---------------------------------------------------------------------------------------

export type AdminLabRow = {
  id: string;
  slug: string;
  code: string;
  name: string;
  type: LabType;
  template: SceneTemplate;
  status: LabStatus;
  difficulty: Difficulty;
  durationMin: number;
  cardCount: number;
  publishedVersion: number | null;
  /** Taslak yayındaki sürümden farklı mı. */
  unpublishedChanges: boolean;
  /** Kaydedilmiş taslak şemaya uymuyor (okunamadı); düzenleme sayfası uyarır, yayınlanmaz. */
  unreadable: boolean;
  /** Taslağın sürümü: listedeki "Yayınla" yalnızca bu sürüm hâlâ geçerliyse yayınlar. */
  revision: number;
  /** Taslak yayına hazır mı (listedeki "Yayınla" düğmesi için). */
  ready: boolean;
  finished: number;
  /**
   * Tuzağı fark eden öğrencilerin yüzdesi (raporu "Güvende kaldın"); her öğrenci bir kez, ilk ve son
   * biten denemesiyle. Senaryo labında ve en az bir öğrenci bitirdiyse.
   */
  noticed: { first: number; last: number } | null;
  /** Şu an labın ortasında olan öğrenci sayısı (gizleme ve yayınlama uyarısı). */
  inProgress: number;
  /** Labı ödevinde tutan açık ödev sayısı (sınıf sayısı). */
  assignedClasses: number;
  /** Gizlenmişse gizleyenin notu (sadece yönetim görür). */
  hideNote: string | null;
  /** Temel eğitim mi (mahallenin ilk eğitimi; taşınmaz). */
  basic: boolean;
  /**
   * Sıra okları bu grubun içinde taşır: ileri eğitimler kendi aralarında, senaryolar aynı eğitimin
   * açtığı senaryolar arasında (lib/admin/lab-actions.ts moveLab). Temel eğitimde null.
   */
  group: string | null;
  /** Senaryoyu açan eğitimin adı (taslaklar dahil hesaplanır); eğitimde null. */
  gateName: string | null;
};

export type AdminNeighborhood = NeighborhoodRow & {
  labs: AdminLabRow[];
  /** Eğitim ve senaryo odaları birlikte ("2 / 2 oda yayında"); öğrencinin ekranlarıyla aynı sayım. */
  labCount: number;
  publishedLabs: number;
  drafts: number;
  hidden: number;
  finished: number;
};

/** Labların ortasındaki öğrenci sayısı: yarım senaryo denemesi ya da bitmemiş eğitim. */
async function inProgressCounts(labIds: string[]) {
  if (labIds.length === 0) return new Map<string, number>();
  const [attempts, training] = await Promise.all([
    db.labAttempt.groupBy({ by: ["labId", "userId"], where: { labId: { in: labIds }, status: "IN_PROGRESS" } }),
    db.trainingProgress.groupBy({
      by: ["labId"],
      where: { labId: { in: labIds }, completedAt: null },
      _count: { _all: true },
    }),
  ]);
  const counts = new Map<string, number>();
  for (const row of attempts) counts.set(row.labId, (counts.get(row.labId) ?? 0) + 1);
  for (const row of training) counts.set(row.labId, (counts.get(row.labId) ?? 0) + row._count._all);
  return counts;
}

export async function countInProgress(labId: string) {
  return (await inProgressCounts([labId])).get(labId) ?? 0;
}

async function hideNotes(labIds: string[]) {
  if (labIds.length === 0) return new Map<string, string>();
  const logs = await db.auditLog.findMany({
    where: { action: "lab.hide", target: { in: labIds.map((id) => `lab:${id}`) } },
    orderBy: { createdAt: "desc" },
    select: { target: true, details: true },
  });
  const notes = new Map<string, string>();
  for (const log of logs) {
    const id = log.target.slice(4);
    if (notes.has(id)) continue;
    const note = (log.details as { note?: unknown } | null)?.note;
    notes.set(id, typeof note === "string" ? note : "");
  }
  return notes;
}

const percentOf = (part: number, whole: number) => Math.round((part / whole) * 100);

/** Lab listesindeki "ilk seferde" ve "tekrar sonrası" fark eden yüzdeleri; bitiren yoksa null. */
function noticedOf(counts: NoticeCounts | undefined): AdminLabRow["noticed"] {
  if (!counts || counts.students === 0) return null;
  return { first: percentOf(counts.first, counts.students), last: percentOf(counts.last, counts.students) };
}

/** Yönetimde labın grubu: sıra okları ve listedeki yeri (lib/lab/gates.ts kuralı, taslaklar dahil). */
export function adminGroup(lab: GateLab, labs: readonly GateLab[]) {
  if (lab.type === "TRAINING") return basicTrainingOf(labs, lab.neighborhoodId)?.id === lab.id ? null : "advanced";
  return `scenario:${gateOf(lab, labs)?.id ?? ""}`;
}

/** Labın kısa kodu (temel "O", ileri eğitim "OE1", senaryo rota sırasıyla "O1"); labs mahallenin bütün labları. */
export function adminCode(neighborhoodName: string, lab: GateLab, labs: readonly GateLab[]) {
  const route = routeOrder(labs, lab.neighborhoodId);
  const basic = basicTrainingOf(labs, lab.neighborhoodId);
  if (lab.type === "SCENARIO") return labCode(neighborhoodName, "scenario", route.filter((l) => l.type === "SCENARIO").findIndex((l) => l.id === lab.id));
  if (lab.id === basic?.id) return labCode(neighborhoodName, "basic", 0);
  return labCode(neighborhoodName, "advanced", route.filter((l) => l.type === "TRAINING" && l.id !== basic?.id).findIndex((l) => l.id === lab.id));
}

export const getAdminLabList = cache(async (): Promise<AdminNeighborhood[]> => {
  const [neighborhoods, labs, completions, notices, assignments] = await Promise.all([
    getNeighborhoods(),
    db.lab.findMany({
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        slug: true,
        neighborhoodId: true,
        type: true,
        template: true,
        status: true,
        sortOrder: true,
        unlockedById: true,
        difficulty: true,
        durationMin: true,
        draftContent: true,
        draftRevision: true,
        publishedVersion: true,
      },
    }),
    getCompletionCounts(),
    getNoticeCounts(),
    db.assignment.findMany({ where: { closed: false }, select: { neighborhoodId: true, labIds: true, classroomId: true } }),
  ]);

  const published = labs.filter((l) => l.publishedVersion !== null);
  const [versions, inProgress, notes] = await Promise.all([
    published.length
      ? db.labVersion.findMany({
          where: { OR: published.map((l) => ({ labId: l.id, version: l.publishedVersion! })) },
          select: { labId: true, content: true },
        })
      : Promise.resolve([]),
    inProgressCounts(labs.map((l) => l.id)),
    hideNotes(labs.filter((l) => l.status === "HIDDEN").map((l) => l.id)),
  ]);
  const publishedContent = new Map(versions.map((v) => [v.labId, v.content]));
  // Labı ödevinde tutan sınıflar: ödevin odaları arasındaysa ya da ödev oda seçimi olmadan bütün
  // mahalleyi veriyorsa.
  const assignedTo = (lab: { id: string; neighborhoodId: string }) =>
    new Set(assignments.filter((a) => a.neighborhoodId === lab.neighborhoodId && (a.labIds.length === 0 || a.labIds.includes(lab.id))).map((a) => a.classroomId)).size;

  return neighborhoods.map((n) => {
    // Listede rota sırası: her eğitim, ardından onun açtığı senaryolar (taslaklar dahil).
    const own = routeOrder(
      labs.filter((l) => l.neighborhoodId === n.id),
      n.id,
    );
    const nameOf = new Map(
      own.map((lab) => {
        const live = publishedContent.get(lab.id);
        return [lab.id, readContent(lab.template, lab.draftContent, readContent(lab.template, live, lab.slug).meta.name)] as const;
      }),
    );
    const rows = own.map((lab): AdminLabRow => {
      const live = publishedContent.get(lab.id);
      const content = nameOf.get(lab.id)!;
      const unreadable = draftIssues(lab.template, lab.draftContent) !== null;
      const code = adminCode(n.name, lab, own);
      const gate = lab.type === "SCENARIO" ? gateOf(lab, own) : null;
      return {
        id: lab.id,
        slug: lab.slug,
        code,
        name: content.meta.name || lab.slug,
        type: lab.type,
        template: lab.template,
        status: lab.status,
        difficulty: content.meta.difficulty,
        durationMin: content.meta.durationMin,
        cardCount: "cards" in content ? content.cards.length : 0,
        publishedVersion: lab.publishedVersion,
        unpublishedChanges: live !== undefined && !sameContent(content, schemaFor(lab.template).safeParse(live).data ?? live),
        unreadable,
        revision: lab.draftRevision,
        ready: !unreadable && isPublishable(lab.template, content),
        finished: completions.total.get(lab.id) ?? 0,
        noticed: lab.type === "SCENARIO" ? noticedOf(notices.get(lab.id)) : null,
        inProgress: inProgress.get(lab.id) ?? 0,
        assignedClasses: assignedTo(lab),
        hideNote: lab.status === "HIDDEN" ? (notes.get(lab.id) || null) : null,
        basic: lab.type === "TRAINING" && adminGroup(lab, own) === null,
        group: adminGroup(lab, own),
        gateName: gate ? nameOf.get(gate.id)?.meta.name || gate.slug : null,
      };
    });
    return {
      ...n,
      labs: rows,
      labCount: rows.length,
      publishedLabs: rows.filter((r) => r.status === "PUBLISHED").length,
      drafts: rows.filter((r) => r.status === "DRAFT").length,
      hidden: rows.filter((r) => r.status === "HIDDEN").length,
      finished: rows.filter((r) => r.status !== "DRAFT").reduce((sum, r) => sum + r.finished, 0),
    };
  });
});

// ---------------------------------------------------------------------------------------
// Lab düzenleme
// ---------------------------------------------------------------------------------------

export type AdminLab = {
  id: string;
  slug: string;
  code: string;
  type: LabType;
  template: SceneTemplate;
  status: LabStatus;
  publishedVersion: number | null;
  /** Yayınlanınca alacağı sürüm numarası. */
  nextVersion: number;
  /**
   * Kaydedilmiş taslak (formun başlangıç hali). Taslak okunamıyorsa yayındaki sürüm, o da yoksa
   * boş taslak; o zaman form yalnızca okunur (draftIssues).
   */
  draft: LabContent;
  /** Yayındaki sürümün içeriği; hiç yayınlanmadıysa null. */
  published: LabContent | null;
  /**
   * Taslak şemaya uymuyorsa (ör. şema sıkılaştı) uymayan alanların yolu, uyuyorsa null.
   * Okunamayan taslağın üstüne yazılmaz (lib/admin/lab-actions.ts da reddeder).
   */
  draftIssues: string[] | null;
  /**
   * Oda depodaki bir dosyadan geliyorsa (labs/rooms/, prisma/rooms.ts) o dosyanın yolu. Formdaki
   * değişiklik dosya bir sonraki değişişinde dosyadaki hâline döner; kalıcı düzeltme dosyada yapılır.
   */
  sourceFile: string | null;
  /** Kaydedilmiş taslağın sürümü (lib/admin/lab-actions.ts eşzamanlı düzenleme denetimi). */
  revision: number;
  inProgress: number;
  neighborhood: Pick<NeighborhoodRow, "id" | "slug" | "name" | "color">;
  /** Temel eğitim mi; senaryoda false. */
  basic: boolean;
  /**
   * Senaryoda açan eğitim: seçili olanın kimliği ve mahallenin eğitimleri (taslaklar dahil, ilki
   * temel eğitim). Eğitimde null.
   */
  gate: { current: string | null; options: { id: string; name: string }[] } | null;
};

export const getAdminLab = cache(async (id: string): Promise<AdminLab | null> => {
  const lab = await db.lab.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      type: true,
      template: true,
      status: true,
      sortOrder: true,
      unlockedById: true,
      neighborhoodId: true,
      draftContent: true,
      draftRevision: true,
      publishedVersion: true,
      sourceHash: true,
      neighborhood: { select: { id: true, slug: true, name: true, color: true } },
    },
  });
  if (!lab) return null;

  const [version, siblings, inProgress, last] = await Promise.all([
    lab.publishedVersion !== null
      ? db.labVersion.findUnique({ where: { labId_version: { labId: lab.id, version: lab.publishedVersion } }, select: { content: true } })
      : Promise.resolve(null),
    db.lab.findMany({
      where: { neighborhoodId: lab.neighborhood.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, slug: true, neighborhoodId: true, type: true, sortOrder: true, unlockedById: true, template: true, draftContent: true },
    }),
    countInProgress(lab.id),
    db.labVersion.aggregate({ where: { labId: lab.id }, _max: { version: true } }),
  ]);

  const published = version ? (schemaFor(lab.template).safeParse(version.content).data ?? null) : null;
  const issues = draftIssues(lab.template, lab.draftContent);
  const draft = issues && published ? published : readContent(lab.template, lab.draftContent, published?.meta.name ?? lab.slug);
  const trainings = routeOrder(siblings, lab.neighborhoodId).filter((l) => l.type === "TRAINING");
  const basic = trainings[0]?.id === lab.id;
  return {
    id: lab.id,
    slug: lab.slug,
    code: adminCode(lab.neighborhood.name, lab, siblings),
    type: lab.type,
    template: lab.template,
    status: lab.status,
    publishedVersion: lab.publishedVersion,
    nextVersion: (last._max.version ?? 0) + 1,
    draft,
    published,
    draftIssues: issues,
    sourceFile: lab.sourceHash ? `labs/rooms/${lab.neighborhood.slug}/${lab.slug}.json` : null,
    revision: lab.draftRevision,
    inProgress,
    neighborhood: lab.neighborhood,
    basic,
    gate:
      lab.type === "SCENARIO"
        ? {
            current: gateOf(lab, siblings)?.id ?? null,
            options: trainings.map((t) => ({ id: t.id, name: readContent(t.template, t.draftContent, t.slug).meta.name || t.slug })),
          }
        : null,
  };
});
