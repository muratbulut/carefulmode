import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { LabPlay, TrainingPlay } from "@/components/lab/LabPlay";
import { Loading } from "@/components/status/Loading";
import { avatarOf } from "@/lib/avatars";
import { getMessages } from "@/lib/i18n";
import { getOpenAttempt } from "@/lib/lab/attempts";
import { toClientScenario, toClientTraining } from "@/lib/lab/client";
import { findInCity, getCity, getPublishedLab } from "@/lib/lab/data";
import { paths, routes } from "@/lib/navigation";
import { requireUser, requireVerifiedUser } from "@/lib/session";

// Lab oynatıcısı: eğitim labında kartlar, senaryo labında lab çerçevesi. Odak çerçevesinde
// (alt bilgi ve alt menü yok). İleri eğitim temel eğitim bitmeden, senaryo labı kendi eğitimi
// bitmeden açılmaz (lib/lab/gates.ts); senaryo doğrulanmış e-posta ister, yarım deneme varsa
// kaldığı yerden, başladığı sürümle açılır.

export const metadata: Metadata = { title: getMessages().pages.lab, robots: { index: false } };

export default function LabPlayPage({ params }: PageProps<"/oda/[oda]/oyna">) {
  return (
    <Suspense fallback={<Loading />}>
      <Player params={params} />
    </Suspense>
  );
}

async function Player({ params }: Pick<PageProps<"/oda/[oda]/oyna">, "params">) {
  const { oda: slug } = await params;
  const here = paths.labPlay(slug);
  const lab = await getPublishedLab(slug);
  if (!lab) notFound();

  if (lab.type === "TRAINING") {
    if (!lab.training) notFound();
    const user = await requireUser(here);
    const found = findInCity(await getCity(user.id), lab.id);
    if (!found) notFound();
    const { district, item } = found;
    if (item.state === "locked") redirect(paths.neighborhood(district.slug));
    const progress = item.progress;
    return (
      <TrainingPlay
        slug={slug}
        title={lab.meta.name}
        cards={toClientTraining(lab.training)}
        startIndex={!progress.done ? (progress.cardIndex ?? 0) : 0}
        exitHref={paths.neighborhood(district.slug)}
        playHref={here}
        // Bitiş kartında bu eğitimin açtığı senaryolar.
        scenarios={district.scenarios
          .filter((s) => s.gate?.id === lab.id)
          .map((s) => ({ title: s.lab.meta.title || s.lab.meta.name, href: paths.lab(s.lab.slug) }))}
        roadmapHref={routes.roadmap}
        avatar={avatarOf({ id: user.id, avatar: user.image }).emoji}
      />
    );
  }

  if (!lab.scenario || lab.template === "TRAINING") notFound();
  const user = await requireVerifiedUser(here);
  const entry = findInCity(await getCity(user.id), lab.id)?.item;
  if (!entry || entry.state === "locked") redirect(paths.lab(slug));

  const open = await getOpenAttempt(user.id, lab.id);
  const content = open?.content ?? lab.scenario;
  return (
    <LabPlay
      slug={slug}
      scenario={toClientScenario(content, lab.template)}
      version={open?.version ?? lab.version}
      avatar={avatarOf({ id: user.id, avatar: user.image }).emoji}
      resume={open ? { attemptId: open.attemptId, state: open.state, nextSeq: open.nextSeq } : null}
      exitHref={paths.lab(slug)}
      playHref={here}
    />
  );
}
