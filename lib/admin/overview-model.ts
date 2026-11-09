// Yönetim özetinin (Ozet-Son) saf hesapları: zaman pencereleri, sayı kutuları, son 6 haftanın
// grafiği, bekleyen iş kartları, gündemdeki boş haftalar ve en çok tuzağa düşülen lablar. Veritabanı
// sorguları lib/admin/overview.ts içinde; burası yalnızca sayılardan ekrandaki metni çıkarır.
// Hepsi toplam sayıdır, öğrenci adı ya da kimliği yoktur. Saf modül; birim testli.

import { format, getMessages } from "@/lib/i18n";
import { paths } from "@/lib/navigation";
import { dayMonth, dayMonthShort, dayMs, monthStart, trParts, weekMs, weekStart } from "./calendar";

export const periods = ["week", "month", "all"] as const;
export type Period = (typeof periods)[number];

export const chartMetrics = ["finished", "signups", "active"] as const;
export type ChartMetric = (typeof chartMetrics)[number];

export const kpiKeys = ["newStudents", "activeStudents", "finishedLabs", "noticedFirst"] as const;
export type KpiKey = (typeof kpiKeys)[number];

// ---------------------------------------------------------------------------------------
// Zaman pencereleri
// ---------------------------------------------------------------------------------------

export const chartWeeks = 6;
export const windowKeys = ["w0", "w1", "w2", "w3", "w4", "w5", "month", "prevMonth", "all"] as const;
export type WindowKey = (typeof windowKeys)[number];
export type TimeWindow = { key: WindowKey; start: Date; end: Date };

/**
 * Sayıların pencereleri: son 6 hafta (w0 en eski, w5 bu hafta), bu ay, geçen ay ve tüm zamanlar.
 * Bitmemiş pencerenin sonu bir gün sonrasıdır (sunucu ile veritabanı saati arasındaki küçük fark
 * yeni satırı dışarıda bırakmasın; gelecekte tarihli satır yok).
 */
export function overviewWindows(now: Date): TimeWindow[] {
  const thisWeek = weekStart(now).getTime();
  const open = new Date(now.getTime() + dayMs);
  const weeks = Array.from({ length: chartWeeks }, (_, i): TimeWindow => {
    const start = thisWeek - (chartWeeks - 1 - i) * weekMs;
    return { key: windowKeys[i], start: new Date(start), end: i === chartWeeks - 1 ? open : new Date(start + weekMs) };
  });
  return [
    ...weeks,
    { key: "month", start: monthStart(now), end: open },
    { key: "prevMonth", start: monthStart(now, 1), end: monthStart(now) },
    { key: "all", start: new Date(0), end: open },
  ];
}

/**
 * Bir penceredeki sayılar: biten lab (eğitim + senaryo), öğrencinin bir senaryo labındaki ilk biten
 * denemesi (firstTries) ve bunlardan tuzağı fark eden (firstNoticed), yeni kayıt, aktif öğrenci.
 */
export type WindowCounts = { finished: number; firstTries: number; firstNoticed: number; signups: number; active: number };
export const emptyCounts: WindowCounts = { finished: 0, firstTries: 0, firstNoticed: 0, signups: 0, active: 0 };

// ---------------------------------------------------------------------------------------
// Sayı kutuları ve grafik
// ---------------------------------------------------------------------------------------

const thousands = (n: number) => n.toLocaleString("tr-TR");
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

export type Kpi = { key: KpiKey; value: string; sub: string };

/** Değişim: "+%13 geçen haftaya göre" gibi; geçen hafta hiç yoksa ayrı cümle. */
export function changeOf(current: number, previous: number): { kind: "up" | "down" | "same" | "noPrevious"; n: number } {
  if (previous === 0) return current === 0 ? { kind: "same", n: 0 } : { kind: "noPrevious", n: 0 };
  const n = Math.round(((current - previous) / previous) * 100);
  return n > 0 ? { kind: "up", n } : n < 0 ? { kind: "down", n: -n } : { kind: "same", n: 0 };
}

/** Dönem dönem sayı kutuları (Bu hafta / Bu ay / Tüm zamanlar); metinler sunucuda hazırlanır. */
export function buildKpis(
  counts: Record<WindowKey, WindowCounts>,
  context: { now: Date; publishedLabs: number; firstSignup: Date | null },
): Record<Period, Kpi[]> {
  const t = getMessages().adminOverview;
  const s = t.subs;
  const months = getMessages().profile;
  const { now } = context;
  const registered = counts.all.signups;
  const week = counts.w5;
  const lastWeek = counts.w4;
  const month = counts.month;
  const prevMonth = counts.prevMonth;
  const prevMonthIndex = trParts(monthStart(now, 1)).month;
  const today = trParts(now);

  const rate = (c: WindowCounts) => {
    const value = percent(c.firstNoticed, c.firstTries);
    return value === null ? t.none : format(t.percent, { n: value });
  };
  const active = (c: WindowCounts): Kpi => ({
    key: "activeStudents",
    value: thousands(c.active),
    sub: format(s.ofRegistered, { n: thousands(registered) }),
  });

  const finishedChange = changeOf(week.finished, lastWeek.finished);
  const weekFinishedSub =
    finishedChange.kind === "up"
      ? format(s.moreThanLastWeek, { n: finishedChange.n })
      : finishedChange.kind === "down"
        ? format(s.lessThanLastWeek, { n: finishedChange.n })
        : finishedChange.kind === "same"
          ? s.sameAsLastWeek
          : format(s.lastWeek, { n: thousands(lastWeek.finished) });
  const lastWeekRate = percent(lastWeek.firstNoticed, lastWeek.firstTries);
  const prevMonthRate = percent(prevMonth.firstNoticed, prevMonth.firstTries);
  const prevMonthOn = months.monthsOn[prevMonthIndex];

  const first = context.firstSignup ? trParts(context.firstSignup) : null;

  return {
    week: [
      { key: "newStudents", value: thousands(week.signups), sub: format(s.lastWeek, { n: thousands(lastWeek.signups) }) },
      active(week),
      { key: "finishedLabs", value: thousands(week.finished), sub: weekFinishedSub },
      {
        key: "noticedFirst",
        value: rate(week),
        sub: lastWeekRate === null ? s.lastWeekNone : format(s.lastWeekRate, { n: lastWeekRate }),
      },
    ],
    month: [
      {
        key: "newStudents",
        value: thousands(month.signups),
        sub:
          today.day === 1
            ? format(s.monthFirstDay, { month: t.monthsOf[today.month] })
            : format(s.monthSoFar, { month: t.monthsOf[today.month], n: today.day }),
      },
      active(month),
      { key: "finishedLabs", value: thousands(month.finished), sub: format(s.inMonth, { month: prevMonthOn, n: thousands(prevMonth.finished) }) },
      {
        key: "noticedFirst",
        value: rate(month),
        sub: prevMonthRate === null ? format(s.monthNone, { month: prevMonthOn }) : format(s.monthRate, { month: prevMonthOn, n: prevMonthRate }),
      },
    ],
    all: [
      {
        key: "newStudents",
        value: thousands(counts.all.signups),
        sub: first ? format(s.since, { day: first.day, month: t.monthsFrom[first.month] }) : s.noStudents,
      },
      active(counts.all),
      { key: "finishedLabs", value: thousands(counts.all.finished), sub: format(s.publishedLabs, { n: thousands(context.publishedLabs) }) },
      { key: "noticedFirst", value: rate(counts.all), sub: s.allScenarios },
    ],
  };
}

export type ChartBar = { label: string; value: number; display: string; current: boolean };
export type ChartSeries = { metric: ChartMetric; bars: ChartBar[]; total: string; change: string };

const metricField: Record<ChartMetric, keyof WindowCounts> = { finished: "finished", signups: "signups", active: "active" };

/** Son 6 haftanın üç dizisi (biten lab, yeni kayıt, aktif öğrenci); son çubuk bu hafta. */
export function buildChart(counts: Record<WindowKey, WindowCounts>, windows: readonly TimeWindow[]): ChartSeries[] {
  const t = getMessages().adminOverview.chart;
  const weeks = windows.slice(0, chartWeeks);
  return chartMetrics.map((metric) => {
    const field = metricField[metric];
    const values = weeks.map((w) => counts[w.key][field]);
    const current = values[values.length - 1];
    const change = changeOf(current, values[values.length - 2]);
    return {
      metric,
      bars: weeks.map((w, i) => ({
        label: i === weeks.length - 1 ? t.thisWeek : dayMonthShort(w.start),
        value: values[i],
        display: thousands(values[i]),
        current: i === weeks.length - 1,
      })),
      total: thousands(current),
      change:
        change.kind === "up"
          ? format(t.up, { n: change.n })
          : change.kind === "down"
            ? format(t.down, { n: change.n })
            : change.kind === "same"
              ? t.same
              : t.noPrevious,
    };
  });
}

// ---------------------------------------------------------------------------------------
// Bekleyen işler
// ---------------------------------------------------------------------------------------

export const pendingKeys = ["applications", "news", "labs", "notes"] as const;
export type PendingKey = (typeof pendingKeys)[number];

export type PendingCard = { key: PendingKey; count: number; title: string; sub: string; href: string; go: string };

/** Kartların girdisi; izni olmayan işin girdisi hiç verilmez (kart da çıkmaz). */
export type PendingInput = {
  applications?: { pending: number; newSchool: number; answered: number };
  notes?: { count: number; first: { school: string | null; opinion: "ENDORSED" | "NOT_RECOGNIZED" } | null };
  news?: { emptyWeeks: Date[]; drafts: number };
  labs?: { drafts: { name: string; neighborhood: string }[] };
};

const listFormat = () => new Intl.ListFormat("tr", { style: "long", type: "conjunction" });

/** Bekleyen iş kartları (Tur 5 sırası: talep, gündem, lab, okul notu). Sayısı 0 olan kart çıkmaz. */
export function buildPendingCards(input: PendingInput): PendingCard[] {
  const t = getMessages().adminOverview.cards;
  const cards: PendingCard[] = [];

  if (input.applications && input.applications.pending > 0) {
    const a = input.applications;
    const parts = [
      a.newSchool > 0 ? format(t.applications.newSchool, { n: a.newSchool }) : "",
      a.answered > 0 ? format(t.applications.answered, { n: a.answered }) : "",
    ].filter(Boolean);
    cards.push({
      key: "applications",
      count: a.pending,
      title: format(t.applications.title, { n: a.pending }),
      sub: parts.length ? `${parts.join(", ")}.` : t.applications.none,
      href: paths.adminApplications,
      go: t.applications.go,
    });
  }

  if (input.news && input.news.emptyWeeks.length > 0) {
    const n = input.news;
    cards.push({
      key: "news",
      count: n.emptyWeeks.length,
      title: format(t.news.title, { n: n.emptyWeeks.length }),
      sub: `${format(t.news.weeks, { dates: listFormat().format(n.emptyWeeks.map(dayMonth)) })} ${
        n.drafts > 0 ? format(t.news.drafts, { n: n.drafts }) : t.news.noDrafts
      }`,
      href: paths.adminNews,
      go: t.news.go,
    });
  }

  if (input.labs && input.labs.drafts.length > 0) {
    const drafts = input.labs.drafts;
    const shown = drafts.slice(0, 3).map((d) => format(t.labs.item, d));
    if (drafts.length > 3) shown.push(format(t.labs.more, { n: drafts.length - 3 }));
    cards.push({
      key: "labs",
      count: drafts.length,
      title: format(t.labs.title, { n: drafts.length }),
      sub: `${shown.join(", ")}.`,
      href: paths.adminLabs,
      go: t.labs.go,
    });
  }

  if (input.notes && input.notes.count > 0) {
    const notes = input.notes;
    const single = notes.count === 1 && notes.first;
    cards.push({
      key: "notes",
      count: notes.count,
      title: format(t.notes.title, { n: notes.count }),
      sub: single
        ? format(single.opinion === "ENDORSED" ? t.notes.endorsed : t.notes.notRecognized, { school: single.school ?? t.notes.newSchool })
        : format(t.notes.many, { n: notes.count }),
      href: paths.adminApplications,
      go: single ? t.notes.go : t.notes.goMany,
    });
  }

  return cards;
}

/**
 * Gündemdeki boş haftalar: verilen cumaların haftasında (pazartesi-pazar) planlı ya da yayında
 * haber yoksa o cuma boştur.
 */
export function emptyNewsWeeks(fridays: readonly Date[], published: readonly Date[]): Date[] {
  return fridays.filter((friday) => {
    const start = weekStart(friday).getTime();
    return !published.some((at) => at.getTime() >= start && at.getTime() < start + weekMs);
  });
}

// ---------------------------------------------------------------------------------------
// En çok tuzağa düşülen lablar
// ---------------------------------------------------------------------------------------

/** Bir labın en az bu kadar biten senaryo denemesi olmadan oranı gösterilmez (küçük sayı yanıltır). */
export const trapMinSample = 10;

export type TrapStat = { labId: string; total: number; hacked: number };

/** Hacklenerek biten denemelerin payına göre sıralı lablar (en az `minSample` deneme, en az bir tuzak). */
export function rankTraps(stats: readonly TrapStat[], minSample = trapMinSample, limit = 4): (TrapStat & { rate: number })[] {
  return stats
    .filter((s) => s.total >= minSample && s.hacked > 0)
    .map((s) => ({ ...s, rate: Math.round((s.hacked / s.total) * 100) }))
    .sort((a, b) => b.hacked / b.total - a.hacked / a.total || b.total - a.total || a.labId.localeCompare(b.labId))
    .slice(0, limit);
}

/** Rapor satırının kaçırılma sayısı: sahte öğe ya da soru (gerçek öğe "kaçırılmaz", yanlış alarmdır). */
export type MissRow = { labId: string; type: "fake" | "question"; key: string; missed: number };

/** Her labın en çok kaçırılan satırı; eşitlikte sahte öğe sorudan önce gelir. */
export function topMissed(rows: readonly MissRow[]): Map<string, MissRow> {
  const best = new Map<string, MissRow>();
  for (const row of rows) {
    if (row.missed <= 0) continue;
    const current = best.get(row.labId);
    const better =
      !current ||
      row.missed > current.missed ||
      (row.missed === current.missed && row.type === "fake" && current.type !== "fake") ||
      (row.missed === current.missed && row.type === current.type && row.key < current.key);
    if (better) best.set(row.labId, row);
  }
  return best;
}
