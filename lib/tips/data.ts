// Günün ipucunu okuyan sunucu fonksiyonları: bugünün ipucu (öğrenci ana sayfası, tanıtım sayfası)
// ve yönetimdeki C3 ekranının verisi. Sıra kuralı lib/tips/schedule.ts. Yalnızca sunucuda.
//
// Bugünün ipucu günün ilk isteğinde seçilir ve TipDay'e yazılır; ondan sonra o gün değişmez.
// Aynı anda gelen iki ilk istek aynı satırı yazmaya çalışırsa biri kazanır (ON CONFLICT DO
// NOTHING), ikisi de yazılanı yeniden okur.

import "server-only";
import { io } from "next/cache";
import { cache } from "react";
import { db } from "@/lib/db";
import { getNeighborhoods, getPublishedLabs } from "@/lib/lab/data";
import { planLength } from "./rules";
import { dateToDay, dayToDate, pickForDay, planDays, turkeyDay, type DayKey, type PlannedDay, type ScheduleTip, type TipStatus } from "./schedule";

export type TodayTip = {
  id: string;
  text: string;
  reason: string;
  /** Bugünün günü (Türkiye). */
  date: DayKey;
  neighborhood: { id: string; name: string; color: string } | null;
  lab: { id: string; slug: string } | null;
};

/** Bugünün günü (Türkiye saati). Ön derlemede saat okunmaz (cacheComponents). */
export async function tipToday(): Promise<DayKey> {
  await io();
  return turkeyDay(new Date());
}

const todaySelect = {
  tip: {
    select: {
      id: true,
      text: true,
      reason: true,
      neighborhood: { select: { id: true, name: true, color: true } },
      lab: { select: { id: true, slug: true } },
    },
  },
} as const;

async function readDay(day: DayKey) {
  return db.tipDay.findUnique({ where: { date: dayToDate(day) }, select: todaySelect });
}

/** Sıra hesabı için ipuçları ve en son gösterildikleri gün. */
async function scheduleTips(where: { status?: TipStatus } = {}): Promise<ScheduleTip[]> {
  const [tips, shown] = await Promise.all([
    db.dailyTip.findMany({ where, select: { id: true, status: true, pinnedDate: true, createdAt: true } }),
    db.tipDay.groupBy({ by: ["tipId"], _max: { date: true } }),
  ]);
  const last = new Map(shown.map((s) => [s.tipId, s._max.date]));
  return tips.map((t) => {
    const lastShown = last.get(t.id);
    return {
      id: t.id,
      status: t.status,
      pinnedDay: t.pinnedDate ? dateToDay(t.pinnedDate) : null,
      createdAt: t.createdAt.getTime(),
      lastShown: lastShown ? dateToDay(lastShown) : null,
    };
  });
}

/**
 * Bugünün ipucu. Gün için henüz seçilmediyse kurala göre seçilir ve yazılır. Havuz boşsa null
 * (çağıran hazır gelen ipucunu gösterir ve hiçbir şey kaydetmez).
 */
export const getTodayTip = cache(async (): Promise<TodayTip | null> => {
  const today = await tipToday();
  let row = await readDay(today);
  if (!row) {
    const pick = pickForDay(await scheduleTips({ status: "POOL" }), today);
    if (!pick) return null;
    await db.tipDay.createMany({ data: [{ date: dayToDate(today), tipId: pick.tipId }], skipDuplicates: true });
    row = await readDay(today);
    if (!row) return null;
  }
  const { tip } = row;
  return { id: tip.id, text: tip.text, reason: tip.reason, date: today, neighborhood: tip.neighborhood, lab: tip.lab };
});

/** Öğrenci bugünün ipucunu gördü: günde bir satır; varsa hiçbir şey yazılmaz. */
export async function recordTipView(userId: string, tipId: string, day: DayKey) {
  try {
    await db.tipView.createMany({ data: [{ userId, tipId, date: dayToDate(day) }], skipDuplicates: true });
  } catch (error) {
    console.error("[ipucu] görülme kaydı yazılamadı:", error instanceof Error ? error.message : error);
  }
}

// ---------------------------------------------------------------------------------------
// Yönetim: Ipucu-C3-Bugun
// ---------------------------------------------------------------------------------------

export type AdminTip = {
  id: string;
  text: string;
  reason: string;
  neighborhoodId: string | null;
  labId: string | null;
  status: TipStatus;
  pinnedDay: DayKey | null;
  /** Kaç gün gösterildi (bugün dahil). */
  shown: number;
  /** Bütün günlerde ipucunu gören ve "Neden?"e bakan kişi sayıları (oran için). */
  views: number;
  reasonViews: number;
  /** Önümüzdeki 14 gün içinde sırası gelen ilk gün (bugün dahil); yoksa null. */
  nextDay: DayKey | null;
};

export type AdminTipNeighborhood = { id: string; name: string; color: string; labs: { id: string; name: string }[] };

export type TipAdminData = {
  today: DayKey;
  /** Bugünün ipucu ve bugünkü sayılar; havuz boşsa null. */
  todayTip: { id: string; views: number; reasonViews: number } | null;
  /** Bugünden başlayarak 14 gün; [0] bugün. */
  plan: PlannedDay[];
  tips: AdminTip[];
  /** Mahalleler ve her mahallenin yayındaki labları (ilgili lab seçimi). */
  neighborhoods: AdminTipNeighborhood[];
};

/** Yönetimdeki ipucu ekranının verisi. Çağıran sayfa önce TIPS iznini denetler. */
export const getTipAdminData = cache(async (): Promise<TipAdminData> => {
  // Bugünün ipucu önce seçilir: yönetimin gördüğü "bugün" öğrencinin gördüğüyle aynıdır.
  const todayTip = await getTodayTip();
  const today = await tipToday();
  const todayDate = dayToDate(today);

  const [tips, schedule, shown, views, neighborhoods, labs, todayViews] = await Promise.all([
    db.dailyTip.findMany({
      select: { id: true, text: true, reason: true, neighborhoodId: true, labId: true, status: true, pinnedDate: true, createdAt: true, neighborhood: { select: { sortOrder: true } } },
    }),
    scheduleTips(),
    db.tipDay.groupBy({ by: ["tipId"], _count: { _all: true } }),
    db.tipView.groupBy({ by: ["tipId", "reasonViewed"], _count: { _all: true } }),
    getNeighborhoods(),
    getPublishedLabs(),
    todayTip
      ? db.tipView.groupBy({ by: ["reasonViewed"], where: { tipId: todayTip.id, date: todayDate }, _count: { _all: true } })
      : Promise.resolve([]),
  ]);

  const plan = planDays(schedule, today, planLength, todayTip?.id ?? null);
  const nextOf = new Map<string, DayKey>();
  for (const day of plan) if (day.tipId && !nextOf.has(day.tipId)) nextOf.set(day.tipId, day.day);
  const shownOf = new Map(shown.map((s) => [s.tipId, s._count._all]));
  const viewCount = (tipId: string, reasonOnly: boolean) =>
    views.filter((v) => v.tipId === tipId && (!reasonOnly || v.reasonViewed)).reduce((sum, v) => sum + v._count._all, 0);
  const todayCount = (reasonOnly: boolean) => todayViews.filter((v) => !reasonOnly || v.reasonViewed).reduce((sum, v) => sum + v._count._all, 0);

  const sorted = [...tips].sort(
    (a, b) =>
      (a.neighborhood?.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.neighborhood?.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );

  return {
    today,
    todayTip: todayTip ? { id: todayTip.id, views: todayCount(false), reasonViews: todayCount(true) } : null,
    plan,
    tips: sorted.map((t) => ({
      id: t.id,
      text: t.text,
      reason: t.reason,
      neighborhoodId: t.neighborhoodId,
      labId: t.labId,
      status: t.status,
      pinnedDay: t.pinnedDate ? dateToDay(t.pinnedDate) : null,
      shown: shownOf.get(t.id) ?? 0,
      views: viewCount(t.id, false),
      reasonViews: viewCount(t.id, true),
      nextDay: t.status === "POOL" || t.id === todayTip?.id ? (nextOf.get(t.id) ?? null) : null,
    })),
    neighborhoods: neighborhoods.map((n) => ({
      id: n.id,
      name: n.name,
      color: n.color,
      labs: labs.filter((l) => l.neighborhoodId === n.id).map((l) => ({ id: l.id, name: l.meta.name })),
    })),
  };
});
