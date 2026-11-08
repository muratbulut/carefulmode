import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArticleEditor } from "@/components/admin/news/ArticleEditor";
import { Loading } from "@/components/status/Loading";
import { requirePermission } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { getMessages } from "@/lib/i18n";
import { getEditorArticle, getEditorOptions } from "@/lib/news/data";

export function generateMetadata({ params }: PageProps<"/yonetim/gundem/[id]">) {
  return adminMetadata(async () => {
    const { id } = await params;
    const article = await getEditorArticle(id);
    return article ? article.title || getMessages().news.admin.untitled : null;
  }, "NEWS");
}

/** Haber düzenleme (Gundem-Son düzenleyici, Gundem-Son-Onizleme). */
export default function ArticleEditorPage({ params }: PageProps<"/yonetim/gundem/[id]">) {
  return (
    <Suspense fallback={<Loading className="m-4 lg:m-9" />}>
      <EditorLoader params={params} />
    </Suspense>
  );
}

async function EditorLoader({ params }: Pick<PageProps<"/yonetim/gundem/[id]">, "params">) {
  await requirePermission("NEWS");
  const { id } = await params;
  const article = await getEditorArticle(id);
  if (!article) notFound();
  const options = await getEditorOptions(article);
  return <ArticleEditor key={article.id} article={article} options={options} />;
}
