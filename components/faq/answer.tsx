import Link from "next/link";
import type { ReactNode } from "react";
import { brand } from "@/lib/brand";
import { format, rich } from "@/lib/i18n";
import { paths, routes } from "@/lib/navigation";

/**
 * Cevaplardaki bağlantı etiketleri ve gittikleri sayfalar. Sözlükte "<signUp>ücretsiz hesap</signUp>"
 * yazılır, burada gerçek adrese bağlanır.
 */
export const answerLinks = {
  signUp: routes.signUp,
  reset: routes.resetPassword,
  kvkk: routes.kvkk,
  news: routes.news,
  roadmap: routes.roadmap,
  labs: routes.labs,
  teachers: routes.teachers,
  teaching: paths.profileSection("teaching"),
  classroom: paths.profileSection("classroom"),
  badges: paths.profileSection("badges"),
  delete: paths.profileSection("delete"),
} as const;

const linkClass = "font-bold text-accent-fg underline decoration-accent/40 underline-offset-[3px] hover:decoration-current";

/** Sözlükteki soru ya da cevap metni: ürün adı yerleşir, bağlantı etiketleri sayfaya bağlanır. */
export function renderAnswer(text: string): ReactNode[] {
  const tags = Object.fromEntries(
    Object.entries(answerLinks).map(([tag, href]) => [
      tag,
      (chunk: string) => (
        <Link href={href} className={linkClass}>
          {chunk}
        </Link>
      ),
    ]),
  );
  return rich(format(text, { brand: brand.name }), tags);
}

/** Arama motorları için düz metin (etiketler atılır). */
export function plainAnswer(text: string): string {
  return format(text, { brand: brand.name }).replace(/<\/?\w+>/g, "");
}
