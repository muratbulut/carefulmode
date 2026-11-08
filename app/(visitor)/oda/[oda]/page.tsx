import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageBackground } from "@/components/background/PageBackground";
import { LabDetail } from "@/components/lab/detail/LabDetail";
import type { LabDetailData } from "@/components/lab/detail/types";
import { Loading } from "@/components/status/Loading";
import { dayMonth } from "@/lib/account/dates";
import { format, getMessages } from "@/lib/i18n";
import { paragraphs } from "@/lib/lab/content";
import { coverOf } from "@/lib/lab/cover";
import { getAttemptTaskProgress, getCity, getCompletionCounts, getPublishedLab, getReports, requestTime, type PublishedLab } from "@/lib/lab/data";
import { paths } from "@/lib/navigation";
import { requireUser } from "@/lib/session";
import { siteTimeZone } from "@/lib/site";

export const metadata: Metadata = { title: getMessages().pages.lab, robots: { index: false } };

/**
 * Lab detayı (senaryo labının kapağı). Giriş ister; e-postası doğrulanmamış öğrenci sayfayı
 * görür ama ana düğme doğrulama sayfasına gider. Eğitim labının kapağı yoktur, doğrudan
 * oynatıcıya gider. Odaya girmek /oda/[oda]/oyna'dadır.
 */
export default function LabPage({ params }: PageProps<"/oda/[oda]">) {
  return (
    <>
      <PageBackground />
      <Suspense fallback={<Loading className="relative mx-4 my-8 lg:mx-auto lg:max-w-[1152px]" cardCount={3} />}>
        <Detail params={params} />
      </Suspense>
    </>
  );
}

async function Detail({ params }: Pick<PageProps<"/oda/[oda]">, "params">) {
  const { oda: slug } = await params;
  const lab = await getPublishedLab(slug);
  if (!lab) notFound();
  if (lab.type === "TRAINING") redirect(paths.labPlay(lab.slug));
  const user = await requireUser(paths.lab(lab.slug));
  return <LabDetail data={await detailData(lab, user.id, user.emailVerified)} />;
}

async function detailData(lab: PublishedLab, userId: string, verified: boolean): Promise<LabDetailData> {
  const [city, counts, reports, now] = await Promise.all([
    getCity(userId),
    getCompletionCounts(),
    getReports(userId, { labId: lab.id, limit: 1 }),
    requestTime(),
  ]);
  const district = city.find((d) => d.id === lab.neighborhoodId);
  const item = district?.scenarios.find((s) => s.lab.id === lab.id);
  if (!district || !item) notFound();
  const progress = item.progress;
  const attempt = progress.inProgress ? await getAttemptTaskProgress(progress.inProgress, lab) : null;
  const last = reports[0] ?? null;
  // Bu odayı açan eğitim (lib/lab/gates.ts).
  const training = district.trainings.find((x) => x.lab.id === item.gate?.id) ?? null;

  return {
    slug: lab.slug,
    name: lab.meta.name,
    title: lab.meta.title,
    story: lab.meta.story || lab.meta.summary,
    learn: lab.meta.learn,
    template: lab.template === "MESSAGING" ? "MESSAGING" : "INBOX",
    difficulty: lab.difficulty,
    durationMin: lab.durationMin,
    district: {
      slug: district.slug,
      name: district.name,
      topic: district.topic,
      color: district.color,
      icon: district.icon,
      sortOrder: district.sortOrder,
    },
    state: item.state,
    verified,
    completions: counts.total.get(lab.id) ?? 0,
    week: counts.week.get(lab.id) ?? 0,
    training: training
      ? {
          name: training.lab.meta.name,
          done: training.progress.done,
          doneOn: training.progress.doneAt ? dayMonth(training.progress.doneAt) : null,
          href: paths.labPlay(training.lab.slug),
        }
      : null,
    attempt,
    inProgress: progress.inProgress !== null,
    best: progress.best,
    finishedCount: progress.finishedCount,
    last: last
      ? {
          score: last.score,
          status: last.status,
          date: last.endedAt ? dayMonth(last.endedAt) : null,
          href: paths.labReport(lab.slug, last.attemptId),
        }
      : null,
    phone: phoneOf(lab, now),
    cover: coverOf(lab),
    ahead: aheadOf(lab),
  };
}

/** "Seni neler bekliyor": yalnızca sayılar ve görevin adları; doğru kararlar gitmez. */
function aheadOf(lab: PublishedLab): LabDetailData["ahead"] {
  const mission = lab.scenario?.mission;
  return {
    caller: mission?.caller || null,
    items: lab.scenario?.items.length ?? 0,
    deal: mission?.shop
      ? { kind: "shop", name: mission.shop.name, owner: mission.owner }
      : mission?.sale
        ? { kind: "sale", name: mission.sale.platform, product: mission.sale.product }
        : null,
    tasks: lab.scenario?.tasks.length ?? 0,
  };
}

const isClock = (text: string) => /^\d{1,2}:\d{2}$/.test(text);
const plain = (text: string) => text.replace(/\*\*/g, "");

/**
 * Telefondaki kilit ekranı: bugünün tarihi ve labın ilk iki maili ya da mesajı. Yalnızca
 * gönderen, konu ve saat gider; hangisinin sahte olduğu bilgisi gitmez.
 */
function phoneOf(lab: PublishedLab, now: Date): LabDetailData["phone"] {
  const t = getMessages().lab.detail;
  const weekday = new Intl.DateTimeFormat("tr-TR", { weekday: "long", timeZone: siteTimeZone }).format(now);
  const clock = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: siteTimeZone }).format(now);
  const items = lab.scenario?.items.slice(0, 2) ?? [];
  return {
    date: format(t.lockDate, { weekday, date: dayMonth(now) }),
    time: items[0] && isClock(items[0].time) ? items[0].time : clock,
    notifications: items.map((item) => ({
      sender: item.sender,
      text: plain(item.subject || paragraphs(item.body)[0] || ""),
      time: item.time || null,
    })),
  };
}
