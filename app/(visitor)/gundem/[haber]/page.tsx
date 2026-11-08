import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageBackground } from "@/components/background/PageBackground";
import { ArticleView, type ArticleViewData } from "@/components/news/ArticleView";
import { ReadTracker } from "@/components/news/ReadTracker";
import { Loading } from "@/components/status/Loading";
import { getMessages } from "@/lib/i18n";
import { roomArtOf } from "@/lib/lab/art";
import { getCityView } from "@/lib/lab/data";
import { allLabs, labHref } from "@/lib/lab/route";
import { getPublishedArticle, getPublishedArticles, type PublicArticle } from "@/lib/news/data";
import { getUser } from "@/lib/session";

/** Başlık ve açıklama haberin kendisinden; taslak ve yayın anı gelmemiş haber "bulunamadı". */
export async function generateMetadata({ params }: PageProps<"/gundem/[haber]">): Promise<Metadata> {
  const { haber } = await params;
  const article = await getPublishedArticle(haber);
  if (!article) return { title: getMessages().pages.notFound, robots: { index: false, follow: false } };
  return {
    title: article.title,
    description: article.summary,
    openGraph: { type: "article", title: article.title, description: article.summary, publishedTime: article.publishedAt.toISOString() },
  };
}

/** Haber sayfası (A Dergi, 4 Kasım). Herkese açık; öğrencide lab kutusunda "Odaya gir". */
export default function ArticlePage({ params }: PageProps<"/gundem/[haber]">) {
  return (
    <>
      <PageBackground />
      <Suspense fallback={<Loading className="relative mx-4 my-8 lg:mx-auto lg:max-w-[1152px]" cardCount={2} />}>
        <Article params={params} />
      </Suspense>
    </>
  );
}

async function Article({ params }: Pick<PageProps<"/gundem/[haber]">, "params">) {
  const { haber } = await params;
  const [article, user] = await Promise.all([getPublishedArticle(haber), getUser()]);
  if (!article) notFound();
  const [all, city] = await Promise.all([getPublishedArticles(), getCityView(user?.id ?? null)]);
  const member = !!user;
  const others = all.filter((a) => a.id !== article.id).slice(0, 3);

  return (
    <div className="relative mx-auto max-w-[1200px] px-4 pt-4 pb-12 lg:px-6 lg:pt-10 lg:pb-[72px]">
      <ReadTracker articleId={article.id} />
      <ArticleView
        article={viewOf(article, allLabs(city.districts), member)}
        member={member}
        others={others.map((o) => ({ slug: o.slug, title: o.title, day: o.day, topic: o.topic, cover: o.cover }))}
      />
    </div>
  );
}

function viewOf(article: PublicArticle, labs: ReturnType<typeof allLabs>, member: boolean): ArticleViewData {
  const lab = article.labSlug ? labs.find((l) => l.slug === article.labSlug) : undefined;
  return {
    title: article.title,
    summary: article.summary,
    date: article.date,
    minutes: article.minutes,
    topic: article.topic,
    content: article.content,
    sourceName: article.sourceName,
    sourceUrl: article.sourceUrl,
    cover: article.cover,
    lab: lab
      ? {
          name: lab.name,
          href: labHref(lab),
          district: lab.district.name,
          difficulty: lab.difficulty,
          durationMin: lab.durationMin,
          icon: lab.district.icon,
          color: lab.district.color,
          art: roomArtOf(lab.slug),
          done: member && lab.state === "done",
        }
      : null,
  };
}
