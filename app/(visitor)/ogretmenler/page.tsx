import type { Metadata } from "next";
import { TeachersPage } from "@/components/teachers/TeachersPage";
import { getMessages } from "@/lib/i18n";

const t = getMessages();

export const metadata: Metadata = {
  title: t.pages.teachers,
  description: t.teachersPage.description,
};

/** Öğretmenler için tanıtım sayfası. Statik; yalnızca "Öğretmen hesabı iste" düğmesi oturuma bakar. */
export default function Page() {
  return <TeachersPage />;
}
