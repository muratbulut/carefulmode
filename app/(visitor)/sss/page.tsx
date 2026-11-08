import type { Metadata } from "next";
import { Suspense } from "react";
import { FaqExplorer } from "@/components/faq/FaqExplorer";
import { ContactCard, FaqPage } from "@/components/faq/FaqPage";
import { defaultFaqTopic, parseFaqTopic } from "@/components/faq/questions";
import { brand } from "@/lib/brand";
import { format, getMessages } from "@/lib/i18n";
import { getUser } from "@/lib/session";

const t = getMessages().faq;

export const metadata: Metadata = {
  title: t.title,
  description: format(t.description, { brand: brand.name }),
};

/**
 * Sık sorulan sorular (4 Kasım, tasarım B "Yanda konular"). Başlık statik; açık konu adresten
 * (?konu=) ve oturumdan geldiği için sorular istek anında çizilir. O gelene kadar (ve JavaScript
 * kapalıysa) Genel konusu ve bütün soruların açık listesi görünür.
 */
export default function Page({ searchParams }: PageProps<"/sss">) {
  return (
    <FaqPage>
      <Suspense fallback={<FaqExplorer initialTopic="general" contact={<ContactCard />} noScriptList />}>
        <FaqForViewer searchParams={searchParams} />
      </Suspense>
    </FaqPage>
  );
}

/** Adreste konu yoksa giriş yapmış öğrenci Öğrenciler, öğretmen Öğretmenler konusuyla açar. */
async function FaqForViewer({ searchParams }: Pick<PageProps<"/sss">, "searchParams">) {
  const [params, user] = await Promise.all([searchParams, getUser()]);
  const topic = parseFaqTopic(params) ?? defaultFaqTopic(user?.role);
  return <FaqExplorer key={topic} initialTopic={topic} contact={<ContactCard />} />;
}
