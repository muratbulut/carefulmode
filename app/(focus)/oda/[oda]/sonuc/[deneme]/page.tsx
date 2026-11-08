import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ReportScreen, type ReportScreenProps } from "@/components/lab/report/ReportScreen";
import { Loading } from "@/components/status/Loading";
import { db } from "@/lib/db";
import { format, getMessages } from "@/lib/i18n";
import { parseScenario } from "@/lib/lab/content";
import { getCity, isFinished } from "@/lib/lab/data";
import { reduceEvents, rowToEvent, taskProgress } from "@/lib/lab/events";
import { buildReportView } from "@/lib/lab/report";
import type { ScenarioReport } from "@/lib/lab/scoring";
import { paths, routes } from "@/lib/navigation";
import { isBadgeCode } from "@/lib/progress/badges";
import { requireUser } from "@/lib/session";
import { siteTimeZone } from "@/lib/site";

// Sonuç raporu: yalnızca denemenin sahibi görür (başkasınınki "bulunamadı" olur). Puan ve rapor
// özeti deneme bitince sunucuda hesaplanmıştır; burada yalnızca cümlelere çevrilir. Süren deneme
// raporsuzdur, öğrenci laba geri gönderilir.

export const metadata: Metadata = { title: getMessages().lab.report.crumb, robots: { index: false } };

export default function LabReportPage({ params }: PageProps<"/oda/[oda]/sonuc/[deneme]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Report params={params} />
    </Suspense>
  );
}

async function Report({ params }: Pick<PageProps<"/oda/[oda]/sonuc/[deneme]">, "params">) {
  const { oda: slug, deneme: attemptId } = await params;
  const user = await requireUser(paths.labReport(slug, attemptId));
  const attempt = await db.labAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      userId: true,
      labId: true,
      status: true,
      startedAt: true,
      endedAt: true,
      resultReport: true,
      lab: { select: { slug: true, template: true, neighborhood: { select: { id: true, slug: true, name: true, topic: true } } } },
      versionRecord: { select: { content: true } },
      events: { orderBy: { seq: "asc" }, select: { type: true, data: true } },
    },
  });
  if (!attempt || attempt.userId !== user.id || attempt.lab.slug !== slug) notFound();
  if (attempt.status === "IN_PROGRESS") redirect(paths.labPlay(slug));
  const content = parseScenario(attempt.versionRecord.content);
  const template = attempt.lab.template;
  if (!isFinished(attempt.status) || !attempt.resultReport || !content || template === "TRAINING") notFound();

  const t = getMessages();
  const r = t.lab.report;
  const view = buildReportView(content, template, attempt.resultReport as unknown as ScenarioReport);

  // Bu labdaki biten denemeleri (eskiden yeniye): kaçıncı deneme, geçen sefer, en iyi, son üçü.
  const finished = await db.labAttempt.findMany({
    where: { userId: user.id, labId: attempt.labId, status: { in: ["COMPLETED", "HACKED"] } },
    orderBy: { startedAt: "asc" },
    select: { id: true, reportScore: true },
  });
  const index = Math.max(0, finished.findIndex((a) => a.id === attempt.id));
  const upToNow = finished.slice(0, index + 1);
  const previous = index > 0 ? (finished[index - 1].reportScore ?? 0) : null;
  const history: ReportScreenProps["history"] = {
    previous,
    best: Math.max(...finished.map((a) => a.reportScore ?? 0), view.score),
    attemptNo: index + 1,
    bars: upToNow.slice(-3).map((a) => {
      const current = a.id === attempt.id;
      return { label: current ? r.thisTime : format(r.nth, { n: finished.indexOf(a) + 1 }), score: a.reportScore ?? 0, current };
    }),
  };

  const ended = attempt.endedAt ?? attempt.startedAt;
  const seconds = Math.max(0, Math.round((ended.getTime() - attempt.startedAt.getTime()) / 1000));
  const tasks = taskProgress(content.tasks, reduceEvents(attempt.events.map(rowToEvent)));
  const facts = {
    duration: format(r.durationValue, { m: Math.floor(seconds / 60), s: seconds % 60 }),
    date: new Intl.DateTimeFormat("tr-TR", { timeZone: siteTimeZone, day: "numeric", month: "long" }).format(ended),
    tasks: format(r.tasksValue, { n: tasks.done.filter(Boolean).length, total: content.tasks.length }),
  };

  // Sıradaki lab: aynı mahallede bitmemiş açık senaryo, yoksa şehirdeki sıradaki lab.
  const city = await getCity(user.id);
  const district = city.find((d) => d.id === attempt.lab.neighborhood.id);
  const open = (state: string) => state !== "done" && state !== "locked";
  const nextLab =
    district?.scenarios.find((s) => s.lab.id !== attempt.labId && open(s.state)) ??
    city.map((d) => d.next).find((n) => n !== null && n.lab.id !== attempt.labId) ??
    null;
  // "Eğitime dön": bu odayı açan eğitim.
  const gate = district?.scenarios.find((s) => s.lab.id === attempt.labId)?.gate ?? null;

  const newBadges = await badgesEarnedWith(user.id, attempt.startedAt, ended);

  const title = content.meta.title || content.meta.name;
  return (
    <ReportScreen
      view={view}
      lab={{ name: content.meta.name, title, topic: attempt.lab.neighborhood.topic }}
      backHref={paths.lab(slug)}
      crumbs={[
        { label: t.nav.links.labs, href: routes.labs },
        { label: attempt.lab.neighborhood.name, href: paths.neighborhood(attempt.lab.neighborhood.slug) },
        { label: title, href: paths.lab(slug) },
        { label: r.crumb },
      ]}
      facts={facts}
      history={history}
      newBadges={newBadges}
      actions={{
        next: nextLab ? { href: paths.lab(nextLab.lab.slug), label: r.actions.next } : { href: routes.roadmap, label: r.actions.roadmap },
        retry: paths.labPlay(slug),
        training: gate ? paths.labPlay(gate.slug) : undefined,
      }}
    />
  );
}

/**
 * Bu denemeyle kazanılan rozetler (deneme bitince awardBadges yazar). Rapor deneme bittikten kısa
 * süre sonra açılıyorsa bildirim olarak gösterilir; sonradan tekrar açılan raporda çıkmaz.
 */
async function badgesEarnedWith(userId: string, startedAt: Date, endedAt: Date) {
  if (Date.now() - endedAt.getTime() > 10 * 60_000) return [];
  const rows = await db.earnedBadge.findMany({
    where: { userId, earnedAt: { gte: startedAt, lte: new Date(endedAt.getTime() + 60_000) } },
    orderBy: { earnedAt: "asc" },
    select: { badgeCode: true },
  });
  return rows.map((b) => b.badgeCode).filter(isBadgeCode);
}
