import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FilePenLine } from "lucide-react";
import Link from "next/link";
import { LabPreview } from "@/components/lab/preview/LabPreview";
import { EmptyState } from "@/components/status/EmptyState";
import { Loading } from "@/components/status/Loading";
import { requireLabAccess } from "@/lib/admin/access";
import { getAdminLab } from "@/lib/admin/lab-data";
import { adminMetadata } from "@/lib/admin/metadata";
import { format, getMessages } from "@/lib/i18n";
import type { ScenarioContent, TrainingContent } from "@/lib/lab/content";
import { getNeighborhoods } from "@/lib/lab/data";
import { paths } from "@/lib/navigation";

export function generateMetadata({ params }: PageProps<"/yonetim/odalar/[id]/onizle">) {
  return adminMetadata(async () => {
    const { id } = await params;
    const lab = await getAdminLab(id);
    return lab ? format(getMessages().lab.preview.pageTitle, { name: lab.draft.meta.name || lab.slug }) : null;
  }, "LAB_EDITING", "LAB_PUBLISHING");
}

/**
 * Lab önizlemesi ("Önizle"): kaydedilmiş taslak, öğrencinin tam ekran oynatıcısında açılır.
 * Kararlar tarayıcıdaki sürücüye gider (components/lab/preview/), hiçbir şey kaydedilmez. Taslak
 * içeriğin tamamı (doğru kararlar dahil) yalnızca lab izni olan ekibe gider; kapı
 * app/yonetim/layout.tsx'te ve burada yeniden denetlenir.
 */
export default function LabPreviewPage({ params }: PageProps<"/yonetim/odalar/[id]/onizle">) {
  return (
    <Suspense fallback={<Loading className="m-4 lg:m-9" />}>
      <PreviewLoader params={params} />
    </Suspense>
  );
}

async function PreviewLoader({ params }: Pick<PageProps<"/yonetim/odalar/[id]/onizle">, "params">) {
  const access = await requireLabAccess();
  const { id } = await params;
  const lab = await getAdminLab(id);
  if (!lab) notFound();
  const exitHref = paths.adminLab(lab.id);
  const playHref = paths.adminLabPreview(lab.id);

  if (lab.template === "TRAINING") {
    const content = lab.draft as TrainingContent;
    if (content.cards.length === 0) return <Incomplete exitHref={exitHref} />;
    return <LabPreview kind="training" content={content} exitHref={exitHref} playHref={playHref} />;
  }
  const content = lab.draft as ScenarioContent;
  if (content.items.length === 0) return <Incomplete exitHref={exitHref} />;
  const neighborhood = (await getNeighborhoods()).find((n) => n.id === lab.neighborhood.id);
  return (
    <LabPreview
      kind="scenario"
      content={content}
      template={lab.template}
      topic={neighborhood?.topic ?? lab.neighborhood.name}
      avatar={access.avatar}
      exitHref={exitHref}
      playHref={playHref}
    />
  );
}

function Incomplete({ exitHref }: { exitHref: string }) {
  const t = getMessages().lab.preview;
  return (
    <main id="content" className="flex min-h-dvh items-center justify-center p-4">
      <EmptyState
        Icon={FilePenLine}
        title={t.incompleteTitle}
        className="max-w-md flex-none"
        action={
          <Link href={exitHref} className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-accent px-5 font-bold text-on-accent no-underline">
            {t.back}
          </Link>
        }
      >
        {t.incompleteText}
      </EmptyState>
    </main>
  );
}
