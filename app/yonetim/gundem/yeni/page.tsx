import { Suspense } from "react";
import { ArticleEditor } from "@/components/admin/news/ArticleEditor";
import { Loading } from "@/components/status/Loading";
import { requirePermission } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { getMessages } from "@/lib/i18n";
import { getEditorOptions } from "@/lib/news/data";

export function generateMetadata() {
  return adminMetadata(() => getMessages().news.admin.newArticle, "NEWS");
}

/** Yeni haber (Gundem-Son "Yeni haber"): boş düzenleyici; ilk "Taslak kaydet" ya da "Planla" haberi açar. */
export default function NewArticlePage() {
  return (
    <Suspense fallback={<Loading className="m-4 lg:m-9" />}>
      <NewArticle />
    </Suspense>
  );
}

async function NewArticle() {
  await requirePermission("NEWS");
  const options = await getEditorOptions();
  return <ArticleEditor article={null} options={options} />;
}
